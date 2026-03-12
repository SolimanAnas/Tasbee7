// quran-common.js
// Shared logic for Quran viewer (image and text modes)

// ============================================================
//  DATA — SURAH MAP & JUZ MAP
// ============================================================
const SURAH_MAP = [
  { number:   1, name: 'الفاتحة',   page:   1 },
  { number:   2, name: 'البقرة',    page:   2 },
  { number:   3, name: 'آل عمران', page:  50 },
  { number:   4, name: 'النساء',    page:  77 },
  { number:   5, name: 'المائدة',   page: 106 },
  { number:   6, name: 'الأنعام',   page: 128 },
  { number:   7, name: 'الأعراف',   page: 151 },
  { number:   8, name: 'الأنفال',   page: 177 },
  { number:   9, name: 'التوبة',    page: 187 },
  { number:  10, name: 'يونس',      page: 208 },
  { number:  11, name: 'هود',       page: 221 },
  { number:  12, name: 'يوسف',      page: 235 },
  { number:  13, name: 'الرعد',     page: 249 },
  { number:  14, name: 'إبراهيم',   page: 255 },
  { number:  15, name: 'الحجر',     page: 262 },
  { number:  16, name: 'النحل',     page: 267 },
  { number:  17, name: 'الإسراء',   page: 282 },
  { number:  18, name: 'الكهف',     page: 293 },
  { number:  19, name: 'مريم',      page: 305 },
  { number:  20, name: 'طه',        page: 312 },
  { number:  21, name: 'الأنبياء',  page: 322 },
  { number:  22, name: 'الحج',      page: 332 },
  { number:  23, name: 'المؤمنون',  page: 342 },
  { number:  24, name: 'النور',     page: 350 },
  { number:  25, name: 'الفرقان',   page: 359 },
  { number:  26, name: 'الشعراء',   page: 367 },
  { number:  27, name: 'النمل',     page: 377 },
  { number:  28, name: 'القصص',     page: 385 },
  { number:  29, name: 'العنكبوت',  page: 396 },
  { number:  30, name: 'الروم',     page: 404 },
  { number:  31, name: 'لقمان',     page: 411 },
  { number:  32, name: 'السجدة',    page: 415 },
  { number:  33, name: 'الأحزاب',   page: 418 },
  { number:  34, name: 'سبإ',       page: 428 },
  { number:  35, name: 'فاطر',      page: 434 },
  { number:  36, name: 'يس',        page: 440 },
  { number:  37, name: 'الصافات',   page: 446 },
  { number:  38, name: 'ص',         page: 453 },
  { number:  39, name: 'الزمر',     page: 458 },
  { number:  40, name: 'غافر',      page: 467 },
  { number:  41, name: 'فصلت',      page: 477 },
  { number:  42, name: 'الشورى',    page: 483 },
  { number:  43, name: 'الزخرف',    page: 489 },
  { number:  44, name: 'الدخان',    page: 496 },
  { number:  45, name: 'الجاثية',   page: 499 },
  { number:  46, name: 'الأحقاف',   page: 502 },
  { number:  47, name: 'محمد',      page: 507 },
  { number:  48, name: 'الفتح',     page: 511 },
  { number:  49, name: 'الحجرات',   page: 515 },
  { number:  50, name: 'ق',         page: 518 },
  { number:  51, name: 'الذاريات',  page: 520 },
  { number:  52, name: 'الطور',     page: 523 },
  { number:  53, name: 'النجم',     page: 526 },
  { number:  54, name: 'القمر',     page: 528 },
  { number:  55, name: 'الرحمن',    page: 531 },
  { number:  56, name: 'الواقعة',   page: 534 },
  { number:  57, name: 'الحديد',    page: 537 },
  { number:  58, name: 'المجادلة',  page: 542 },
  { number:  59, name: 'الحشر',     page: 545 },
  { number:  60, name: 'الممتحنة',  page: 549 },
  { number:  61, name: 'الصف',      page: 551 },
  { number:  62, name: 'الجمعة',    page: 553 },
  { number:  63, name: 'المنافقون', page: 554 },
  { number:  64, name: 'التغابن',   page: 556 },
  { number:  65, name: 'الطلاق',    page: 558 },
  { number:  66, name: 'التحريم',   page: 560 },
  { number:  67, name: 'الملك',     page: 562 },
  { number:  68, name: 'القلم',     page: 564 },
  { number:  69, name: 'الحاقة',    page: 566 },
  { number:  70, name: 'المعارج',   page: 568 },
  { number:  71, name: 'نوح',       page: 570 },
  { number:  72, name: 'الجن',      page: 572 },
  { number:  73, name: 'المزمل',    page: 574 },
  { number:  74, name: 'المدثر',    page: 575 },
  { number:  75, name: 'القيامة',   page: 577 },
  { number:  76, name: 'الإنسان',   page: 578 },
  { number:  77, name: 'المرسلات',  page: 580 },
  { number:  78, name: 'النبأ',     page: 582 },
  { number:  79, name: 'النازعات',  page: 583 },
  { number:  80, name: 'عبس',       page: 585 },
  { number:  81, name: 'التكوير',   page: 586 },
  { number:  82, name: 'الإنفطار',  page: 587 },
  { number:  83, name: 'المطففين',  page: 587 },
  { number:  84, name: 'الإنشقاق',  page: 589 },
  { number:  85, name: 'البروج',    page: 590 },
  { number:  86, name: 'الطارق',    page: 591 },
  { number:  87, name: 'الأعلى',    page: 591 },
  { number:  88, name: 'الغاشية',   page: 592 },
  { number:  89, name: 'الفجر',     page: 593 },
  { number:  90, name: 'البلد',     page: 594 },
  { number:  91, name: 'الشمس',     page: 595 },
  { number:  92, name: 'الليل',     page: 595 },
  { number:  93, name: 'الضحى',     page: 596 },
  { number:  94, name: 'الشرح',     page: 596 },
  { number:  95, name: 'التين',     page: 597 },
  { number:  96, name: 'العلق',     page: 597 },
  { number:  97, name: 'القدر',     page: 598 },
  { number:  98, name: 'البينة',    page: 598 },
  { number:  99, name: 'الزلزلة',   page: 599 },
  { number: 100, name: 'العاديات',  page: 599 },
  { number: 101, name: 'القارعة',   page: 600 },
  { number: 102, name: 'التكاثر',   page: 600 },
  { number: 103, name: 'العصر',     page: 601 },
  { number: 104, name: 'الهمزة',    page: 601 },
  { number: 105, name: 'الفيل',     page: 601 },
  { number: 106, name: 'قريش',      page: 602 },
  { number: 107, name: 'الماعون',   page: 602 },
  { number: 108, name: 'الكوثر',    page: 602 },
  { number: 109, name: 'الكافرون',  page: 603 },
  { number: 110, name: 'النصر',     page: 603 },
  { number: 111, name: 'المسد',     page: 603 },
  { number: 112, name: 'الإخلاص',   page: 604 },
  { number: 113, name: 'الفلق',     page: 604 },
  { number: 114, name: 'الناس',     page: 604 }
];

