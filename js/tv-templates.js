// Templates for the long (16:9 TV-style) video mode of pages/video-maker.html.
//
// A template is the frame around the recitation: ornaments, the plates that carry
// the surah and reciter names, and the box the ayah text is fitted into. The
// background (gradient, picture or the user's own picture) is chosen separately,
// so every template works over every background.
//
// All positions are percentages of the 16:9 frame, so the same template draws the
// 1920×1080 export, the preview and the small picker thumbnails.
//   - Ornaments / plates: { src, cx, cy, w } — centre point and width; the height
//     follows the picture's own aspect ratio (never stretched).
//   - Plate text box: `inset` = [left, top, right, bottom] share of the plate kept
//     clear (its gold border and corner ornaments).
//   - Plain labels (no plate): { cx, cy, w, h }.
//   - ayah: { x, y, w, h } box; `maxLines` caps the lines on screen at once — longer
//     ayat are split into pages (see js/video-maker.js, long mode).
// Pictures live in images/tv-maker/ornaments/ (cut from the supplied sheets in
// images/tv-maker/source/ — see images/tv-maker/README.md).
window.TV_TEMPLATES = [
  {
    id: 'royal',
    name: { ar: 'أزرق ملكي', en: 'Royal blue' },
    overlays: [
      { src: 'divider-01', cx: 50, cy: 80.5, w: 58 },
    ],
    ayah: { x: 5, y: 19, w: 90, h: 58, maxLines: 4 },
    surah: { plate: 'plate-01', cx: 50, cy: 9, w: 40, inset: [0.13, 0.2, 0.13, 0.2], color: '#f8e7b5' },
    reciter: { plate: 'plate-05', cx: 50, cy: 91, w: 36, inset: [0.14, 0.32, 0.14, 0.1], color: '#ffffff' },
  },
  {
    id: 'mosque',
    name: { ar: 'المسجد', en: 'Mosque' },
    overlays: [
      { src: 'crown-01', cx: 50, cy: 8.5, w: 54 },
    ],
    ayah: { x: 5, y: 20, w: 90, h: 57, maxLines: 4 },
    surah: { plate: 'plate-02', cx: 64, cy: 89.5, w: 44, inset: [0.21, 0.2, 0.08, 0.16], color: '#f8e7b5' },
    reciter: { plate: 'plate-04', cx: 22, cy: 89.5, w: 34, inset: [0.13, 0.22, 0.13, 0.2], color: '#ffffff' },
  },
  {
    id: 'parchment',
    name: { ar: 'رَقّ', en: 'Parchment' },
    overlays: [
      { src: 'arch-01', cx: 50, cy: 6.5, w: 44 },
      { src: 'divider-03', cx: 50, cy: 83, w: 62 },
    ],
    ayah: { x: 5, y: 26, w: 90, h: 53, maxLines: 4 },
    surah: { plate: 'plate-03', cx: 50, cy: 17, w: 36, inset: [0.15, 0.22, 0.15, 0.22], color: '#13294b', fx: 'none' },
    reciter: { cx: 50, cy: 91.5, w: 50, h: 6, color: '#ffffff' },
  },
  {
    id: 'minimal',
    name: { ar: 'بسيط', en: 'Minimal' },
    overlays: [
      { src: 'divider-07', cx: 50, cy: 13, w: 58 },
      { src: 'divider-07', cx: 50, cy: 84, w: 58 },
    ],
    ayah: { x: 5, y: 17, w: 90, h: 64, maxLines: 4 },
    surah: { cx: 50, cy: 6.5, w: 50, h: 7, color: '#f8e7b5' },
    reciter: { cx: 50, cy: 91.5, w: 50, h: 6, color: '#ffffff' },
  },
];
