/* =========================
   GLOBAL STATE
========================= */
let currentPage = 1;
const totalPages = 604;

const img = document.getElementById("pageImg");
const frame = document.getElementById("pageFrame");
const surahName = document.getElementById("surahName");
const pageMeta = document.getElementById("pageMeta");
const selectorPanel = document.getElementById("selectorPanel");
const settingsPanel = document.getElementById("settingsPanel");
const swipeArea = document.getElementById("swipeArea");

let touchStartX = 0;
let tapTimeout = null;

/* =========================
   INIT
========================= */
window.onload = function () {
  const saved = localStorage.getItem("lastPage");
  if (saved) currentPage = parseInt(saved);
  renderPage();
  initSwipe();
  initTapHandlers();
};

/* =========================
   RENDER PAGE
========================= */
function renderPage() {
  img.src = `mushaf/${currentPage}.png`;
  localStorage.setItem("lastPage", currentPage);
  updateSurahAndJuz();
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
   SIMPLE PERSPECTIVE SWIPE
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

/* =========================
   SWIPE GESTURE (RTL fixed)
========================= */
function initSwipe() {
  swipeArea.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
  });

  swipeArea.addEventListener("touchend", e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) < 50) return;

    if (diff > 0) {
      // swipe left → previous page (RTL)
      prevPage();
    } else {
      // swipe right → next page
      nextPage();
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
      // prevent single tap from firing
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
   SURAH SELECTOR
========================= */
function openSurahSelector() {
  selectorPanel.innerHTML = "<h3>اختر سورة <button class='close-btn' onclick='closePanels()'>✕</button></h3>";
  SURAH_MAP.forEach(s => {
    const div = document.createElement("div");
    div.innerText = s.number + " - " + s.name;
    div.onclick = () => {
      currentPage = s.page;
      renderPage();
      closePanels();
    };
    selectorPanel.appendChild(div);
  });
  selectorPanel.classList.add("open");
  settingsPanel.classList.remove("open");
}

/* =========================
   JUZ SELECTOR
========================= */
function openJuzSelector() {
  selectorPanel.innerHTML = "<h3>اختر جزء <button class='close-btn' onclick='closePanels()'>✕</button></h3>";
  JUZ_MAP.forEach(j => {
    const div = document.createElement("div");
    div.innerText = "الجزء " + j.number;
    div.onclick = () => {
      currentPage = j.page;
      renderPage();
      closePanels();
    };
    selectorPanel.appendChild(div);
  });
  selectorPanel.classList.add("open");
  settingsPanel.classList.remove("open");
}

/* =========================
   SETTINGS PANEL
========================= */
function openSettings() {
  settingsPanel.classList.add("open");
  selectorPanel.classList.remove("open");
}

function closePanels() {
  selectorPanel.classList.remove("open");
  settingsPanel.classList.remove("open");
}

/* =========================
   THEME TOGGLE
========================= */
function toggleTheme() {
  const body = document.body;
  if (body.getAttribute("data-theme") === "dark") {
    body.setAttribute("data-theme", "light");
  } else {
    body.setAttribute("data-theme", "dark");
  }
}

/* =========================
   OFFLINE CACHING (Cache API)
========================= */
async function cacheAllPages() {
  if (!('caches' in window)) {
    alert("المتصفح لا يدعم التخزين المؤقت");
    return;
  }

  const cache = await caches.open('quran-pages-v1');
  let loaded = 0;
  const total = totalPages;

  // Show progress (simple alert loop – you can improve this)
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