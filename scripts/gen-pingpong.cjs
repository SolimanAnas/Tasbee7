// Makes a seamless forward-then-reverse ("ping-pong") copy of every built-in background
// video:  images/video-maker/v1.mp4  ->  images/video-maker/v1.pp.mp4
//
// Played in a loop, v1.pp.mp4 runs 0 s -> 10 s -> 0 s -> 10 s ... with no cut: the clip
// goes forward, then the same frames backward, and the picture at the point where it
// restarts is the picture it just left (the browser can't play a video backward itself).
// The two turning frames are not repeated, so there is no stutter at the ends.
//
//   npm run bgs:pingpong            (needs ffmpeg + ffprobe)
//   npm run bgs:pingpong -- --force   rebuild the ones that already exist
//
// The originals stay as they are (the picker thumbnails and the poster come from them);
// js/video-maker.js plays the .pp.mp4 when it exists and falls back to the original.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.resolve(__dirname, '..', 'images', 'video-maker');
const force = process.argv.includes('--force');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.error) { console.error(`✗ could not run ${cmd}: ${r.error.message}`); process.exit(1); }
  return r;
}

const sources = fs.readdirSync(DIR)
  .filter(f => /\.(mp4|webm)$/i.test(f) && !/\.pp\.mp4$/i.test(f))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (!sources.length) { console.log('No videos in images/video-maker/.'); process.exit(0); }

for (const f of sources) {
  const out = f.replace(/\.(mp4|webm)$/i, '.pp.mp4');
  if (fs.existsSync(path.join(DIR, out)) && !force) { console.log(`= ${out} exists (use --force to rebuild)`); continue; }
  const src = path.join(DIR, f);
  const probe = run('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0',
    '-show_entries', 'stream=nb_read_frames,r_frame_rate', '-of', 'default=nw=1', src]);
  const n = parseInt((/nb_read_frames=(\d+)/.exec(probe.stdout) || [])[1], 10);
  const rate = (/r_frame_rate=([\d/]+)/.exec(probe.stdout) || [])[1];
  if (!n || n < 4 || !rate) { console.warn(`⚠ ${f}: could not read its frames, skipped`); continue; }
  // forward (all n frames) + reverse without its first and last frame (the turning frames)
  const filter = `[0:v]split=2[f][r];[r]reverse,trim=start_frame=1:end_frame=${n - 1},setpts=PTS-STARTPTS[b];` +
    `[f][b]concat=n=2:v=1:a=0[v]`;
  const r = run('ffmpeg', ['-v', 'error', '-y', '-i', src, '-filter_complex', filter, '-map', '[v]', '-an',
    '-r', rate, '-c:v', 'libx264', '-crf', '21', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-g', String(Math.round(eval(rate))),
    '-movflags', '+faststart', path.join(DIR, out)]);
  if (r.status !== 0) { console.error(`✗ ${f}: ${r.stderr.trim()}`); process.exit(1); }
  console.log(`✓ ${out}  (${n} frames forward + ${n - 2} back, ${(fs.statSync(path.join(DIR, out)).size / 1048576).toFixed(1)} MB)`);
}