const JUZ_MAP = [
  { number:  1, page:   1 }, { number:  2, page:  22 },
  { number:  3, page:  42 }, { number:  4, page:  62 },
  { number:  5, page:  82 }, { number:  6, page: 102 },
  { number:  7, page: 122 }, { number:  8, page: 142 },
  { number:  9, page: 162 }, { number: 10, page: 182 },
  { number: 11, page: 202 }, { number: 12, page: 222 },
  { number: 13, page: 242 }, { number: 14, page: 262 },
  { number: 15, page: 282 }, { number: 16, page: 302 },
  { number: 17, page: 322 }, { number: 18, page: 342 },
  { number: 19, page: 362 }, { number: 20, page: 382 },
  { number: 21, page: 402 }, { number: 22, page: 422 },
  { number: 23, page: 442 }, { number: 24, page: 462 },
  { number: 25, page: 482 }, { number: 26, page: 502 },
  { number: 27, page: 522 }, { number: 28, page: 542 },
  { number: 29, page: 562 }, { number: 30, page: 582 }
];

// ============================================================
//  GLOBAL STATE
// ============================================================
let currentPage      = 1;
const totalPages     = 604;
let bookmarks        = new Set();
let isTransitioning  = false;
let fullView         = false;

// DOM references (will be set by each HTML)
const img         = document.getElementById('pageImg');       // may be null in text mode
const textContainer = document.getElementById('textContainer'); // may be null in image mode
const frame       = document.getElementById('pageFrame');
const swipeArea   = document.getElementById('swipeArea');
const surahName   = document.getElementById('surahName');
const juzName     = document.getElementById('juzName');
const pageName    = document.getElementById('pageName');
const bookmarkBtn = document.getElementById('bookmarkBtn');

