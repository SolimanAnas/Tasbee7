    // ========== LEGACY COORDINATE FETCH (SQLITE) ==========
    function groupWordsIntoAyahLines(words) {
      const ayahs = {};
      words.forEach(w => {
        const key = `${w.surah}-${w.ayah}`;
        if (!ayahs[key]) ayahs[key] = [];
        ayahs[key].push(w);
      });
      const mergedRects = [];
      for (const key in ayahs) {
        const ayahWords = ayahs[key];
        ayahWords.sort((a, b) => a.y - b.y);
        let lines = [];
        let currentLine = [];
        ayahWords.forEach(w => {
          if (currentLine.length === 0) currentLine.push(w);
          else {
            if (Math.abs(w.y - currentLine[currentLine.length - 1].y) < 50) currentLine.push(w);
            else { lines.push(currentLine); currentLine = [w]; }
          }
        });
        if (currentLine.length > 0) lines.push(currentLine);
        lines.forEach(line => {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          line.forEach(w => {
            minX = Math.min(minX, w.x); maxX = Math.max(maxX, w.x + w.w);
            minY = Math.min(minY, w.y); maxY = Math.max(maxY, w.y + w.h);
          });
          mergedRects.push({ surah: line[0].surah, ayah: line[0].ayah, x: minX, y: minY, w: maxX - minX, h: maxY - minY });
        });
      }
      return mergedRects;
    }

    function getLegacyCoordsForPage(pageNumber) {
      if (!db || !dbReady) return [];
      const query = `SELECT soraid, ayaid, minx, maxx, miny, maxy FROM ayarects WHERE page = ${pageNumber}`;
      const words = [];
      try {
        const stmt = db.prepare(query);
        while(stmt.step()) {
          const row = stmt.getAsObject();
          words.push({ surah: row.soraid, ayah: row.ayaid, x: row.minx, y: row.miny, w: row.maxx - row.minx, h: row.maxy - row.miny });
        }
        stmt.free();
      } catch(e) { return []; }
      if (words.length === 0) return [];
      const rects = groupWordsIntoAyahLines(words);
      const cal = getVariantHighlightCal();
      const LEGACY_REF_W = 1024, LEGACY_REF_H = 1636;
      const sx = cal.refW / LEGACY_REF_W;
      const sy = cal.refH / LEGACY_REF_H;
      rects.forEach(r => { r.x *= sx; r.y *= sy; r.w *= sx; r.h *= sy; });
      return rects;
    }

    function toggleTafsirFullscreen() {
      const modal = document.getElementById('tafsirModal');
      if (modal.style.height === '100vh') {
        modal.style.height = '';
        modal.style.maxHeight = '85vh';
        modal.style.borderRadius = '26px 26px 0 0';
      } else {
        modal.style.height = '100vh';
        modal.style.maxHeight = '100vh';
        modal.style.borderRadius = '0';
      }
    }

    async function getPageAyahsForTafsir(page) {
      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(page);
      } else {
        rects = getLegacyCoordsForPage(page);
      }
      if (!rects || rects.length === 0) return null;
      return { surah: rects[0].surah, ayah: rects[0].ayah };
    }

    async function findAdjacentAyah(surah, ayah, direction) {
      const step = direction === 'next' ? 1 : -1;
      let targetSurah = surah;
      let targetAyah = ayah + step;
      const maxAyah = ayahCountMap[targetSurah] || AYAH_COUNTS_FALLBACK[targetSurah] || 286;
      if (targetAyah < 1) { targetSurah--; targetAyah = ayahCountMap[targetSurah] || AYAH_COUNTS_FALLBACK[targetSurah] || 286; }
      if (targetAyah > maxAyah) { targetSurah++; targetAyah = 1; }
      if (targetSurah < 1) return null;
      if (targetSurah > 114) return null;
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${targetSurah}:${targetAyah}`);
        const data = await res.json();
        if (data.code === 200) {
          return { surah: data.data.surah.number, ayah: data.data.numberInSurah, page: data.data.page };
        }
      } catch(e) {}
      return { surah: targetSurah, ayah: targetAyah, page: null };
    }

    async function getFirstAyahOfPage(page) {
      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(page);
      } else {
        rects = getLegacyCoordsForPage(page);
      }
      if (!rects || rects.length === 0) return null;
      return { surah: rects[0].surah, ayah: rects[0].ayah, page: page };
    }

    async function getNextAyahDb(surah, ayah) {
      return findAdjacentAyah(surah, ayah, 'next');
    }

    async function getPrevAyahDb(surah, ayah) {
      return findAdjacentAyah(surah, ayah, 'prev');
    }

    async function nextTafsirAyah() {
      if(!windowCurrentAyahGlobal) {
          const first = await getPageAyahsForTafsir(currentPage);
          if(first) windowCurrentAyahGlobal = first; else return;
      }
      const next = await findAdjacentAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, 'next');
      if (next) {
          windowCurrentAyahGlobal = { surah: next.surah, ayah: next.ayah };
          if (next.page && next.page !== currentPage) window.goToPage(next.page);
          await contextShowTafsir(true);
      } else {
          showCustomToast("تم الوصول لنهاية المصحف");
      }
    }

    async function prevTafsirAyah() {
      if(!windowCurrentAyahGlobal) {
          const first = await getPageAyahsForTafsir(currentPage);
          if(first) windowCurrentAyahGlobal = first; else return;
      }
      const prev = await findAdjacentAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, 'prev');
      if (prev) {
          windowCurrentAyahGlobal = { surah: prev.surah, ayah: prev.ayah };
          if (prev.page && prev.page !== currentPage) window.goToPage(prev.page);
          await contextShowTafsir(true);
      } else {
          showCustomToast("تم الوصول لبداية المصحف");
      }
    }

    let tafsirTouchStartX = 0;
    const tafsirModalEl = document.getElementById('tafsirModal');
    tafsirModalEl.addEventListener('touchstart', e => { tafsirTouchStartX = e.changedTouches[0].screenX; }, {passive: true});
    tafsirModalEl.addEventListener('touchend', e => {
      const diff = e.changedTouches[0].screenX - tafsirTouchStartX;
      if (diff > 60) nextTafsirAyah();
      else if (diff < -60) prevTafsirAyah();
    }, {passive: true});

    function closeTafsirModal() {
      document.getElementById('tafsirModal').classList.remove('visible');
      document.getElementById('tafsirSheetBackdrop').classList.remove('visible');
    }

    async function contextShowTafsir(isNavigation = false) {
      if(!isNavigation) closeContextMenu();
      if(!windowCurrentAyahGlobal) { showCustomToast("الرجاء تحديد آية أولاً"); return; }
      const { surah, ayah } = windowCurrentAyahGlobal;
      const contentDiv = document.getElementById('tafsirContent');
      document.getElementById('tafsirModal').classList.add('visible');
      document.getElementById('tafsirSheetBackdrop').classList.add('visible');
      try {
        tafsirSelectedDB = document.getElementById('tafsirBookSelect')?.value || tafsirSelectedDB;
        localStorage.setItem('tafsirSelectedBook', tafsirSelectedDB);
        contentDiv.innerHTML = typeof tafsirDropdownHTML === 'function'
          ? tafsirDropdownHTML(tafsirSelectedDB) + '<div style="text-align:center; padding:30px; color:var(--accent);">جاري التحميل...</div>'
          : '<div style="text-align:center; padding:30px; color:var(--accent);">جاري التحميل...</div>';
        const [ayaTextRes, tafText] = await Promise.all([
          fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/quran-simple`),
          getTafsirText(tafsirSelectedDB, surah, ayah)
        ]);
        const ayaData = await ayaTextRes.json();
        const ayahText = (ayaData.code === 200) ? ayaData.data.text : '';
        const tafsirText = tafText || 'لم يتم العثور على تفسير لهذه الآية.';
        let html = typeof tafsirDropdownHTML === 'function' ? tafsirDropdownHTML(tafsirSelectedDB) : '';
        html += `<div style="font-weight:700; margin-bottom:12px; color:var(--text-secondary); text-align:center; font-size:0.95rem; font-family:'Tajawal',sans-serif;">الآية ${ayah}</div>`;
        html += `<div class="imlaei-text">﴿ ${ayahText} ﴾</div>`;
        html += `<div style="text-align:justify; font-size:1.1rem; line-height:2; border-top:1px dashed var(--glass-border); padding-top:16px;">${tafsirText.replace(/\n/g, '<br>')}</div>`;
        contentDiv.innerHTML = html;
        highlightAyah(surah, ayah);
      } catch(e) {
        console.error(e);
        contentDiv.innerHTML = `<div style="text-align:center; color:var(--danger); padding:20px;">تعذر تحميل التفسير أو الآية غير موجودة</div><button onclick="contextShowTafsir()" class="action-btn" style="margin-top:10px; justify-content:center;">إعادة المحاولة</button>`;
      }
    }

    async function changeTafsir() {
       const sel = document.getElementById('tafsirBookSelect');
       if (sel) {
         tafsirSelectedDB = sel.value;
         localStorage.setItem('tafsirSelectedBook', tafsirSelectedDB);
       }
       if (document.getElementById('tafsirModal').classList.contains('visible') && windowCurrentAyahGlobal) {
           await contextShowTafsir(true);
       }
    }
