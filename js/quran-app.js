/* =============================
   GLOBAL STATE
============================= */

let currentPage = 1;
const totalPages = 604;

const img = document.getElementById("pageImg");
const frame = document.getElementById("pageFrame");
const surahName = document.getElementById("surahName");
const pageMeta = document.getElementById("pageMeta");
const bookmarkBtn = document.getElementById("bookmarkBtn");
const reader = document.getElementById("reader");

const settingsPopup = document.getElementById("settingsPopup");
const selectorPopup = document.getElementById("selectorPopup");
const selectorContent = document.getElementById("selectorContent");

let touchStartX = 0;
let lastTap = 0;
let longPressTimer;

/* =============================
   INIT
============================= */

window.onload = function () {

    const saved = localStorage.getItem("lastPage");
    if (saved) currentPage = parseInt(saved);

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") document.body.classList.add("dark");

    renderPage();
    initSwipe();
    initGestures();
};

/* =============================
   RENDER PAGE
============================= */

function renderPage() {

    img.src = `mushaf/${currentPage}.png`;
    localStorage.setItem("lastPage", currentPage);

    updateMeta();
    updateBookmarkUI();
}

/* =============================
   META UPDATE
============================= */

function updateMeta() {

    const surah = SURAH_MAP.slice().reverse().find(s => currentPage >= s.page);
    const juz = JUZ_MAP.slice().reverse().find(j => currentPage >= j.page);

    if (surah) surahName.innerText = "سورة " + surah.name;
    if (juz) pageMeta.innerText = `الجزء ${juz.number} | صفحة ${currentPage}`;
}

/* =============================
   PAGE TRANSITION
============================= */

function nextPage() {
    if (currentPage >= totalPages) return;

    frame.classList.add("slide-next");

    setTimeout(() => {
        currentPage++;
        renderPage();
        frame.classList.remove("slide-next");
    }, 250);
}

function prevPage() {
    if (currentPage <= 1) return;

    frame.classList.add("slide-prev");

    setTimeout(() => {
        currentPage--;
        renderPage();
        frame.classList.remove("slide-prev");
    }, 250);
}

/* =============================
   SWIPE GESTURE
============================= */

function initSwipe() {

    reader.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    reader.addEventListener("touchend", e => {

        const diff = touchStartX - e.changedTouches[0].screenX;
        if (Math.abs(diff) < 50) return;

        if (diff > 0) nextPage();
        else prevPage();
    });
}

/* =============================
   TAP + ZOOM + LONG PRESS
============================= */

function initGestures() {

    reader.addEventListener("touchstart", () => {

        longPressTimer = setTimeout(() => {
            openContextMenu();
        }, 600);

    });

    reader.addEventListener("touchend", () => {

        clearTimeout(longPressTimer);

        const now = Date.now();
        const diff = now - lastTap;

        if (diff < 300) {
            document.body.classList.toggle("zoom");
        } else {
            document.body.classList.toggle("focus");
        }

        lastTap = now;
    });
}

/* =============================
   BOOKMARK SYSTEM
============================= */

function toggleBookmark() {

    let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if (bookmarks.includes(currentPage)) {
        bookmarks = bookmarks.filter(p => p !== currentPage);
    } else {
        bookmarks.push(currentPage);
    }

    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));
    updateBookmarkUI();
}

function updateBookmarkUI() {

    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if (bookmarks.includes(currentPage))
        bookmarkBtn.classList.add("bookmarked");
    else
        bookmarkBtn.classList.remove("bookmarked");
}

function openBookmarks() {

    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    selectorContent.innerHTML = "<h3>العلامات المرجعية</h3>";

    if (bookmarks.length === 0) {
        selectorContent.innerHTML += "<p>لا توجد علامات محفوظة</p>";
    }

    bookmarks.sort((a,b)=>a-b).forEach(page => {

        const div = document.createElement("div");
        div.innerText = "صفحة " + page;

        div.onclick = () => {
            currentPage = page;
            renderPage();
            closePopup();
        };

        selectorContent.appendChild(div);
    });

    selectorPopup.classList.add("active");
}

/* =============================
   SELECTORS
============================= */

function openSurahSelector() {

    selectorContent.innerHTML = "<h3>اختر سورة</h3>";

    SURAH_MAP.forEach(s => {

        const div = document.createElement("div");
        div.innerText = s.number + " - " + s.name;

        div.onclick = () => {
            currentPage = s.page;
            renderPage();
            closePopup();
        };

        selectorContent.appendChild(div);
    });

    selectorPopup.classList.add("active");
}

function openPageSelector() {

    selectorContent.innerHTML = `
        <h3>اذهب إلى صفحة</h3>
        <input id="pageInput" type="number" min="1" max="604" style="width:100%;padding:10px;border-radius:10px;">
        <button onclick="goToPage()">انتقال</button>
    `;

    selectorPopup.classList.add("active");
}

function goToPage() {

    const value = parseInt(document.getElementById("pageInput").value);
    if (value >= 1 && value <= 604) {
        currentPage = value;
        renderPage();
        closePopup();
    }
}

/* =============================
   SETTINGS
============================= */

function openSettings() {
    settingsPopup.classList.add("active");
}

function closePopup() {
    settingsPopup.classList.remove("active");
    selectorPopup.classList.remove("active");
}

/* =============================
   THEME
============================= */

function toggleTheme() {

    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark"))
        localStorage.setItem("theme", "dark");
    else
        localStorage.setItem("theme", "light");
}

/* =============================
   DOWNLOAD ALL
============================= */

function downloadAllPages() {

    alert("جاري تحميل جميع الصفحات...");

    let loaded = 0;

    for (let i = 1; i <= 604; i++) {

        const preload = new Image();
        preload.src = `mushaf/${i}.png`;

        preload.onload = () => {
            loaded++;
            if (loaded === 604) alert("تم تحميل جميع الصفحات");
        };
    }
}

/* =============================
   CUSTOM LONG PRESS MENU
============================= */

function openContextMenu() {

    selectorContent.innerHTML = `
        <h3>خيارات</h3>
        <div onclick="toggleBookmark()">إضافة / إزالة علامة</div>
        <div onclick="openPageSelector()">اذهب إلى صفحة</div>
        <div onclick="openSurahSelector()">اذهب إلى سورة</div>
        <div onclick="openBookmarks()">العلامات المرجعية</div>
        <div onclick="openSettings()">الإعدادات</div>
        <p style="margin-top:15px;font-size:13px;opacity:.7;">
        أنت الآن في صفحة ${currentPage}
        </p>
    `;

    selectorPopup.classList.add("active");
}