// Helper functions
const getCurrentSurah = () => [...SURAH_MAP].reverse().find(s => currentPage >= s.page);
const getCurrentJuz   = () => [...JUZ_MAP].reverse().find(j => currentPage >= j.page);

// ============================================================
//  RENDER PLACEHOLDER (to be overridden by mode-specific code)
// ============================================================
function updateContent() {
    console.warn('updateContent() not implemented in this mode');
}

// ============================================================
//  META UPDATE
// ============================================================
function updateMeta() {
  const surah = getCurrentSurah();
  const juz   = getCurrentJuz();
  surahName.textContent = surah ? 'سورة ' + surah.name : '';
  juzName.textContent   = juz ? `الجزء ${juz.number}` : '';
  pageName.textContent  = `صفحة ${currentPage}`;
}

// ============================================================
//  PAGE NAVIGATION
// ============================================================
function navigateTo(newPage, direction) {
  if (isTransitioning) return;
  if (newPage < 1 || newPage > totalPages) return;
  if (newPage === currentPage) return;

  isTransitioning = true;

  const CB   = 'cubic-bezier(0.22, 1, 0.36, 1)';
  const DUR  = '0.28s';
  const TRANS = `transform ${DUR} ${CB}, opacity ${DUR} ${CB}`;

  const exitX  = direction === 'next' ? '30%'  : '-30%';
  const enterX = direction === 'next' ? '-30%' : '30%';

  frame.style.transition = TRANS;
  frame.style.transform  = `translateX(${exitX})`;
  frame.style.opacity    = '0';

  setTimeout(() => {
    currentPage = newPage;
    updateContent(); // mode-specific rendering
    localStorage.setItem('lastPage', currentPage);

    frame.style.transition = 'none';
    frame.style.transform  = `translateX(${enterX})`;
    frame.style.opacity    = '0';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        frame.style.transition = TRANS;
        frame.style.transform  = 'translateX(0)';
        frame.style.opacity    = '1';

        setTimeout(() => {
          frame.style.cssText  = '';
          isTransitioning = false;
          preloadAdjacentPages();
        }, 300);
      });
    });
  }, 260);
}

function nextPage() { navigateTo(currentPage + 1, 'next'); }
function prevPage() { navigateTo(currentPage - 1, 'prev'); }

function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages) return;
  const dir = pageNum > currentPage ? 'next' : 'prev';
  navigateTo(pageNum, dir);
}

function preloadAdjacentPages() {
  // Can be overridden by mode if needed; default for image mode.
  if (img && img.style.display !== 'none') {
    if (currentPage > 1)          new Image().src = `mushaf/${currentPage - 1}.png`;
    if (currentPage < totalPages) new Image().src = `mushaf/${currentPage + 1}.png`;
  }
}

