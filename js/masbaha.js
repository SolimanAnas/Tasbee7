// --- Data ---
const defaultTargets = {
    subhan: 33, hamd: 33, tahleel: 33, takbeer: 33, hawqala: 100,
    istighfar: 100, wahdahu: 100, subhanwabihamdih: 100, salawat: 100
};

const hints = {
    subhan: `قال ﷺ: «أحب الكلام إلى الله أربع: سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر»`,
    hamd: `قال ﷺ: «والحمد لله تملأ الميزان، وسبحان الله والحمد لله تملآن ما بين السماوات والأرض»`,
    tahleel: `قال ﷺ: «أفضل الذكر لا إله إلا الله، وأفضل الدعاء الحمد لله»`,
    takbeer: `الباقيات الصالحات: سبحان الله، والحمد لله، ولا إله إلا الله، والله أكبر`,
    hawqala: `قال ﷺ: «يا عبد الله بن قيس، ألا أدلك على كنز من كنوز الجنة؟ لا حول ولا قوة إلا بالله»`,
    istighfar: `قال ﷺ: «منْ لَزِم الاسْتِغْفَار، جَعَلَ اللَّه لَهُ مِنْ كُلِّ ضِيقٍ مخْرجًا، ومنْ كُلِّ هَمٍّ فَرجًا، وَرَزَقَهُ مِنْ حيْثُ لاَ يَحْتَسِبُ»`,
    wahdahu: `من قالها 100 مرة: كانت له عدل عشر رقاب، وكتبت له مائة حسنة، ومحيت عنه مائة سيئة.`,
    subhanwabihamdih: `«من قال: سبحان الله وبحمده، في يوم مائة مرة، حُطَّت خطاياه وإن كانت مثل زبد البحر»`,
    salawat: `«مَن صلَّى عليَّ صلاةً واحدةً صلَّى اللهُ عليه بها عشرًا»`
};

const customVerse = `«وَالذَّاكِرِينَ اللَّهَ كَثِيرًا وَالذَّاكِرَاتِ أَعَدَّ اللَّهُ لَهُمْ مَغْفِرَةً وَأَجْرًا عَظِيمًا»`;

let currentDhikr = localStorage.getItem("currentDhikr") || "subhan";
const fullCircle = 565.48;

// --- Sound & Haptic ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSoftClick() {
    if(!document.getElementById("soundToggle").checked) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.05);
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function triggerHaptic(type) {
    const isVibrateOn = document.getElementById("vibrateToggle").checked;
    if (!isVibrateOn || !navigator.vibrate) return;
    if (type === 'tap') navigator.vibrate(20);
    else if (type === 'success') navigator.vibrate([100, 50, 100, 50, 100]);
}

// --- Init & Load ---
function init() {
    loadCustomDhikrs();
    document.getElementById("dhikrSelect").value = currentDhikr;

    const savedSound = localStorage.getItem("soundPref");
    const savedVibrate = localStorage.getItem("vibratePref");
    if (savedSound !== null) document.getElementById("soundToggle").checked = (savedSound === 'true');
    if (savedVibrate !== null) document.getElementById("vibrateToggle").checked = (savedVibrate === 'true');
    else document.getElementById("vibrateToggle").checked = true;

    checkReminderPermission();
    setInterval(checkReminderTime, 60000);
    loadCounter();
}

function cKey(){ return "counter_" + currentDhikr }
function tKey(){ return "target_" + currentDhikr }
function totalKey(id) { return "total_" + id; }

function loadCounter() {
    const count = parseInt(localStorage.getItem(cKey()) || 0);
    let target = localStorage.getItem(tKey());
    if(!target) {
        if(currentDhikr.startsWith("custom_")) target = 33; 
        else target = defaultTargets[currentDhikr] || 33;
        localStorage.setItem(tKey(), target);
    }
    document.getElementById("count").innerText = count;
    document.getElementById("powerCount").innerText = count; 
    document.getElementById("targetInput").value = target;
    document.getElementById("targetDisplay").innerText = target;
    updateProgress(count, target);
    showHint();
}

function updateProgress(count, target) {
    target = parseInt(target);
    let displayCount = count % target;
    if(count > 0 && displayCount === 0) displayCount = target;
    
    const percent = target ? Math.min(displayCount / target, 1) : 0;
    const offset = fullCircle - (fullCircle * percent);
    document.getElementById("progressCircle").style.strokeDashoffset = offset;
    
    if(count > 0 && count % target === 0) {
        document.getElementById("progressCircle").style.stroke = "#f59e0b"; 
    } else {
        document.getElementById("progressCircle").style.stroke = "#10b981"; 
    }
}

