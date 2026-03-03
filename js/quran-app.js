/* =========================
   GLOBAL STATE
========================= */
let currentPage = 1;
const totalPages = 604;

const img = document.getElementById("pageImg");
const frame = document.getElementById("pageFrame");
const surahName = document.getElementById("surahName");
const pageMeta = document.getElementById("pageMeta");
const swipeArea = document.getElementById("swipeArea");
const bookmarkBtn = document.getElementById("bookmarkBtn");

let touchStartX = 0;
let tapTimeout = null;
let longPressTimer = null;
let bookmarks = new Set();

/* =========================
   INIT
========================= */
window.onload = function () {
  loadBookmarks();
  const saved = localStorage.getItem("lastPage");
  if (saved) currentPage = parseInt(saved);
  renderPage();
  initSwipe();
  initTapHandlers();
  initLongPress();
  updateBookmarkStar();
};

/* =========================
   RENDER PAGE
========================= */
function renderPage() {
  img.src = `mushaf/${currentPage}.png`;
  localStorage.setItem("lastPage", currentPage);
  updateSurahAndJuz();
  updateBookmarkStar();
}

/* =========================
   SURAH & JUZ AUTO UPDATE
========================= */
function updateSurahAndJuz() {
  const surah = SURAH_MAP.slice().reverse().find(s => currentPage >= s.page);
  const juz = JUZ_MAP.slice().reverse().find(j => currentPage >= j.page);

  surahName.innerText = surah ? "سورة " + surah.name : "";
  pageMeta.innerText = juz ? `الجزء ${juz.number} | صفحة ${currentPage}` : `صفحة ${currentPage}`;
}

/* =========================
   PAGE NAVIGATION
========================= */
function nextPage() {
  if (currentPage >= totalPages) return;
  frame.classList.add("swipe-next");
  setTimeout(() => {
    currentPage++;
    renderPage();
    frame.classList.remove("swipe-next");
  }, 200);
}

function prevPage() {
  if (currentPage <= 1) return;
  frame.classList.add("swipe-prev");
  setTimeout(() => {
    currentPage--;
    renderPage();
    frame.classList.remove("swipe-prev");
  }, 200);
}

function goToPage(pageNum) {
  if (pageNum < 1 || pageNum > totalPages) return;
  currentPage = pageNum;
  renderPage();
  closeModal('pageSelectorModal');
}

/* =========================
   SWIPE GESTURE (RTL)
========================= */
function initSwipe() {
  swipeArea.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  swipeArea.addEventListener("touchend", e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) < 50) return;

    if (diff > 0) {
      prevPage(); // left swipe → previous (RTL)
    } else {
      nextPage(); // right swipe → next
    }
  });
}

/* =========================
   TAP HANDLERS (single/double)
========================= */
function initTapHandlers() {
  swipeArea.addEventListener("touchend", e => {
    if (tapTimeout) {
      // double tap
      clearTimeout(tapTimeout);
      tapTimeout = null;
      document.body.classList.toggle("zoomed");
      e.preventDefault();
    } else {
      tapTimeout = setTimeout(() => {
        // single tap
        document.body.classList.toggle("focus-mode");
        tapTimeout = null;
      }, 250);
    }
  });
}

/* =========================
   LONG PRESS CONTEXT MENU
========================= */
function initLongPress() {
  swipeArea.addEventListener("touchstart", () => {
    longPressTimer = setTimeout(() => {
      openContextMenu();
    }, 500);
  });

  swipeArea.addEventListener("touchend", () => {
    clearTimeout(longPressTimer);
  });

  swipeArea.addEventListener("touchcancel", () => {
    clearTimeout(longPressTimer);
  });
}

function openContextMenu() {
  const surah = SURAH_MAP.slice().reverse().find(s => currentPage >= s.page);
  const juz = JUZ_MAP.slice().reverse().find(j => currentPage >= j.page);
  const info = `الصفحة ${currentPage} | ${surah ? 'سورة ' + surah.name : ''} | ${juz ? 'الجزء ' + juz.number : ''}`;
  document.getElementById('contextInfo').innerText = info;

  const bookmarkText = bookmarks.has(currentPage) ? '★ إزالة من المفضلة' : '☆ أضف للمفضلة';
  document.getElementById('contextBookmark').innerText = bookmarkText;

  document.getElementById('contextMenu').classList.add('active');
}