// ============================================================
//  GESTURE HANDLER (swipe, long press, double tap)
// ============================================================
function initGestures() {
  const LONG_PRESS_MS      = 600;
  const SWIPE_THRESHOLD    = 48;   
  const MOVE_CANCEL_THRES  = 10;   
  const DOUBLE_TAP_MS      = 280;  

  let startX       = 0, startY = 0;
  let didMove      = false;
  let lpFired      = false;
  let lastTapTime  = 0;
  let tapTimer     = null;
  let lpTimer      = null;

  swipeArea.addEventListener('touchstart', e => {
    const t = e.changedTouches[0];
    startX   = t.clientX;
    startY   = t.clientY;
    didMove  = false;
    lpFired  = false;
    clearTimeout(lpTimer);

    lpTimer = setTimeout(() => {
      if (!didMove) {
        lpFired = true;
        openContextMenu();
      }
    }, LONG_PRESS_MS);
  }, { passive: true });

  swipeArea.addEventListener('touchmove', e => {
    if (didMove) return;
    const t  = e.changedTouches[0];
    const dx = Math.abs(t.clientX - startX);
    const dy = Math.abs(t.clientY - startY);
    if (dx > MOVE_CANCEL_THRES || dy > MOVE_CANCEL_THRES) {
      didMove = true;
      clearTimeout(lpTimer);
    }
  }, { passive: true });

  swipeArea.addEventListener('touchend', e => {
    clearTimeout(lpTimer);

    if (lpFired) return;

    const t    = e.changedTouches[0];
    const dx   = t.clientX - startX;
    const dy   = Math.abs(t.clientY - startY);
    const absDx = Math.abs(dx);

    if (didMove && absDx > SWIPE_THRESHOLD && absDx > dy) {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = null; }
      lastTapTime = 0;

      if (dx < 0) prevPage();
      else        nextPage();
      return;
    }

    if (!didMove) {
      const now           = Date.now();
      const sinceLastTap  = now - lastTapTime;

      if (sinceLastTap < DOUBLE_TAP_MS && tapTimer !== null) {
        clearTimeout(tapTimer);
        tapTimer    = null;
        lastTapTime = 0;

        fullView = !fullView;
        document.body.classList.toggle('full-view', fullView);
        localStorage.setItem('quranFullView', fullView);

      } else {
        lastTapTime = now;
        if (tapTimer) clearTimeout(tapTimer);
        tapTimer = setTimeout(() => {
          tapTimer = null;
          document.body.classList.toggle('focus-mode');
        }, DOUBLE_TAP_MS);
      }
    }
  });

  swipeArea.addEventListener('touchcancel', () => {
    clearTimeout(lpTimer);
    clearTimeout(tapTimer);
    tapTimer = null;
    lpFired  = false;
  });
}

function disableNativeLongPress() {
  if (img) {
    img.addEventListener('contextmenu',  e => e.preventDefault());
    img.style.webkitTouchCallout = 'none';
  }
  swipeArea.addEventListener('contextmenu', e => e.preventDefault());
}

// ============================================================
//  CONTEXT MENU
// ============================================================
function openContextMenu() {
  const surah = getCurrentSurah();
  const juz   = getCurrentJuz();

  document.getElementById('contextInfo').innerHTML =
    `<strong>صفحة ${currentPage}</strong><br>` +
    (surah ? `سورة ${surah.name}` : '') +
    (juz   ? ` | الجزء ${juz.number}` : '');

  const isBookmarked = bookmarks.has(currentPage);
  const btn = document.getElementById('contextBookmarkBtn');
  btn.textContent = isBookmarked ? '★ إزالة من المفضلة' : '☆ إضافة للمفضلة';
  btn.style.color = isBookmarked ? '#f5b342' : '';

  document.getElementById('contextMenu').classList.add('active');
  document.getElementById('contextOverlay').style.display = 'block';
}

function closeContextMenu() {
  document.getElementById('contextMenu').classList.remove('active');
  document.getElementById('contextOverlay').style.display = 'none';
}

function contextToggleBookmark() {
  toggleBookmark();
  closeContextMenu();
}

// ============================================================
//  BOOKMARKS
// ============================================================
function loadBookmarks() {
  try {
    const saved = localStorage.getItem('quranBookmarks');
    bookmarks = saved ? new Set(JSON.parse(saved)) : new Set();
  } catch { bookmarks = new Set(); }
}