function increment() {
    let count = parseInt(localStorage.getItem(cKey()) || 0);
    let target = parseInt(localStorage.getItem(tKey()));
    
    count++;
    localStorage.setItem(cKey(), count);
    
    let total = parseInt(localStorage.getItem(totalKey(currentDhikr)) || 0);
    localStorage.setItem(totalKey(currentDhikr), total + 1);
    let grandTotal = parseInt(localStorage.getItem("grand_total") || 0);
    localStorage.setItem("grand_total", grandTotal + 1);

    document.getElementById("count").innerText = count;
    document.getElementById("powerCount").innerText = count; 

    playSoftClick();
    updateProgress(count, target);
    
    if(target > 0 && count % target === 0) {
        triggerHaptic('success');
        triggerConfetti();
    } else {
        triggerHaptic('tap');
    }
}

function changeDhikr() {
    currentDhikr = document.getElementById("dhikrSelect").value;
    localStorage.setItem("currentDhikr", currentDhikr);
    loadCounter();
}

function saveTarget() {
    const newTarget = document.getElementById("targetInput").value;
    localStorage.setItem(tKey(), newTarget);
    document.getElementById("targetDisplay").innerText = newTarget;
    updateProgress(parseInt(document.getElementById("count").innerText), newTarget);
}

function saveSettings() {
    localStorage.setItem("soundPref", document.getElementById("soundToggle").checked);
    localStorage.setItem("vibratePref", document.getElementById("vibrateToggle").checked);
}

function showHint() {
    if(currentDhikr.startsWith("custom_")) document.getElementById("hintBox").innerText = customVerse;
    else document.getElementById("hintBox").innerText = hints[currentDhikr] || "";
}

function toggleSettings() {
    document.getElementById("settingsModal").classList.toggle("open");
    if(document.getElementById("settingsModal").classList.contains("open")) renderStats();
}

function toggleMeanings() {
    document.getElementById("meaningsModal").classList.toggle("open");
}

// --- Power Saving Mode ---
let holdTimer;
let isHolding = false;
function enterPowerMode() {
    document.getElementById("powerModeOverlay").classList.add("active");
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(err => console.log(err));
}
function handlePowerTap() { if (!isHolding) increment(); }
function handleTouchStart(e) {
    isHolding = true;
    const circle = document.getElementById("exitCircle");
    circle.classList.remove("holding");
    void circle.offsetWidth; 
    circle.classList.add("holding");
    holdTimer = setTimeout(() => exitPowerMode(), 3000);
}
function handleTouchEnd(e) {
    isHolding = false;
    clearTimeout(holdTimer);
    document.getElementById("exitCircle").classList.remove("holding");
}
function exitPowerMode() {
    document.getElementById("powerModeOverlay").classList.remove("active");
    navigator.vibrate([50,50,50]);
}

// --- Stats (full names, no trim) ---
function renderStats() {
    const table = document.getElementById("statsTable");
    table.innerHTML = ""; 
    const select = document.getElementById("dhikrSelect");
    let grandTotal = 0;
    for (let i = 0; i < select.options.length; i++) {
        let key = select.options[i].value;
        let name = select.options[i].text; 
        let count = parseInt(localStorage.getItem(totalKey(key)) || 0);
        let row = table.insertRow();
        let cellName = row.insertCell(0);
        let cellCount = row.insertCell(1);
        cellName.innerText = name;
        cellCount.innerText = count.toLocaleString('en-US'); 
        grandTotal += count;
    }
    localStorage.setItem("grand_total", grandTotal);
    document.getElementById("grandTotalDisplay").innerText = grandTotal.toLocaleString('en-US');
}

// --- Custom Dhikr ---
function addCustomDhikr() {
    const input = document.getElementById("customDhikrInput");
    const text = input.value.trim();
    if(!text) return;
    const id = "custom_" + Date.now();
    const newDhikr = { id: id, text: text };
    let customs = JSON.parse(localStorage.getItem("customDhikrs") || "[]");
    customs.push(newDhikr);
    localStorage.setItem("customDhikrs", JSON.stringify(customs));
    appendDhikrOption(newDhikr);
    input.value = "";
    document.getElementById("dhikrSelect").value = id;
    changeDhikr();
    toggleSettings();
}

function loadCustomDhikrs() {
    let customs = JSON.parse(localStorage.getItem("customDhikrs") || "[]");
    customs.forEach(d => appendDhikrOption(d));
}

