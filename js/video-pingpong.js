// Seamless looping for the videos a user adds as a background (pages/video-maker.html).
//
// A plain `loop` jumps from the last frame to the first. These clips are short (~10 s) and
// rarely end where they began, so the cut shows. The look wanted is forward, then the same
// frames backward, then forward again: 0 s -> 10 s -> 0 s -> 10 s, no visible cut. A browser
// can't play a video backward, so the reversed clip is made once, here, and cached:
//
//   1. the clip is played once and each frame is taken as it is presented (seeking to every
//      frame would be far slower: phone clips often have one keyframe in 10 s, and each seek
//      then decodes everything since it),
//   2. every frame is encoded as its own keyframe (H.264, all-intra), so any frame can sit in
//      any order, at a bitrate that keeps the look of the original,
//   3. the frames are written forward and then backward (the two turning frames are not
//      repeated, so nothing stutters) into one MP4, which then simply loops.
//
// The built-in backgrounds are made once at build time instead (scripts/gen-pingpong.cjs).
// Without WebCodecs the plain loop stays as it was.
(function () {
  'use strict';

  const GEN = 2;                     // bump when what this makes changes (it is part of the cache key)
  const BPP = 0.08;                  // bits per pixel and frame of the all-intra encode (~40 dB against the source)
  const MAX_SECONDS = 30;            // longer clips keep the plain loop (their frames would not fit in memory)
  const MAX_EDGE = 1920;             // larger clips are scaled down to this
  const DB = 'vm-pingpong';
  const STORE = 'clips';
  const CODECS = ['avc1.640033', 'avc1.4d0033', 'avc1.42E033'];

  const supported = () => !!(window.VideoEncoder && window.VideoFrame && window.Mp4Muxer && Mp4Muxer.Muxer &&
    HTMLVideoElement.prototype.requestVideoFrameCallback);
  const even = n => Math.max(2, Math.round(n / 2) * 2);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---- cache (IndexedDB) ----
  function db() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  function tx(mode, fn) {
    return db().then(d => new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => { d.close(); resolve(out && 'result' in out ? out.result : undefined); };
      t.onerror = () => { d.close(); reject(t.error); };
      t.onabort = () => { d.close(); reject(t.error || new Error('aborted')); };
    }));
  }
  const cacheGet = key => tx('readonly', s => s.get(key)).catch(() => undefined);
  const cachePut = (key, blob) => tx('readwrite', s => s.put(blob, key)).catch(() => {});
  // Forget the clip made for a background (its name is part of the key): used when it is deleted.
  function drop(name) {
    return tx('readwrite', s => {
      const req = s.openCursor();
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return;
        if (String(c.key).split('|')[0] === name) c.delete();
        c.continue();
      };
    }).catch(() => {});
  }

  // ---- reading the clip ----
  function once(el, ev, ms) {
    return new Promise((resolve, reject) => {
      const done = ok => { clearTimeout(t); el.removeEventListener(ev, onOk); el.removeEventListener('error', onErr); ok ? resolve() : reject(new Error(ev + ' failed')); };
      const onOk = () => done(true), onErr = () => done(false);
      const t = setTimeout(() => done(false), ms);
      el.addEventListener(ev, onOk);
      el.addEventListener('error', onErr);
    });
  }
  // Frames per second of the clip: the median gap between presented frames, capped at 30.
  async function detectFps(v) {
    if (!v.requestVideoFrameCallback) return 30;
    const times = [];
    await new Promise(resolve => {
      const stop = setTimeout(resolve, 1500);
      const step = (now, meta) => {
        times.push(meta.mediaTime);
        if (times.length >= 12) { clearTimeout(stop); resolve(); } else v.requestVideoFrameCallback(step);
      };
      v.requestVideoFrameCallback(step);
      v.play().catch(resolve);
    });
    v.pause();
    try { v.currentTime = 0; await once(v, 'seeked', 5000); } catch (e) { /* the capture starts from where it is */ }
    const gaps = [];
    for (let i = 1; i < times.length; i++) if (times[i] > times[i - 1]) gaps.push(times[i] - times[i - 1]);
    if (!gaps.length) return 30;
    gaps.sort((a, b) => a - b);
    return Math.min(30, Math.max(12, Math.round(1 / gaps[Math.floor(gaps.length / 2)])));
  }

  // Returns { blob, fromCache } or null (not supported / not possible: the plain loop stays).
  //   url:  where the clip can be read (a blob: URL of the user's file)
  //   name: what identifies it for the cache (the background's file name)
  async function get(url, name, opts) {
    const o = opts || {};
    const onProgress = o.onProgress || (() => {});
    const cancelled = o.isCancelled || (() => false);
    if (!supported()) return null;

    const v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('playsinline', '');
    v.src = url;
    try {
      await once(v, 'loadeddata', 20000);
      const dur = v.duration;
      if (!(dur >= 0.5) || !isFinite(dur) || dur > MAX_SECONDS || !v.videoWidth) return null;
      const key = [name, GEN, Math.round(dur * 1000), v.videoWidth, v.videoHeight].join('|');
      const hit = await cacheGet(key);
      if (hit && hit.size > 1000) return { blob: hit, fromCache: true };

      const fps = await detectFps(v);
      const scale = Math.min(1, MAX_EDGE / Math.max(v.videoWidth, v.videoHeight));
      const W = even(v.videoWidth * scale), H = even(v.videoHeight * scale);
      const n = Math.max(3, Math.floor(dur * fps));
      // every frame is a keyframe, which needs more bits than a normal clip for the same look
      const bitrate = Math.round(Math.min(30e6, Math.max(1e6, W * H * fps * (o.bpp || BPP))));
      let cfg = null;
      for (const codec of CODECS) {
        const c = { codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality', avc: { format: 'avc' } };
        try { if ((await VideoEncoder.isConfigSupported(c)).supported) { cfg = c; break; } } catch (e) { /* next */ }
      }
      if (!cfg) return null;

      const frames = [];
      let meta0 = null, failure = null;
      const enc = new VideoEncoder({
        output: (chunk, meta) => {
          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          frames.push(data);
          if (!meta0 && meta && meta.decoderConfig) meta0 = meta;
        },
        error: e => { failure = e; },
      });
      enc.configure(cfg);
      const cv = document.createElement('canvas');
      cv.width = W; cv.height = H;
      const c = cv.getContext('2d', { alpha: false });
      try {
        // Play the clip once; every presented frame is encoded for each output frame whose time it
        // has reached (a frame is repeated if the player dropped one, skipped if the clip has more
        // than `fps` frames a second), so the output has exactly n frames, evenly spaced.
        let j = 0, last = performance.now(), paused = false;
        const encodeNext = () => {
          const f = new VideoFrame(cv, { timestamp: Math.round(j * 1e6 / fps), duration: Math.round(1e6 / fps) });
          enc.encode(f, { keyFrame: true });
          f.close();
          j++;
        };
        await new Promise((resolve, reject) => {
          let finished = false;
          const finish = fn => { if (finished) return; finished = true; clearInterval(watch); v.removeEventListener('ended', onEnd); v.removeEventListener('error', onErr); fn(); };
          const onEnd = () => finish(resolve);
          const onErr = () => finish(() => reject(new Error('video error')));
          const onFrame = (now, meta) => {
            if (finished) return;
            last = performance.now();
            if (cancelled()) { finish(resolve); return; }
            if (failure) { finish(() => reject(failure)); return; }
            if (j < n && meta.mediaTime >= j / fps - 0.25 / fps) {
              c.drawImage(v, 0, 0, W, H);
              while (j < n && meta.mediaTime >= j / fps - 0.25 / fps) encodeNext();
              if (j % 4 === 0) onProgress(j / n * 0.92);
            }
            if (j >= n) { finish(resolve); return; }
            if (enc.encodeQueueSize > 8) {                      // the encoder is behind: wait for it, then go on
              paused = true;
              v.pause();
              (async () => {
                while (!finished && enc.encodeQueueSize > 2) await sleep(10);
                paused = false;
                if (!finished) { v.requestVideoFrameCallback(onFrame); v.play().catch(() => {}); }
              })();
              return;
            }
            v.requestVideoFrameCallback(onFrame);
          };
          // a stalled player (a hidden tab, a decoder hiccup) is nudged, and given up on after 20 s
          const watch = setInterval(() => {
            if (finished || paused) return;
            const idle = performance.now() - last;
            if (idle > 20000) finish(() => reject(new Error('stalled')));
            else if (idle > 2500) v.play().catch(() => {});
          }, 1000);
          v.addEventListener('ended', onEnd);
          v.addEventListener('error', onErr);
          v.requestVideoFrameCallback(onFrame);
          v.play().catch(e => finish(() => reject(e)));
        });
        if (cancelled()) { enc.close(); return null; }
        while (j < n) encodeNext();                              // the clip ended a frame short: hold the last one
        await enc.flush();
        if (failure) throw failure;
      } finally {
        try { if (enc.state !== 'closed') enc.close(); } catch (e) { /* closed */ }
      }
      if (frames.length !== n || !meta0) return null;

      // forward, then back without repeating the two turning frames
      const order = [];
      for (let k = 0; k < n; k++) order.push(k);
      for (let k = n - 2; k >= 1; k--) order.push(k);
      const target = new Mp4Muxer.ArrayBufferTarget();
      const muxer = new Mp4Muxer.Muxer({ target, video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory', firstTimestampBehavior: 'offset' });
      const gap = Math.round(1e6 / fps);
      order.forEach((idx, p) => muxer.addVideoChunkRaw(frames[idx], 'key', p * gap, gap, p === 0 ? meta0 : undefined));
      muxer.finalize();
      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      onProgress(1);
      cachePut(key, blob);
      return { blob, fromCache: false };
    } catch (e) {
      console.warn('[video-maker] ping-pong loop failed, keeping the plain loop', e);
      return null;
    } finally {
      v.pause();
      v.removeAttribute('src');
      v.load();
    }
  }

  window.PingPong = { supported, get, drop, GEN };
})();