function closeContextMenu() {
  document.getElementById('contextMenu').classList.remove('active');
}

/* =========================
   BOOKMARKS
========================= */
function loadBookmarks() {
  const saved = localStorage.getItem('quranBookmarks');
  if (saved) {
    bookmarks = new Set(JSON.parse(saved));
  }
}

function saveBookmarks() {
  localStorage.setItem('quranBookmarks', JSON.stringify([...bookmarks]));
}

function toggleBookmark() {
  if (bookmarks.has(currentPage)) {
    bookmarks.delete(currentPage);
  } else {
    bookmarks.add(currentPage);
  }
  saveBookmarks();
  updateBookmarkStar();
  closeContextMenu();
}

function updateBookmarkStar() {
  if (bookmarks.has(currentPage)) {
    bookmarkBtn.innerText = '★';
    bookmarkBtn.classList.add('active');
  } else {
    bookmarkBtn.innerText = '☆';
    bookmarkBtn.classList.remove('active');
  }
}

function openBookmarksModal() {
  const list = document.getElementById('bookmarksList');
  list.innerHTML = '';
  if (bookmarks.size === 0) {
    list.innerHTML = '<div class="modal-item">لا توجد صفحات مفضلة</div>';
  } else {
    const sorted = [...bookmarks].sort((a,b) => a-b);
    sorted.forEach(page => {
      const div = document.createElement('div');
      div.className = 'modal-item';
      div.innerText = `صفحة ${page}`;
      div.onclick = () => {
        currentPage = page;
        renderPage();
        closeModal('bookmarksModal');
      };
      list.appendChild(div);
    });
  }
  openModal('bookmarksModal');
}

/* =========================
   MODALS
========================= */
function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

function openSettingsModal() {
  closeContextMenu();
  openModal('settingsModal');
}

function openPageSelector() {
  // populate grid
  const grid = document.getElementById('pageGrid');
  grid.innerHTML = '';
  for (let i = 1; i <= totalPages; i++) {
    const div = document.createElement('div');
    div.innerText = i;
    div.onclick = () => goToPage(i);
    grid.appendChild(div);
  }
  openModal('pageSelectorModal');
}

function openSurahSelector() {
  closeContextMenu();
  const modal = document.getElementById('settingsModal'); // reuse settings modal? Better to have a separate one, but for simplicity we'll use a new modal.
  // We'll create a surah selector modal on the fly or use a new overlay.
  // For brevity, we'll use the page selector modal but change content.
  // In a full version, you'd have a dedicated surah modal.
  alert('سيتم فتح قائمة السور قريبًا'); // Placeholder
}

function openJuzSelector() {
  closeContextMenu();
  alert('سيتم فتح قائمة الأجزاء قريبًا');
}

/* =========================
   SETTINGS
========================= */
function toggleTheme() {
  const body = document.body;
  if (body.getAttribute("data-theme") === "light") {
    body.setAttribute("data-theme", "dark");
  } else {
    body.setAttribute("data-theme", "light");
  }
}

async function cacheAllPages() {
  if (!('caches' in window)) {
    alert("المتصفح لا يدعم التخزين المؤقت");
    return;
  }

  const cache = await caches.open('quran-pages-v1');
  let loaded = 0;
  const total = totalPages;

  alert("جاري تخزين الصفحات... قد تستغرق بضع دقائق");

  for (let i = 1; i <= total; i++) {
    const url = `mushaf/${i}.png`;
    try {
      await cache.add(url);
      loaded++;
    } catch (err) {
      console.warn(`فشل تخزين الصفحة ${i}:`, err);
    }
  }

  alert(`تم تخزين ${loaded} من ${total} صفحة بنجاح`);
}

/* =========================
   PAGE SELECTOR INPUT
========================= */
function goToPage() {
  const input = document.getElementById('gotoPageInput');
  const page = parseInt(input.value);
  if (page && page >= 1 && page <= totalPages) {
    goToPage(page);
  } else {
    alert('رقم صفحة غير صحيح');
  }
}