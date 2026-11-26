// Templates for the long (16:9 TV-style) video mode of pages/video-maker.html.
//
// Two kinds:
//   - Painted templates: a complete 16:9 picture (scenery, arch, lanterns and the two
//     name plates already painted in). Only the text is drawn: the surah name in the
//     top plate, the reciter in the bottom plate, the ayah in between.
//   - Ornament templates: ornaments and plates drawn over a background the user picks
//     separately (gradient, picture or their own picture).
//
// All positions are percentages of the 16:9 frame, so the same template draws the
// 1920×1080 export, the preview and the small picker thumbnails.
//   - Ornaments / plates: { src, cx, cy, w } — centre point and width; the height
//     follows the picture's own aspect ratio (never stretched).
//   - Plate text box: `inset` = [left, top, right, bottom] share of the plate kept
//     clear (its gold border and corner ornaments).
//   - Plain labels (no plate): { cx, cy, w, h }.
//   - glow: colour of the outer glow around the app logo (lower right corner).
//   - ayah: { x, y, w, h } box; `maxLines` caps the lines on screen at once — longer
//     ayat are split into pages (see js/video-maker.js, long mode).
// Pictures live in images/tv-maker/ (see images/tv-maker/README.md): painted
// backgrounds in backgrounds/, ornaments in ornaments/ (cut from source/).
(function () {
  // A painted template from the inside of its two plates, measured on the picture
  // (left, top, right, bottom in % — found from the plates' gold borders).
  // The names get the middle of each plate; the ayah gets the open sky between them,
  // clear of the lanterns and the mushaf stand at the sides.
  function painted(id, ar, en, file, top, bottom, opts) {
    const o = opts || {};
    const label = ([l, t, r, b], color) => ({
      cx: (l + r) / 2, cy: (t + b) / 2, w: (r - l) * 0.86, h: (b - t) * 0.72,
      color, baked: true, fx: o.dark ? 'none' : undefined,
    });
    const y = top[3] + 3.5, y2 = bottom[1] - 3.5;
    return {
      id,
      name: { ar, en },
      background: file,
      overlays: [],
      ayah: { x: 12, y, w: 76, h: y2 - y, maxLines: 4 },
      ink: o.ink,           // pale sky: ayah drawn in this dark colour with a light halo
      panel: !!o.panel,     // busy scenery: soft panel behind the ayah
      glow: o.glow,         // outer glow of the app logo, in the picture's own colour
      surah: label(top, o.dark ? '#13294b' : '#f8e7b5'),
      reciter: label(bottom, o.dark ? '#13294b' : '#ffffff'),
    };
  }
  window.TV_PAINTED = [
    painted('dawn', 'فجر فيروزي', 'Teal dawn', 'bg-01.webp', [36.8, 12.2, 62.8, 21.8], [28.8, 75.1, 71.1, 85.7], { ink: '#0e2442', glow: '#5ec8c0' }),
    painted('moonlit', 'ليلة مقمرة', 'Moonlit night', 'bg-02.webp', [37.1, 12.3, 62.6, 21.8], [29.5, 75.8, 70.4, 86.0], { glow: '#8fb8ff' }),
    painted('ivory', 'عاجي', 'Ivory', 'bg-03.webp', [37.9, 15.1, 61.8, 24.4], [29.8, 75.2, 70.2, 84.0], { dark: true, ink: '#0e2442', glow: '#e8c87a' }),
    painted('sunset', 'غروب', 'Sunset', 'bg-04.webp', [36.9, 12.3, 62.8, 21.9], [29.1, 77.4, 71.0, 88.0], { ink: '#0e2442', glow: '#ffb37a' }),
    painted('violet', 'ليل بنفسجي', 'Violet night', 'bg-05.jpg', [37.8, 12.5, 62.2, 23.2], [29.2, 75.1, 70.8, 85.2], { glow: '#b98cff' }),
    painted('greenmist', 'ضباب أخضر', 'Green mist', 'bg-06.webp', [37.6, 12.3, 61.9, 21.7], [29.1, 77.4, 70.6, 87.7], { ink: '#0e2442', glow: '#8fd19e' }),
    painted('mistfalls', 'شلال الضباب', 'Misty falls', 'bg-07.webp', [37.6, 12.2, 61.9, 21.7], [29.1, 77.4, 70.7, 87.6], { ink: '#0e2442', glow: '#6fd3e0' }),
    painted('falls', 'الشلال', 'Waterfall', 'bg-08.webp', [37.7, 12.4, 62.0, 21.8], [29.2, 77.4, 70.7, 87.5], { panel: true, glow: '#ffd27a' }),
    painted('dayfalls', 'شلال النهار', 'Daylight falls', 'bg-09.webp', [37.7, 12.5, 62.0, 21.9], [29.2, 77.5, 70.7, 87.6], { panel: true, glow: '#7fe3ff' }),
    painted('crescent', 'هلال', 'Crescent', 'bg-10.webp', [37.6, 13.2, 62.4, 23.5], [29.2, 74.7, 70.7, 84.7], { glow: '#64c8d8' }),
  ];
})();

window.TV_TEMPLATES = window.TV_PAINTED.concat([
  {
    id: 'royal',
    glow: '#e6c068',
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
    glow: '#7fd19a',
    name: { ar: 'المسجد', en: 'Mosque' },
    overlays: [
      { src: 'crown-01', cx: 50, cy: 8.5, w: 54 },
    ],
    ayah: { x: 5, y: 20, w: 90, h: 57, maxLines: 4 },
    surah: { plate: 'plate-02', cx: 64, cy: 87, w: 44, inset: [0.21, 0.2, 0.08, 0.16], color: '#f8e7b5' },
    reciter: { plate: 'plate-04', cx: 22, cy: 87, w: 34, inset: [0.13, 0.22, 0.13, 0.2], color: '#ffffff' },
  },
  {
    id: 'parchment',
    glow: '#e6c068',
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
    glow: '#ffffff',
    name: { ar: 'بسيط', en: 'Minimal' },
    overlays: [
      { src: 'divider-07', cx: 50, cy: 13, w: 58 },
      { src: 'divider-07', cx: 50, cy: 84, w: 58 },
    ],
    ayah: { x: 5, y: 17, w: 90, h: 64, maxLines: 4 },
    surah: { cx: 50, cy: 6.5, w: 50, h: 7, color: '#f8e7b5' },
    reciter: { cx: 50, cy: 91.5, w: 50, h: 6, color: '#ffffff' },
  },
]);
