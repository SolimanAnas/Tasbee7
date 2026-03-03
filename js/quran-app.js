/* ================= GLOBAL STATE ================= */

let currentPage = 1;
const totalPages = 604;

const img = document.getElementById("pageImg");
const frame = document.getElementById("pageFrame");
const surahName = document.getElementById("surahName");
const pageMeta = document.getElementById("pageMeta");
const selectorPanel = document.getElementById("selectorPanel");
const tafsirPanel = document.getElementById("tafsirPanel");
const dimLayer = document.getElementById("dimLayer");
const bookmarkLabel = document.getElementById("bookmarkLabel");
const progressBar = document.getElementById("progressBar");

let touchStartX = 0;
let zoomMode = false;

/* ================= INIT ================= */

window.onload = function () {

    const savedPage = localStorage.getItem("lastPage");
    if (savedPage) currentPage = parseInt(savedPage);

    renderPage();
    initSwipe();
    initDoubleTap();
};

/* ================= PAGE RENDER ================= */

function renderPage() {

    img.src = `mushaf/${currentPage}.png`;

    localStorage.setItem("lastPage", currentPage);

    updateSurahAndJuz();
    updateProgress();
    updateBookmarkIndicator();
}

/* ================= SURAH + JUZ ================= */

function updateSurahAndJuz() {

    const surah = SURAH_MAP.slice().reverse().find(s => currentPage >= s.page);
    const juz = JUZ_MAP.slice().reverse().find(j => currentPage >= j.page);

    if (surah) surahName.innerText = "سورة " + surah.name;
    if (juz) pageMeta.innerText = "الجزء " + juz.number + " | صفحة " + currentPage;
}

/* ================= CURL ANIMATION ================= */

function nextPage() {

    if (currentPage >= totalPages) return;

    frame.classList.add("curl-next");

    setTimeout(() => {
        currentPage++;
        renderPage();
        frame.classList.remove("curl-next");
    }, 250);
}

function prevPage() {

    if (currentPage <= 1) return;

    frame.classList.add("curl-prev");

    setTimeout(() => {
        currentPage--;
        renderPage();
        frame.classList.remove("curl-prev");
    }, 250);
}

/* ================= SWIPE ================= */

function initSwipe() {

    const swipeArea = document.getElementById("swipeArea");

    swipeArea.addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].screenX;
    });

    swipeArea.addEventListener("touchend", e => {

        const diff = touchStartX - e.changedTouches[0].screenX;

        if (Math.abs(diff) < 50) return;

        if (diff > 0) {
            prevPage();   // RTL correct
        } else {
            nextPage();
        }
    });
}

/* ================= DOUBLE TAP ZOOM ================= */

function initDoubleTap() {

    let lastTap = 0;

    document.getElementById("swipeArea").addEventListener("touchend", function (e) {

        const currentTime = new Date().getTime();
        const tapLength = currentTime - lastTap;

        if (tapLength < 300 && tapLength > 0) {

            zoomMode = !zoomMode;

            if (zoomMode) {
                document.body.classList.add("zoomed");
            } else {
                document.body.classList.remove("zoomed");
            }
        }

        lastTap = currentTime;
    });
}

/* ================= BOOKMARK ================= */

function toggleBookmark() {

    let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if (bookmarks.includes(currentPage)) {
        bookmarks = bookmarks.filter(p => p !== currentPage);
    } else {
        bookmarks.push(currentPage);
    }

    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    updateBookmarkIndicator();
}

function updateBookmarkIndicator() {

    const bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if (bookmarks.includes(currentPage)) {
        bookmarkLabel.classList.add("visible");
    } else {
        bookmarkLabel.classList.remove("visible");
    }
}

/* ================= READING PROGRESS ================= */

function updateProgress() {

    let stats = JSON.parse(localStorage.getItem("readingStats") || "{}");

    stats[currentPage] = true;

    localStorage.setItem("readingStats", JSON.stringify(stats));

    const readCount = Object.keys(stats).length;
    const percent = Math.floor((readCount / totalPages) * 100);

    progressBar.style.width = percent + "%";
}

/* ================= DIM MODE ================= */

function toggleDim() {

    if (dimLayer.style.background === "rgba(0,0,0,0.5)") {
        dimLayer.style.background = "rgba(0,0,0,0)";
    } else {
        dimLayer.style.background = "rgba(0,0,0,0.5)";
    }
}

/* ================= SELECTORS ================= */

function openSurahSelector() {

    selectorPanel.innerHTML = "<h3>اختر سورة</h3>";

    SURAH_MAP.forEach(s => {

        const div = document.createElement("div");
        div.innerText = s.name;
        div.style.padding = "10px";
        div.style.cursor = "pointer";

        div.onclick = () => {
            currentPage = s.page;
            renderPage();
            selectorPanel.classList.remove("open");
        };

        selectorPanel.appendChild(div);
    });

    selectorPanel.classList.add("open");
}

function openJuzSelector() {

    selectorPanel.innerHTML = "<h3>اختر جزء</h3>";

    JUZ_MAP.forEach(j => {

        const div = document.createElement("div");
        div.innerText = "الجزء " + j.number;
        div.style.padding = "10px";
        div.style.cursor = "pointer";

        div.onclick = () => {
            currentPage = j.page;
            renderPage();
            selectorPanel.classList.remove("open");
        };

        selectorPanel.appendChild(div);
    });

    selectorPanel.classList.add("open");
}

/* ================= TAFSIR ================= */

function toggleTafsir() {

    if (tafsirPanel.classList.contains("open")) {
        tafsirPanel.classList.remove("open");
        return;
    }

    const surah = SURAH_MAP.slice().reverse().find(s => currentPage >= s.page);

    tafsirPanel.innerHTML = `
        <h3>${surah.name}</h3>
        <p>
        هذا مثال على وضع التفسير.
        يمكنك لاحقاً تحميل JSON حقيقي للتفسير حسب الصفحة.
        </p>
    `;

    tafsirPanel.classList.add("open");
}

/* ================= HOME ================= */

function goHome(){
    window.location.href = "index.html";
}