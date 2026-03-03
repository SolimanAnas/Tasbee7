// ====== QURAN APP ENGINE ======

let currentPage = 1;
const totalPages = 604;

const img = document.getElementById("pageImg");
const frame = document.getElementById("pageFrame");
const surahTitle = document.getElementById("surahName");
const pageMeta = document.getElementById("pageMeta");
const dimLayer = document.getElementById("dimLayer");
const bookmarkLabel = document.getElementById("bookmarkLabel");


// ===== INIT =====
window.addEventListener("load", () => {

    const saved = localStorage.getItem("lastPage");
    if (saved) currentPage = parseInt(saved);

    renderPage();
    initSwipe();
    updateBookmarkIndicator();
});


// ===== PAGE RENDER =====
function renderPage() {

    img.src = `mushaf/${currentPage}.png`;

    const surah = getCurrentSurah();
    const juz = getCurrentJuz();

    surahTitle.innerText = "سورة " + surah.name;
    pageMeta.innerText = `الجزء ${juz.juz} | صفحة ${currentPage}`;

    preloadNext();
    preloadPrev();

    localStorage.setItem("lastPage", currentPage);
}


// ===== PRELOAD FOR SMOOTHNESS =====
function preloadNext(){
    if(currentPage < totalPages){
        const preload = new Image();
        preload.src = `mushaf/${currentPage+1}.png`;
    }
}

function preloadPrev(){
    if(currentPage > 1){
        const preload = new Image();
        preload.src = `mushaf/${currentPage-1}.png`;
    }
}


// ===== PAGE FLIP 3D =====
function nextPage(){
    if(currentPage >= totalPages) return;

    frame.classList.add("flip-next");

    setTimeout(()=>{
        currentPage++;
        renderPage();
        frame.classList.remove("flip-next");
    }, 400);
}

function prevPage(){
    if(currentPage <= 1) return;

    frame.classList.add("flip-prev");

    setTimeout(()=>{
        currentPage--;
        renderPage();
        frame.classList.remove("flip-prev");
    }, 400);
}


// ===== RTL SWIPE =====
function initSwipe(){
    let startX = 0;

    document.getElementById("swipeArea")
    .addEventListener("touchstart", e=>{
        startX = e.changedTouches[0].screenX;
    });

    document.getElementById("swipeArea")
    .addEventListener("touchend", e=>{
        let diff = startX - e.changedTouches[0].screenX;

        if(Math.abs(diff) > 50){
            if(diff > 0){
                // swipe left → previous (RTL)
                prevPage();
            }else{
                // swipe right → next
                nextPage();
            }
        }
    });
}


// ===== SURAH AUTO DETECT =====
function getCurrentSurah(){
    let surah = SURAH_MAP[0];

    for(let i=0; i<SURAH_MAP.length; i++){
        if(currentPage >= SURAH_MAP[i].page){
            surah = SURAH_MAP[i];
        }
    }

    return surah;
}


// ===== JUZ AUTO DETECT =====
function getCurrentJuz(){
    let juz = JUZ_MAP[0];

    for(let i=0; i<JUZ_MAP.length; i++){
        if(currentPage >= JUZ_MAP[i].page){
            juz = JUZ_MAP[i];
        }
    }

    return juz;
}


// ===== BOOKMARK SYSTEM =====
function toggleBookmark(){

    let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if(bookmarks.includes(currentPage)){
        bookmarks = bookmarks.filter(p => p !== currentPage);
    }else{
        bookmarks.push(currentPage);
    }

    localStorage.setItem("bookmarks", JSON.stringify(bookmarks));

    updateBookmarkIndicator();
}

function updateBookmarkIndicator(){
    let bookmarks = JSON.parse(localStorage.getItem("bookmarks") || "[]");

    if(bookmarks.includes(currentPage)){
        bookmarkLabel.classList.add("visible");
    }else{
        bookmarkLabel.classList.remove("visible");
    }
}


// ===== DIM NIGHT MODE =====
function toggleDim(){
    const current = dimLayer.style.background;

    if(current && current !== "rgba(0, 0, 0, 0)"){
        dimLayer.style.background = "rgba(0,0,0,0)";
    }else{
        dimLayer.style.background = "rgba(0,0,0,0.55)";
    }
}


// ===== HOME =====
function goHome(){
    window.location.href = "index.html";
}


// ===== KEYBOARD NAV (Desktop) =====
document.addEventListener("keydown", e=>{
    if(e.key === "ArrowLeft"){
        prevPage();
    }
    if(e.key === "ArrowRight"){
        nextPage();
    }
});
