// Converts a fragmented MP4 (what Chrome's MediaRecorder writes: an empty
// 'moov' followed by moof/mdat fragments) into a regular "fast start" MP4 with
// full sample tables and a real duration in the header.
//
// Why: galleries, WhatsApp and many share targets read the duration from
// mvhd/tkhd/mdhd only. In a fragmented file those say 0 (or the first
// fragment), so a 1-minute clip shows as ~3 s and gets cut. Players that scan
// the fragments play the whole thing, which is why the bug looks inconsistent.
//
// Lossless: samples are copied byte-for-byte, nothing is re-encoded.
// Usage: const out = Mp4FastStart.defragment(arrayBuffer)  // Uint8Array, or null if not fragmented
(function () {
  'use strict';

  const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf', 'edts', 'dinf']);

  function readBoxes(view, start, end) {
    const boxes = [];
    let o = start;
    while (o + 8 <= end) {
      let size = view.getUint32(o);
      const type = String.fromCharCode(view.getUint8(o + 4), view.getUint8(o + 5), view.getUint8(o + 6), view.getUint8(o + 7));
      let hdr = 8;
      if (size === 1) { size = Number(view.getBigUint64(o + 8)); hdr = 16; }
      else if (size === 0) size = end - o;
      if (size < hdr || o + size > end) break;   // truncated tail: stop cleanly
      const box = { type, start: o, size, hdr, end: o + size };
      if (CONTAINERS.has(type)) box.children = readBoxes(view, o + hdr, o + size);
      boxes.push(box);
      o += size;
    }
    return boxes;
  }
  const find = (boxes, type) => boxes && boxes.find(b => b.type === type);
  const findAll = (boxes, type) => (boxes || []).filter(b => b.type === type);

  // ---- box writers ----
  function concat(parts) {
    let len = 0;
    parts.forEach(p => { len += p.length; });
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n >>> 0); return b; }
  function i32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setInt32(0, n | 0); return b; }
  function box(type, ...parts) {
    const body = concat(parts);
    const head = new Uint8Array(8);
    const dv = new DataView(head.buffer);
    dv.setUint32(0, body.length + 8);
    for (let i = 0; i < 4; i++) head[4 + i] = type.charCodeAt(i);
    return concat([head, body]);
  }
  const fullBox = (type, version, flags, ...parts) => box(type, u32((version << 24) | flags), ...parts);

  // Run-length table writers
  function stts(durations) {
    const runs = [];
    durations.forEach(d => {
      const last = runs[runs.length - 1];
      if (last && last[1] === d) last[0]++; else runs.push([1, d]);
    });
    return fullBox('stts', 0, 0, u32(runs.length), ...runs.flatMap(([c, d]) => [u32(c), u32(d)]));
  }
  function ctts(offsets) {
    const runs = [];
    offsets.forEach(d => {
      const last = runs[runs.length - 1];
      if (last && last[1] === d) last[0]++; else runs.push([1, d]);
    });
    // Version 1 allows negative offsets (trun v1 writes signed values).
    return fullBox('ctts', 1, 0, u32(runs.length), ...runs.flatMap(([c, d]) => [u32(c), i32(d)]));
  }
  function stsz(sizes) {
    const same = sizes.length && sizes.every(s => s === sizes[0]);
    if (same) return fullBox('stsz', 0, 0, u32(sizes[0]), u32(sizes.length));
    return fullBox('stsz', 0, 0, u32(0), u32(sizes.length), ...sizes.map(u32));
  }
  function stsc(chunkCounts) {
    const runs = [];
    chunkCounts.forEach((n, i) => {
      const last = runs[runs.length - 1];
      if (!last || last[1] !== n) runs.push([i + 1, n]);
    });
    return fullBox('stsc', 0, 0, u32(runs.length), ...runs.flatMap(([first, n]) => [u32(first), u32(n), u32(1)]));
  }

  function defragment(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const top = readBoxes(view, 0, bytes.length);
    const moov = find(top, 'moov');
    const moofs = findAll(top, 'moof');
    if (!moov || !moofs.length) return null;   // already a regular MP4

    const mvhd = find(moov.children, 'mvhd');
    const mvhdVer = bytes[mvhd.start + mvhd.hdr];
    const movieTimescale = view.getUint32(mvhd.start + mvhd.hdr + (mvhdVer === 1 ? 20 : 12));

    // Per-track defaults from mvex/trex.
    const trexById = {};
    findAll(find(moov.children, 'mvex') && find(moov.children, 'mvex').children, 'trex').forEach(t => {
      const p = t.start + t.hdr + 4;
      trexById[view.getUint32(p)] = {
        sdi: view.getUint32(p + 4), duration: view.getUint32(p + 8),
        size: view.getUint32(p + 12), flags: view.getUint32(p + 16),
      };
    });

    const tracks = findAll(moov.children, 'trak').map(trak => {
      const tkhd = find(trak.children, 'tkhd');
      const tkVer = bytes[tkhd.start + tkhd.hdr];
      const id = view.getUint32(tkhd.start + tkhd.hdr + (tkVer === 1 ? 20 : 12));
      const mdia = find(trak.children, 'mdia');
      const mdhd = find(mdia.children, 'mdhd');
      const mdVer = bytes[mdhd.start + mdhd.hdr];
      const timescale = view.getUint32(mdhd.start + mdhd.hdr + (mdVer === 1 ? 20 : 12));
      const hdlr = find(mdia.children, 'hdlr');
      const handler = String.fromCharCode(...bytes.subarray(hdlr.start + hdlr.hdr + 8, hdlr.start + hdlr.hdr + 12));
      return { id, trak, tkhd, mdia, mdhd, timescale, handler, samples: [], chunks: [], firstDecode: null, nextDecode: null };
    });
    const trackById = {};
    tracks.forEach(t => { trackById[t.id] = t; });

    // Walk every fragment and collect samples (absolute file offsets).
    moofs.forEach(moof => {
      findAll(moof.children, 'traf').forEach(traf => {
        const tfhd = find(traf.children, 'tfhd');
        let p = tfhd.start + tfhd.hdr;
        const tfFlags = view.getUint32(p) & 0xffffff;
        const id = view.getUint32(p + 4);
        const track = trackById[id];
        if (!track) return;
        const trex = trexById[id] || { duration: 0, size: 0, flags: 0 };
        p += 8;
        let base = moof.start;   // default-base-is-moof (what browsers write)
        if (tfFlags & 0x1) { base = Number(view.getBigUint64(p)); p += 8; }
        if (tfFlags & 0x2) p += 4;
        let defDur = trex.duration, defSize = trex.size, defFlags = trex.flags;
        if (tfFlags & 0x8) { defDur = view.getUint32(p); p += 4; }
        if (tfFlags & 0x10) { defSize = view.getUint32(p); p += 4; }
        if (tfFlags & 0x20) { defFlags = view.getUint32(p); p += 4; }

        const tfdt = find(traf.children, 'tfdt');
        let decodeTime = null;
        if (tfdt) {
          const v = bytes[tfdt.start + tfdt.hdr];
          decodeTime = v === 1 ? Number(view.getBigUint64(tfdt.start + tfdt.hdr + 4)) : view.getUint32(tfdt.start + tfdt.hdr + 4);
        }
        // A gap between fragments (dropped frames, audio start) is absorbed by
        // the previous sample's duration so audio and video stay in sync.
        if (decodeTime != null) {
          if (track.firstDecode == null) track.firstDecode = decodeTime;
          else if (track.nextDecode != null && track.samples.length && decodeTime > track.nextDecode) {
            track.samples[track.samples.length - 1].duration += decodeTime - track.nextDecode;
          }
          track.nextDecode = decodeTime;
        }

        findAll(traf.children, 'trun').forEach(trun => {
          let q = trun.start + trun.hdr;
          const ver = bytes[q];
          const flags = view.getUint32(q) & 0xffffff;
          const count = view.getUint32(q + 4);
          q += 8;
          let dataOffset = 0;
          if (flags & 0x1) { dataOffset = view.getInt32(q); q += 4; }
          let firstFlags = null;
          if (flags & 0x4) { firstFlags = view.getUint32(q); q += 4; }
          let pos = base + dataOffset;
          const chunk = { offset: pos, count: 0 };
          for (let i = 0; i < count; i++) {
            const duration = (flags & 0x100) ? view.getUint32((q += 4) - 4) : defDur;
            const size = (flags & 0x200) ? view.getUint32((q += 4) - 4) : defSize;
            let sflags = (flags & 0x400) ? view.getUint32((q += 4) - 4) : defFlags;
            if (i === 0 && firstFlags != null) sflags = firstFlags;
            let cto = 0;
            if (flags & 0x800) { cto = ver === 1 ? view.getInt32(q) : view.getUint32(q); q += 4; }
            track.samples.push({ offset: pos, size, duration, sync: !(sflags & 0x10000), cto });
            if (track.nextDecode != null) track.nextDecode += duration;
            pos += size;
            chunk.count++;
          }
          if (chunk.count) track.chunks.push(chunk);
        });
      });
    });

    const usable = tracks.filter(t => t.samples.length);
    if (!usable.length) return null;

    // Interleave chunks in file order (same layout the recorder used).
    const allChunks = [];
    usable.forEach(t => t.chunks.forEach(c => allChunks.push({ track: t, chunk: c })));
    allChunks.sort((a, b) => a.chunk.offset - b.chunk.offset);
    let mdatPayload = 0;
    allChunks.forEach(({ track, chunk }) => {
      const first = track.samples.findIndex(s => s.offset === chunk.offset);
      let len = 0;
      for (let i = 0; i < chunk.count; i++) len += track.samples[first + i].size;
      chunk.len = len;
      mdatPayload += len;
    });

    const patchDuration = (b, durOffsetV0, durOffsetV1, value) => {
      const copy = bytes.slice(b.start, b.end);
      const dv = new DataView(copy.buffer);
      if (copy[b.hdr] === 1) dv.setBigUint64(b.hdr + durOffsetV1, BigInt(value));
      else dv.setUint32(b.hdr + durOffsetV0, Math.min(value, 0xffffffff));
      return copy;
    };
    const raw = b => bytes.slice(b.start, b.end);

    // Builds moov for a given mdat payload start (stco depends on it, so we
    // build once to measure, then again with the real offset).
    function buildMoov(payloadStart) {
      let cursor = payloadStart;
      const chunkOffsets = new Map();
      allChunks.forEach(({ chunk }) => { chunkOffsets.set(chunk, cursor); cursor += chunk.len; });

      let movieDuration = 0;
      const traks = usable.map(t => {
        const mediaDuration = t.samples.reduce((a, s) => a + s.duration, 0);
        // Leading offset (track starts after 0) → empty edit so A/V stay aligned.
        const lead = t.firstDecode ? Math.round(t.firstDecode * movieTimescale / t.timescale) : 0;
        const trackMovieDur = Math.round(mediaDuration * movieTimescale / t.timescale) + lead;
        movieDuration = Math.max(movieDuration, trackMovieDur);

        const stbl = find(find(find(t.mdia.children, 'minf').children, 'stbl').children, 'stsd');
        const hasCto = t.samples.some(s => s.cto !== 0);
        const allSync = t.samples.every(s => s.sync);
        const syncIdx = [];
        t.samples.forEach((s, i) => { if (s.sync) syncIdx.push(i + 1); });
        const stblBox = box('stbl',
          raw(stbl),
          stts(t.samples.map(s => s.duration)),
          hasCto ? ctts(t.samples.map(s => s.cto)) : new Uint8Array(0),
          allSync ? new Uint8Array(0) : fullBox('stss', 0, 0, u32(syncIdx.length), ...syncIdx.map(u32)),
          stsc(t.chunks.map(c => c.count)),
          stsz(t.samples.map(s => s.size)),
          fullBox('stco', 0, 0, u32(t.chunks.length), ...t.chunks.map(c => u32(chunkOffsets.get(c)))),
        );
        const minf = find(t.mdia.children, 'minf');
        const minfBox = box('minf', ...minf.children.filter(c => c.type !== 'stbl').map(raw), stblBox);
        const mdiaBox = box('mdia',
          patchDuration(t.mdhd, 16, 24, mediaDuration),
          ...t.mdia.children.filter(c => c.type !== 'mdhd' && c.type !== 'minf').map(raw),
          minfBox);
        const edts = lead ? box('edts', fullBox('elst', 0, 0, u32(2),
          u32(lead), i32(-1), u32(0x00010000),
          u32(trackMovieDur - lead), i32(0), u32(0x00010000))) : new Uint8Array(0);
        return box('trak',
          patchDuration(t.tkhd, 20, 28, trackMovieDur),
          edts,
          ...t.trak.children.filter(c => !['tkhd', 'mdia', 'edts'].includes(c.type)).map(raw),
          mdiaBox);
      });
      return box('moov',
        patchDuration(mvhd, 16, 24, movieDuration),
        ...traks,
        ...moov.children.filter(c => !['mvhd', 'trak', 'mvex'].includes(c.type)).map(raw));
    }

    const ftyp = box('ftyp', new TextEncoder().encode('isom'), u32(0x200),
      new TextEncoder().encode('isomiso2avc1mp41'));
    const mdatHeader = mdatPayload + 8 > 0xffffffff ? 16 : 8;
    const probe = buildMoov(0);
    const moovBox = buildMoov(ftyp.length + probe.length + mdatHeader);

    const out = new Uint8Array(ftyp.length + moovBox.length + mdatHeader + mdatPayload);
    let o = 0;
    out.set(ftyp, o); o += ftyp.length;
    out.set(moovBox, o); o += moovBox.length;
    const mdv = new DataView(out.buffer);
    if (mdatHeader === 16) {
      mdv.setUint32(o, 1); out.set([109, 100, 97, 116], o + 4); mdv.setBigUint64(o + 8, BigInt(mdatPayload + 16));
    } else {
      mdv.setUint32(o, mdatPayload + 8); out.set([109, 100, 97, 116], o + 4);
    }
    o += mdatHeader;
    allChunks.forEach(({ chunk }) => {
      out.set(bytes.subarray(chunk.offset, chunk.offset + chunk.len), o);
      o += chunk.len;
    });
    return out;
  }

  window.Mp4FastStart = { defragment };
})();