function appendDhikrOption(d) {
    const select = document.getElementById("dhikrSelect");
    const option = document.createElement("option");
    option.value = d.id;
    option.text = d.text;
    select.appendChild(option);
}

// --- Reminder ---
function setReminder() {
    const timeVal = document.getElementById("reminderTime").value;
    if(timeVal) {
        localStorage.setItem("reminderTime", timeVal);
        document.getElementById("reminderStatus").style.display = "block";
        Notification.requestPermission();
        showToast("تم حفظ وقت التذكير");
    }
}
function checkReminderPermission() {
    const savedTime = localStorage.getItem("reminderTime");
    if(savedTime) {
        document.getElementById("reminderTime").value = savedTime;
        document.getElementById("reminderStatus").style.display = "block";
    }
}
function checkReminderTime() {
    const savedTime = localStorage.getItem("reminderTime");
    if(!savedTime) return;
    const now = new Date();
    const [hours, minutes] = savedTime.split(':');
    if(now.getHours() == hours && now.getMinutes() == minutes) {
        if(Notification.permission === "granted") {
            new Notification("تذكير المسبحة", { body: "حان وقت وردك اليومي", icon: "icon.png" });
        }
        showToast("🔔 حان وقت ذكر الله");
    }
}
function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.querySelector("span").innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
}

// --- Home function ---
function goHome() {
    window.location.href = "index.html";
}

// --- Confetti ---
function triggerConfetti() {
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let particles = [];
    for(let i=0; i<100; i++) {
        particles.push({
            x: canvas.width/2, y: canvas.height/2,
            vx: (Math.random()-0.5)*10, vy: (Math.random()-0.5)*10,
            color: `hsl(${Math.random()*360}, 100%, 50%)`,
            life: 100
        });
    }
    function draw() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        if(particles.length === 0) return;
        particles.forEach((p, index) => {
            p.x += p.vx; p.y += p.vy; p.life--;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 5, 5);
            if(p.life <= 0) particles.splice(index, 1);
        });
        if(particles.length > 0) requestAnimationFrame(draw);
        else ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    draw();
}

// ===== دوال التأكيد للعداد الحالي =====
function openResetModal(e) {
    if(e) e.stopPropagation();
    document.getElementById("confirmResetModal").classList.add("active");
}

function closeResetModal() {
    document.getElementById("confirmResetModal").classList.remove("active");
}

function confirmResetCounter() {
    // تصفير العداد في localStorage
    localStorage.setItem(cKey(), 0);
    
    // إعادة تحميل العداد (تحديث الشاشة)
    loadCounter();
    
    // إغلاق المودال
    closeResetModal();
    
    // إغلاق قائمة الإعدادات إذا كانت مفتوحة
    if(document.getElementById("settingsModal").classList.contains("open")) {
        toggleSettings();
    }
}

// ===== دوال التأكيد للإحصائيات الكلية =====
function openResetStatsModal() {
    document.getElementById("confirmResetStatsModal").classList.add("active");
}

function closeResetStatsModal() {
    document.getElementById("confirmResetStatsModal").classList.remove("active");
}

function confirmResetStats() {
    // مسح جميع الإحصائيات
    const select = document.getElementById("dhikrSelect");
    for (let i = 0; i < select.options.length; i++) {
        localStorage.setItem(totalKey(select.options[i].value), 0);
    }
    localStorage.setItem("grand_total", 0);
    
    // تحديث العرض
    renderStats();
    
    // إغلاق المودال
    closeResetStatsModal();
}

// تعطيل دالة resetCounter القديمة واستبدالها
window.resetCounter = function(e) {
    if(e) e.stopPropagation();
    openResetModal(e);
};

// --- Start the app ---
window.onload = init;

// أحداث إضافية للمودالات
document.addEventListener('DOMContentLoaded', function() {
    // مودال العداد الحالي
    const modal1 = document.getElementById('confirmResetModal');
    if (modal1) {
        modal1.addEventListener('click', function(e) {
            if (e.target === this) closeResetModal();
        });
    }
    const content1 = document.querySelector('#confirmResetModal .modal-content');
    if (content1) {
        content1.addEventListener('click', function(e) { e.stopPropagation(); });
    }

    // مودال الإحصائيات
    const modal2 = document.getElementById('confirmResetStatsModal');
    if (modal2) {
        modal2.addEventListener('click', function(e) {
            if (e.target === this) closeResetStatsModal();
        });
    }
    const content2 = document.querySelector('#confirmResetStatsModal .modal-content');
    if (content2) {
        content2.addEventListener('click', function(e) { e.stopPropagation(); });
    }
});