function saveBookmarks() {
  localStorage.setItem('quranBookmarks', JSON.stringify([...bookmarks]));
}

function toggleBookmark() {
  if (bookmarks.has(currentPage)) bookmarks.delete(currentPage);
  else bookmarks.add(currentPage);
  saveBookmarks();
  updateBookmarkStar();
}

function updateBookmarkStar() {
  if (bookmarkBtn) bookmarkBtn.classList.toggle('active', bookmarks.has(currentPage));
}

function openBookmarksModal() {
  closeModal('settingsModal');
  const list = document.getElementById('bookmarksList');
  list.innerHTML = '';

  if (bookmarks.size === 0) {
    list.innerHTML = '<div class="empty-state">لا توجد صفحات في المفضلة</div>';
  } else {
    [...bookmarks].sort((a, b) => a - b).forEach(page => {
      const surah = [...SURAH_MAP].reverse().find(s => page >= s.page);
      const juz   = [...JUZ_MAP].reverse().find(j => page >= j.page);

      const div = document.createElement('div');
      div.className = 'bookmark-item';
      div.innerHTML = `
        <div class="bm-page">صفحة ${page}</div>
        <div class="bm-surah">
          ${surah ? 'سورة ' + surah.name : ''}
          ${juz   ? ' | الجزء ' + juz.number : ''}
        </div>`;

      div.onclick = () => {
        goToPage(page);
        closeModal('bookmarksModal');
      };
      list.appendChild(div);
    });
  }
  openModal('bookmarksModal');
}

// ============================================================
//  SURAH SELECTOR
// ============================================================
function openSurahSelector() {
  closeContextMenu();
  const searchEl = document.getElementById('surahSearch');
  if (searchEl) searchEl.value = '';
  buildSurahList(SURAH_MAP);
  openModal('surahSelectorModal');
  setTimeout(() => { if (searchEl) searchEl.focus(); }, 200);
}

function buildSurahList(surahs) {
  const list = document.getElementById('surahList');
  list.innerHTML = '';

  if (surahs.length === 0) {
    list.innerHTML = '<div class="empty-state">لا توجد نتائج</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  surahs.forEach(s => {
    const div = document.createElement('div');
    div.className = 'selector-item';
    div.innerHTML = `
      <span class="num-badge">${s.number}</span>
      <span class="name">سورة ${s.name}</span>
      <span class="page-tag">ص ${s.page}</span>`;

    div.onclick = () => {
      goToPage(s.page);
      closeModal('surahSelectorModal');
    };
    fragment.appendChild(div);
  });
  list.appendChild(fragment);
}

function filterSurahs(query) {
  const q = query.trim();
  if (!q) { buildSurahList(SURAH_MAP); return; }
  const filtered = SURAH_MAP.filter(s =>
    s.name.includes(q) ||
    s.number.toString().includes(q)
  );
  buildSurahList(filtered);
}

// ============================================================
//  JUZ SELECTOR
// ============================================================
function openJuzSelector() {
  closeContextMenu();
  const list = document.getElementById('juzList');
  list.innerHTML = '';

  const fragment = document.createDocumentFragment();
  JUZ_MAP.forEach(j => {
    const surah = [...SURAH_MAP].reverse().find(s => j.page >= s.page);

    const div = document.createElement('div');
    div.className = 'selector-item';
    div.innerHTML = `
      <span class="num-badge">${j.number}</span>
      <span class="name">الجزء ${j.number}${surah ? ' — ' + surah.name : ''}</span>
      <span class="page-tag">ص ${j.page}</span>`;

    div.onclick = () => {
      goToPage(j.page);
      closeModal('juzSelectorModal');
    };
    fragment.appendChild(div);
  });
  list.appendChild(fragment);
  openModal('juzSelectorModal');
}

// ============================================================
//  PAGE SELECTOR MODAL (WHEEL PICKER)
// ============================================================
let lastActivePickerIndex = -1;

