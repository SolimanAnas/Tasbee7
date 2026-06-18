(function () {
  'use strict';

  /* ─── constants ─────────────────────────────────────────── */
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=io.github.solimananas.twa';
  const PLAY_STORE_PKG = 'io.github.solimananas.twa';
  const NEVER_KEY  = 'zad_install_never';
  const SNOOZE_KEY = 'zad_install_snooze';
  const base = location.pathname.includes('/pages/') ? '../' : './';

  /* ─── installed / standalone guard ─────────────────────── */
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches  ||
    window.matchMedia('(display-mode: fullscreen)').matches  ||
    navigator.standalone === true;
  if (isStandalone) return;
  if (localStorage.getItem(NEVER_KEY) === '1') return;
  const snoozeUntil = parseInt(localStorage.getItem(SNOOZE_KEY) || '0', 10);
  if (Date.now() < snoozeUntil) return;

  /* ─── device detection ──────────────────────────────────── */
  const ua        = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS     = /iPad|iPhone|iPod/.test(ua) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari  = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgA/.test(ua);

  /* ─── deferred prompt (Chrome / Edge desktop+Android) ───── */
  let deferredPrompt = null;
  let shown = false;

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', () => { localStorage.setItem(NEVER_KEY, '1'); dismiss(); });

  /* ─── timing ─────────────────────────────────────────────── */
  let timer = setTimeout(tryShow, 15000);
  document.addEventListener('_audioPlaying', () => {
    clearTimeout(timer);
    timer = setTimeout(tryShow, 2000);
  }, { once: true });

  async function tryShow() {
    if (shown) return;

    /* Android: skip if TWA already installed via getInstalledRelatedApps */
    if (isAndroid && 'getInstalledRelatedApps' in navigator) {
      try {
        const apps = await navigator.getInstalledRelatedApps();
        if (apps.some(a => a.id === PLAY_STORE_PKG || a.platform === 'play')) {
          localStorage.setItem(NEVER_KEY, '1');
          return;
        }
      } catch (_) { /* API unavailable — proceed normally */ }
    }

    if (isAndroid)           return render('playstore');
    if (isIOS && isSafari)   return render('ios');
    if (deferredPrompt)      return render('pwa');
  }

  /* ─── CSS ────────────────────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('ip-css')) return;
    const s = document.createElement('style');
    s.id = 'ip-css';
    s.textContent = `
/* ── wrapper & scrim ─────────────────────── */
#install-prompt{
  position:fixed;inset:0;z-index:99999;
  pointer-events:none;
  display:flex;align-items:flex-end;justify-content:center;
  padding:0 14px max(20px,env(safe-area-inset-bottom));
}
.ip-scrim{
  position:absolute;inset:0;
  background:rgba(0,0,0,0);
  transition:background .4s;
  pointer-events:none;
}
#install-prompt.ip-open .ip-scrim{
  background:rgba(0,0,0,.38);
  pointer-events:auto;
}

/* ── card ────────────────────────────────── */
.ip-card{
  position:relative;z-index:1;
  width:100%;max-width:440px;
  background:var(--glass,rgba(12,22,16,.93));
  backdrop-filter:blur(36px) saturate(160%);
  -webkit-backdrop-filter:blur(36px) saturate(160%);
  border:1px solid var(--glass-border,rgba(255,255,255,.1));
  border-radius:28px;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.08),
    0 -2px 0 rgba(16,185,129,.06),
    0 32px 80px rgba(0,0,0,.6),
    0 0 0 1px rgba(16,185,129,.06);
  padding:6px 20px 20px;
  pointer-events:auto;
  transform:translateY(calc(100% + 32px));
  opacity:0;
  transition:transform .52s cubic-bezier(.17,.89,.32,1.08),opacity .38s ease;
  font-family:'Tajawal',sans-serif;
  direction:rtl;
  touch-action:pan-y;
  will-change:transform;
}
.ip-card.ip-visible{transform:translateY(0);opacity:1}

/* drag handle */
.ip-drag{
  width:36px;height:4px;border-radius:4px;
  background:rgba(150,160,155,.3);
  margin:0 auto 16px;
}

