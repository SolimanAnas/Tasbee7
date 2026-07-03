    // ========== ZOOM HINT ==========
    function dismissZoomHint() {
      const hint = document.getElementById('zoomHint');
      if (!hint) return;
      hint.classList.remove('show');
      hint.classList.add('hiding');
      clearTimeout(zoomHintTimeout);
    }
    function dismissZoomHintForever() {
      localStorage.setItem('zoom_hint_dismissed', '1');
      dismissZoomHint();
    }
    function showZoomHint() {
      if (localStorage.getItem('zoom_hint_dismissed') === '1') return;
      const hint = document.getElementById('zoomHint');
      if (!hint) return;
      hint.classList.remove('hiding');
      hint.classList.add('show');
      clearTimeout(zoomHintTimeout);
      zoomHintTimeout = setTimeout(() => {
        hint.classList.remove('show');
        hint.classList.add('hiding');
      }, 5000);
    }

    // ========== DOWNLOAD MODAL ==========
    const DL_KEY   = 'quranV3DlDone';
    const DL_CACHE = 'quran-mushaf-images-v1';
    const DL_SIZES = {
      'mushaf-colored':    '~65 ميجابايت',
      'mushaf-madina1441': '~70 ميجابايت',
      'mushaf-tajweed':    '~75 ميجابايت',
      'mushaf-borderd':    '~120 ميجابايت',
      'mushaf-green':      '~65 ميجابايت',
    };
    let dlSelected  = new Set(['mushaf-colored']);
    let dlRunning   = false;

    function dlInit() {
      if (localStorage.getItem(DL_KEY)) return;
      dlBuildCards();
      setTimeout(() => document.getElementById('dlModal')?.classList.add('active'), 800);
    }

    function dlBuildCards() {
      const wrap = document.getElementById('dlVariants');
      if (!wrap) return;
      wrap.innerHTML = '';
      MUSHAF_VARIANTS.filter(v => v.ext).forEach(v => {
        const sel  = dlSelected.has(v.id);
        const thumb = v.id === 'mushaf-tajweed' ? '003' : '001';
        const src   = getImagePath(v.id, thumb, v.ext);
        const div   = document.createElement('div');
        div.className = 'dl-vcard' + (sel ? ' dl-selected' : '');
        div.dataset.vid = v.id;
        div.innerHTML = `
          <div class="dl-thumb">
            <img src="${src}" alt="${v.nameAr}" loading="eager" onerror="this.style.opacity=0">
            <div class="dl-thumb-ov">
              <div class="dl-chk">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
          </div>
          <div class="dl-vbody">
            <div class="dl-vname">${v.nameAr}</div>
            <div class="dl-vsize">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              ${DL_SIZES[v.id] || '~70 ميجابايت'}
            </div>
          </div>`;
        div.onclick = () => {
          if (dlSelected.has(v.id)) dlSelected.delete(v.id);
          else                       dlSelected.add(v.id);
          div.classList.toggle('dl-selected', dlSelected.has(v.id));
          document.getElementById('dlGoBtn').disabled = (dlSelected.size === 0);
        };
        wrap.appendChild(div);
      });
    }

    function dlSkip() {
      document.getElementById('dlModal')?.classList.remove('active');
      localStorage.setItem(DL_KEY, '1');
    }
    function dlClose() {
      document.getElementById('dlModal')?.classList.remove('active');
    }

    // ── Minimize / restore ──
    function dlMinimize() {
      document.getElementById('dlModal').classList.remove('active');
      document.getElementById('dlMiniPill').classList.add('active');
    }
    function dlRestore() {
      document.getElementById('dlMiniPill').classList.remove('active');
      document.getElementById('dlModal').classList.add('active');
    }
    function dlSyncMiniPill(pct, variantName) {
      const fill = document.getElementById('dlMiniRingFill');
      if (fill) fill.style.strokeDashoffset = (94.25 * (1 - pct / 100)).toFixed(2);
      const pctEl = document.getElementById('dlMiniPct');
      if (pctEl) pctEl.textContent = pct + '%';
      const lbl = document.getElementById('dlMiniLabel');
      if (lbl) lbl.textContent = variantName;
    }
    let _dlToastTimer = null;
    function showDlCompleteToast(variantNames) {
      document.getElementById('dlMiniPill').classList.remove('active');
      const sub = document.getElementById('dlToastSub');
      if (sub) sub.textContent = variantNames.join(' · ');
      const bar = document.getElementById('dlToastBarFill');
      if (bar) { bar.style.animation = 'none'; bar.offsetWidth; bar.style.animation = ''; }
      document.getElementById('dlCompleteToast').classList.add('show');
      clearTimeout(_dlToastTimer);
      _dlToastTimer = setTimeout(hideDlCompleteToast, 5500);
    }
    function hideDlCompleteToast() {
      document.getElementById('dlCompleteToast')?.classList.remove('show');
    }

    function dlOpenFromSettings() {
      closeModal('settingsModal');
      // Reset modal to selection view
      document.getElementById('dlSelectSection').style.display   = 'block';
      document.getElementById('dlProgressSection').style.display = 'none';
      document.getElementById('dlDoneSection').style.display     = 'none';
      // Pre-select current variant
      dlSelected = new Set([currentMushafVariant]);
      dlBuildCards();
      document.getElementById('dlModal')?.classList.add('active');
    }

    async function dlStart() {
      if (dlRunning || dlSelected.size === 0) return;
      dlRunning = true;
      document.getElementById('dlSelectSection').style.display  = 'none';
      document.getElementById('dlProgressSection').style.display = 'block';

      const variants   = [...dlSelected];
      const totalPages = variants.length * 604;
      let   done       = 0;
      const BATCH      = 6;
      let   cache      = null;
      try { cache = 'caches' in window ? await caches.open(DL_CACHE) : null; } catch {}

      for (const vid of variants) {
        const v = MUSHAF_VARIANTS.find(m => m.id === vid);
        if (!v?.ext) continue;
        document.getElementById('dlProgName').textContent = v.nameAr;

        for (let p = 1; p <= 604; p += BATCH) {
          const batch = [];
          for (let i = p; i < Math.min(p + BATCH, 605); i++) {
            const pad  = i.toString().padStart(3, '0');
            const path = getImagePath(vid, pad, v.ext);
            batch.push(
              fetch(path).then(r => { if (r.ok && cache) cache.put(path, r); }).catch(() => {})
            );
          }
          await Promise.all(batch);
          done += batch.length;
          const pct = Math.round((done / totalPages) * 100);
          const pageNum = Math.min(p + BATCH - 1, 604);
          document.getElementById('dlPct').textContent      = pct + '%';
          document.getElementById('dlBarFill').style.width  = pct + '%';
          document.getElementById('dlProgPages').textContent = `صفحة ${pageNum} من ٦٠٤`;
          document.getElementById('dlStatusMsg').textContent = `جاري التحميل…  ${done} / ${totalPages}`;
          document.getElementById('dlRingFill').style.strokeDashoffset =
            (307.88 * (1 - pct / 100)).toFixed(2);
          dlSyncMiniPill(pct, v.nameAr);
        }
      }

      dlRunning = false;
      localStorage.setItem(DL_KEY, '1');

      // Ask the browser to protect this origin's storage from eviction —
      // without it, Safari/Chrome may silently discard the 100+ MB the user
      // just downloaded when the device runs low on space.
      try { navigator.storage?.persist?.(); } catch (e) {}

      // Switch to a downloaded variant: keep current if it was downloaded, else use first downloaded
      const downloadedList = variants;
      const targetVariant  = downloadedList.includes(currentMushafVariant)
                             ? currentMushafVariant
                             : downloadedList[0];
      if (targetVariant && targetVariant !== currentMushafVariant) {
        setMushafVariant(targetVariant);
      }

      document.getElementById('dlProgressSection').style.display = 'none';
      document.getElementById('dlDoneSection').style.display     = 'block';
      document.getElementById('dlModal').classList.remove('active');
      showDlCompleteToast(variants.map(vid => {
        const v = MUSHAF_VARIANTS.find(m => m.id === vid);
        return v ? v.nameAr : vid;
      }));
    }