function initPageRoller() {
  const scroll = document.getElementById('pagePickerScroll');
  if (!scroll) return; // modal might not exist in all modes? but we keep it.
  scroll.innerHTML = '';
  
  const topSpacer = document.createElement('div');
  topSpacer.style.height = '50px';
  scroll.appendChild(topSpacer);

  for(let i = 1; i <= totalPages; i++) {
    const div = document.createElement('div');
    div.className = 'picker-item';
    div.id = 'picker-item-' + i;
    div.textContent = i;
    div.onclick = () => { scroll.scrollTop = (i - 1) * 50; };
    scroll.appendChild(div);
  }

  const botSpacer = document.createElement('div');
  botSpacer.style.height = '50px';
  scroll.appendChild(botSpacer);
}

function openPageSelector() {
  closeContextMenu();
  openModal('pageSelectorModal');
  
  setTimeout(() => {
    const scroll = document.getElementById('pagePickerScroll');
    scroll.scrollTop = (currentPage - 1) * 50;
    updatePickerInput();
  }, 10);
}

function updatePickerInput() {
  const scroll = document.getElementById('pagePickerScroll');
  if (!scroll) return;
  let index = Math.round(scroll.scrollTop / 50) + 1;
  
  if (index < 1) index = 1;
  if (index > totalPages) index = totalPages;

  const input = document.getElementById('gotoPageInput');
  if (input) input.value = index;

  if (index !== lastActivePickerIndex) {
    if (lastActivePickerIndex !== -1) {
      const oldItem = document.getElementById('picker-item-' + lastActivePickerIndex);
      if (oldItem) oldItem.classList.remove('active');
    }
    const newItem = document.getElementById('picker-item-' + index);
    if (newItem) newItem.classList.add('active');
    
    lastActivePickerIndex = index;
  }
}

function syncPickerWithInput() {
  let val = parseInt(document.getElementById('gotoPageInput').value);
  if (val >= 1 && val <= totalPages) {
    const scroll = document.getElementById('pagePickerScroll');
    scroll.scrollTop = (val - 1) * 50;
  }
}

function confirmPageSelection() {
  const page = parseInt(document.getElementById('gotoPageInput').value);
  if (page >= 1 && page <= totalPages) {
    goToPage(page);
    closeModal('pageSelectorModal');
  }
}

// ============================================================
//  MODAL SYSTEM
// ============================================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function handleOverlayClick(event, modalId) {
  if (event.target === document.getElementById(modalId)) {
    closeModal(modalId);
  }
}

function openSettingsModal() {
  closeContextMenu();
  openModal('settingsModal');
}

// ============================================================
//  CACHING (image pages)
// ============================================================
async function cacheAllPages() {
  closeModal('settingsModal');
  if (!('caches' in window)) {
    alert('المتصفح لا يدعم التخزين المؤقت');
    return;
  }
  alert('جاري تخزين الصفحات للاستخدام بدون إنترنت...\nقد يستغرق ذلك بضع دقائق.');
  const cache  = await caches.open('quran-mushaf-v1');
  let loaded   = 0;

  for (let i = 1; i <= totalPages; i++) {
    try {
      await cache.add(`mushaf/${i}.png`);
      loaded++;
    } catch (err) {
      console.warn(`فشل تخزين الصفحة ${i}:`, err);
    }
  }
  alert(`✓ تم تخزين ${loaded} من ${totalPages} صفحة بنجاح`);
}

// ============================================================
//  INITIALISATION (to be called by mode-specific scripts)
// ============================================================
function commonInit() {
  // load last page
  const savedPage = parseInt(localStorage.getItem('lastPage'));
  if (savedPage && savedPage >= 1 && savedPage <= totalPages) {
    currentPage = savedPage;
  }

  loadBookmarks();

  // full-view setting
  fullView = localStorage.getItem('quranFullView') === 'true';
  if (fullView) document.body.classList.add('full-view');

  // initial render (mode-specific updateContent will be called after)
  // We'll call updateContent from the mode's own onload, not here.

  // gesture init
  initGestures();
  disableNativeLongPress();

  // page roller init
  initPageRoller();

  // preload adjacent if needed
  preloadAdjacentPages();
}