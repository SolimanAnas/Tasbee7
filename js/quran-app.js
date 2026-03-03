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
let lastTap = 0;

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

    if (surah) surahName.innerText = "سورة " + surah.name;
    if (juz) pageMeta.innerText = "الجزء " + juz.number + " | صفحة " + currentPage;
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
   SWIPE GESTURE
========================= */

function initSwipe() {

    swipeArea.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    swipeArea.addEventListener("touchend", e => {

        const diff = touchStartX - e.changedTouches[0].screenX;

        if (Math.abs(diff) < 50) return;

        if (diff > 0) {
            nextPage();   // RTL correct
        } else {
            prevPage();
        }
    });
}

/* =========================
   TAP HANDLERS
========================= */

function initTapHandlers() {

    swipeArea.addEventListener("touchend", function () {

        const now = new Date().getTime();
        const tapLength = now - lastTap;

        // DOUBLE TAP = ZOOM
        if (tapLength < 300 && tapLength > 0) {
            document.body.classList.toggle("zoomed");
        }

        lastTap = now;
    });

    // SINGLE TAP = FOCUS MODE
    swipeArea.addEventListener("click", () => {
        document.body.classList.toggle("focus-mode");
    });
}

/* =========================
   SURAH SELECTOR
========================= */

function openSurahSelector() {

    selectorPanel.innerHTML = "<h3>اختر سورة</h3>";

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
}

/* =========================
   JUZ SELECTOR
========================= */

function openJuzSelector() {

    selectorPanel.innerHTML = "<h3>اختر جزء</h3>";

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
}

/* =========================
   SETTINGS PANEL
========================= */

function openSettings() {
    settingsPanel.classList.add("open");
}

function closePanels() {
    selectorPanel.classList.remove("open");
    settingsPanel.classList.remove("open");
}

/* =========================
   THEME
========================= */

function toggleTheme() {

    if (document.body.getAttribute("data-theme") === "dark") {
        document.body.setAttribute("data-theme", "light");
    } else {
        document.body.setAttribute("data-theme", "dark");
    }
}

/* =========================
   DOWNLOAD ALL PAGES
========================= */

function downloadAllPages() {

    alert("جاري تحميل جميع الصفحات...");

    let loaded = 0;

    for (let i = 1; i <= 604; i++) {

        const preload = new Image();
        preload.src = `mushaf/${i}.png`;

        preload.onload = () => {
            loaded++;
            if (loaded === 604) {
                alert("تم تحميل جميع الصفحات بنجاح");
            }
        };
    }
}