/* ── app identity row ────────────────────── */
.ip-hd{
  display:flex;align-items:center;gap:14px;
  margin-bottom:18px;
}
.ip-icon-outer{
  position:relative;flex:0 0 60px;width:60px;height:60px;
}
.ip-glow{
  position:absolute;inset:-12px;border-radius:50%;
  background:radial-gradient(circle,rgba(16,185,129,.22),transparent 68%);
  pointer-events:none;
}
.ip-arc{
  position:absolute;inset:-6px;border-radius:50%;
  border:1.5px solid transparent;
  border-top-color:rgba(16,185,129,.7);
  border-right-color:rgba(16,185,129,.18);
  animation:ipArc 2.8s linear infinite;
}
@keyframes ipArc{to{transform:rotate(360deg)}}
.ip-icon{
  position:relative;z-index:1;
  width:60px;height:60px;border-radius:16px;display:block;
  box-shadow:0 4px 18px rgba(0,0,0,.4),0 0 0 1px rgba(255,255,255,.06);
}
.ip-meta{flex:1;min-width:0}
.ip-name{
  font-family:'Amiri',serif;
  font-size:1.15rem;font-weight:700;
  color:var(--text-primary,#f0f4f0);
  line-height:1.2;
}
.ip-sub{
  font-size:.73rem;
  color:var(--text-secondary,rgba(240,244,240,.52));
  margin-top:2px;line-height:1.35;
}
.ip-stars{
  display:flex;align-items:center;gap:3px;
  margin-top:4px;
}
.ip-star-fill{color:#f59e0b;font-size:.65rem;line-height:1}
.ip-star-txt{font-size:.68rem;color:var(--text-secondary,rgba(240,244,240,.55));margin-right:2px}
.ip-x{
  flex:0 0 30px;width:30px;height:30px;border-radius:50%;
  background:var(--list-hover,rgba(255,255,255,.07));
  border:none;color:var(--text-secondary,rgba(240,244,240,.45));
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background .18s,color .18s;padding:0;
}
.ip-x:hover{background:rgba(255,255,255,.14);color:var(--text-primary,#f0f4f0)}
.ip-x svg{width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round}

/* ── divider ─────────────────────────────── */
.ip-divider{
  height:1px;
  background:var(--glass-border,rgba(255,255,255,.07));
  margin:0 -20px 18px;
}

/* ── feature rows ────────────────────────── */
.ip-feats{display:flex;flex-direction:column;gap:11px;margin-bottom:20px}
.ip-feat{
  display:flex;align-items:center;gap:12px;
  opacity:0;transform:translateX(8px);
  transition:opacity .35s,transform .35s;
}
.ip-card.ip-visible .ip-feat:nth-child(1){opacity:1;transform:none;transition-delay:.18s}
.ip-card.ip-visible .ip-feat:nth-child(2){opacity:1;transform:none;transition-delay:.28s}
.ip-card.ip-visible .ip-feat:nth-child(3){opacity:1;transform:none;transition-delay:.38s}
.ip-feat-ico{
  flex:0 0 34px;width:34px;height:34px;border-radius:10px;
  background:rgba(16,185,129,.1);
  border:1px solid rgba(16,185,129,.18);
  display:flex;align-items:center;justify-content:center;
}
.ip-feat-ico svg{width:17px;height:17px;stroke:var(--accent-main,#10B981);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.ip-feat-txt{
  font-size:.875rem;font-weight:500;
  color:var(--text-primary,#f0f4f0);
  line-height:1.3;
}

/* ── CTA ─────────────────────────────────── */
.ip-cta{
  display:flex;align-items:center;justify-content:center;gap:10px;
  width:100%;padding:15px;border-radius:18px;
  font-family:'Tajawal',sans-serif;font-size:1rem;font-weight:700;
  border:none;cursor:pointer;text-decoration:none;
  margin-bottom:10px;
  transition:transform .14s,box-shadow .18s,opacity .14s;
}
.ip-cta:active{transform:scale(.967);opacity:.92}

.ip-cta-green{
  background:var(--accent-main,#10B981);color:#fff;
  box-shadow:0 4px 24px rgba(16,185,129,.38);
}
.ip-cta-green:active{box-shadow:0 2px 10px rgba(16,185,129,.2)}

/* authentic Google Play badge style */
.ip-cta-gplay{
  background:#000;color:#fff;
  box-shadow:0 4px 24px rgba(0,0,0,.55);
  direction:ltr;gap:12px;
  border:1px solid rgba(255,255,255,.06);
}
.ip-cta-gplay:active{box-shadow:0 2px 10px rgba(0,0,0,.35)}
.ip-gplay-label{
  display:flex;flex-direction:column;line-height:1.2;text-align:left;
}
.ip-gplay-label small{
  font-size:.58rem;font-weight:400;
  opacity:.65;letter-spacing:.04em;text-transform:uppercase;
}
.ip-gplay-label strong{font-size:1rem;font-weight:700;letter-spacing:-.01em}

/* ── secondary buttons ───────────────────── */
.ip-later{
  display:block;width:100%;padding:12px;border-radius:15px;
  background:var(--list-hover,rgba(255,255,255,.06));
  font-family:'Tajawal',sans-serif;font-size:.9rem;
  color:var(--text-secondary,rgba(240,244,240,.55));
  border:none;cursor:pointer;text-align:center;
  margin-bottom:6px;transition:.15s;
}
.ip-later:active{transform:scale(.97)}
.ip-never{
  display:block;width:100%;padding:7px;text-align:center;
  font-family:'Tajawal',sans-serif;font-size:.71rem;
  color:var(--text-secondary,rgba(240,244,240,.3));
  background:none;border:none;cursor:pointer;
  transition:opacity .2s,color .2s;
}
.ip-never:hover{color:var(--text-primary,#f0f4f0)}

/* ── iOS steps ───────────────────────────── */
.ip-steps{display:flex;flex-direction:column;gap:14px;margin-bottom:20px}
.ip-step{display:flex;align-items:flex-start;gap:12px}
.ip-step-n{
  flex:0 0 30px;width:30px;height:30px;border-radius:50%;
  background:rgba(16,185,129,.1);
  border:1.5px solid rgba(16,185,129,.25);
  display:flex;align-items:center;justify-content:center;
  font-size:.82rem;font-weight:700;
  color:var(--accent-main,#10B981);
  font-family:'Tajawal',sans-serif;margin-top:1px;
  flex-shrink:0;
}
.ip-step-t{
  font-size:.875rem;
  color:var(--text-primary,#f0f4f0);
  line-height:1.55;flex:1;
}
.ip-step-t strong{color:var(--accent-main,#10B981)}
    `;
    document.head.appendChild(s);
  }

  /* ─── SVG icons ──────────────────────────────────────────── */
  const ICO_WIFI_OFF = `<svg viewBox="0 0 24 24"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
  const ICO_BELL = `<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
  const ICO_ZAP  = `<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
  const ICO_HOME = `<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

  const SVG_GPLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 512 512" aria-hidden="true">
    <linearGradient id="gp1" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#00c3ff"/><stop offset="100%" stop-color="#1a9aff"/></linearGradient>
    <linearGradient id="gp2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ffda00"/><stop offset="100%" stop-color="#ffb000"/></linearGradient>
    <linearGradient id="gp3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff3a44"/><stop offset="100%" stop-color="#c31162"/></linearGradient>
    <linearGradient id="gp4" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#32bf58"/><stop offset="100%" stop-color="#00df6b"/></linearGradient>
    <path fill="url(#gp1)" d="M42.1 466.9c5.1 2.8 11 4.4 17.4 4.4 6.7 0 13.4-1.7 19.2-5.1L337 319.9 253.6 236 42.1 466.9z"/>
    <path fill="url(#gp2)" d="M468.4 220.1L384 170.8 295.5 256l88.6 88.6 84.3-49.3c12-6.9 19.6-19.4 19.6-33.6 0-14.2-7.6-26.7-19.6-33.6z"/>
    <path fill="url(#gp3)" d="M42.1 45.1L253.6 276l83.4-83.4L78.7 45.8C72.9 42.4 66.2 40.7 59.5 40.7c-6.4 0-12.3 1.6-17.4 4.4z"/>
    <path fill="url(#gp4)" d="M59.5 40.7c-6.4 0-12.3 1.6-17.4 4.4C30 51.8 22.4 64.3 22.4 78.5v355c0 14.2 7.6 26.7 19.7 33.4l211.5-230.9L59.5 40.7z"/>
  </svg>`;

  /* ─── render ─────────────────────────────────────────────── */
  function render(type) {
    shown = true;
    injectCSS();

    const header = `
      <div class="ip-drag"></div>
      <div class="ip-hd">
        <div class="ip-icon-outer">
          <div class="ip-glow"></div>
          <div class="ip-arc"></div>
          <img class="ip-icon" src="${base}icons/icon-192.png"
               alt="زاد المسلم" width="60" height="60" loading="lazy">
        </div>
        <div class="ip-meta">
          <div class="ip-name">زاد المسلم</div>
          <div class="ip-sub">القرآن الكريم · الأذكار · المسبحة</div>
          ${type === 'playstore' ? `<div class="ip-stars">
            <span class="ip-star-fill">★★★★★</span>
            <span class="ip-star-txt">4.8 · مجاناً</span>
          </div>` : ''}
        </div>
        <button class="ip-x" id="ip-x" aria-label="إغلاق">
          <svg viewBox="0 0 14 14" width="14" height="14"><line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/></svg>
        </button>
      </div>
      <div class="ip-divider"></div>`;

    let body = '';

    if (type === 'playstore' || type === 'pwa') {
      const feats = type === 'playstore'
        ? [
            [ICO_WIFI_OFF, 'يعمل بدون اتصال بالإنترنت'],
            [ICO_BELL,     'إشعارات أذكار الصباح والمساء'],
            [ICO_ZAP,      'أسرع وأخف بكثير من المتصفح'],
          ]
        : [
            [ICO_HOME,     'على شاشتك الرئيسية — بلا متصفح'],
            [ICO_WIFI_OFF, 'يعمل بدون اتصال بالإنترنت'],
            [ICO_ZAP,      'أسرع وأخف بكثير من المتصفح'],
          ];

      const featRows = feats.map(([ico, txt]) => `
        <div class="ip-feat">
          <div class="ip-feat-ico">${ico}</div>
          <span class="ip-feat-txt">${txt}</span>
        </div>`).join('');

      const cta = type === 'playstore'
        ? `<a id="ip-cta" class="ip-cta ip-cta-gplay"
             href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">
             ${SVG_GPLAY}
             <div class="ip-gplay-label">
               <small>Get it on</small>
               <strong>Google Play</strong>
             </div>
           </a>`
        : `<button id="ip-cta" class="ip-cta ip-cta-green">
             <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
             أضف إلى الشاشة الرئيسية
           </button>`;

      body = `
        <div class="ip-feats">${featRows}</div>
        ${cta}
        <button class="ip-later" id="ip-later">لاحقاً</button>
        <button class="ip-never" id="ip-never">لا تُظهر مجدداً</button>`;

    } else if (type === 'ios') {
      body = `
        <div class="ip-steps">
          <div class="ip-step">
            <div class="ip-step-n">١</div>
            <div class="ip-step-t">
              اضغط زر <strong>المشاركة ⬆</strong> في الشريط السفلي لـ Safari
            </div>
          </div>
          <div class="ip-step">
            <div class="ip-step-n">٢</div>
            <div class="ip-step-t">
              اختر <strong>«إضافة إلى الشاشة الرئيسية»</strong>
            </div>
          </div>
          <div class="ip-step">
            <div class="ip-step-n">٣</div>
            <div class="ip-step-t">
              اضغط <strong>إضافة</strong> وستجد التطبيق مباشرةً على شاشتك
            </div>
          </div>
        </div>
        <button class="ip-later" id="ip-later">فهمت، شكراً</button>
        <button class="ip-never" id="ip-never">لا تُظهر مجدداً</button>`;
    }

    const wrap = document.createElement('div');
    wrap.id = 'install-prompt';
    wrap.innerHTML = `<div class="ip-scrim"></div><div class="ip-card">${header}${body}</div>`;
    document.body.appendChild(wrap);

    /* animate in */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      wrap.classList.add('ip-open');
      wrap.querySelector('.ip-card').classList.add('ip-visible');
    }));

    /* close on scrim tap */
    wrap.querySelector('.ip-scrim').addEventListener('click', () => { snoozeFor(3); dismiss(); });

    /* ── swipe-down-to-dismiss ── */
    const card = wrap.querySelector('.ip-card');
    let touchStartY = 0, touchDeltaY = 0;
    card.addEventListener('touchstart', e => {
      touchStartY = e.touches[0].clientY;
      touchDeltaY = 0;
      card.style.transition = 'none';
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      touchDeltaY = e.touches[0].clientY - touchStartY;
      if (touchDeltaY > 0) card.style.transform = `translateY(${touchDeltaY}px)`;
    }, { passive: true });
    card.addEventListener('touchend', () => {
      card.style.transition = '';
      if (touchDeltaY > 80) { snoozeFor(3); dismiss(); }
      else card.style.transform = '';
    });

    /* ── button events ── */
    wrap.querySelector('#ip-x').addEventListener('click', () => { snoozeFor(3); dismiss(); });

    const later = wrap.querySelector('#ip-later');
    if (later) later.addEventListener('click', () => { snoozeFor(7); dismiss(); });

    const never = wrap.querySelector('#ip-never');
    if (never) never.addEventListener('click', () => {
      localStorage.setItem(NEVER_KEY, '1');
      dismiss();
    });

    const cta = wrap.querySelector('#ip-cta');
    if (cta) {
      if (type === 'playstore') {
        cta.addEventListener('click', () => snoozeFor(14));
      } else if (type === 'pwa') {
        cta.addEventListener('click', async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          deferredPrompt = null;
          if (outcome === 'accepted') localStorage.setItem(NEVER_KEY, '1');
          dismiss();
        });
      }
    }
  }

  /* ─── helpers ────────────────────────────────────────────── */
  function snoozeFor(days) {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + days * 864e5));
  }

  function dismiss() {
    const el = document.getElementById('install-prompt');
    if (!el) return;
    el.classList.remove('ip-open');
    const card = el.querySelector('.ip-card');
    if (card) card.classList.remove('ip-visible');
    setTimeout(() => el.remove(), 560);
  }

})();
