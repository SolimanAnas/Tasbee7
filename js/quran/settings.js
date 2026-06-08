    // ========== CONTEXT MENU ==========
    const contextSheet = document.getElementById('contextMenuSheet');

    function setupSheetDragClose(sheet) {
      if(!sheet) return;
      let touchStartY = 0, touchCurrentY = 0, isDragging = false;
      const backdropMap = {
        audioExpandedSheet: 'audioSheetBackdrop',
        contextMenuSheet: 'contextSheetBackdrop',
        tafsirModal: 'tafsirSheetBackdrop'
      };
      const onStart = (e) => {
        if (e.target.closest('.reciter-selector') || e.target.closest('.reciter-trigger') || e.target.closest('.reciter-picker') || e.target.closest('input') || e.target.closest('button')) return;
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDragging = true;
      };
      const onMove = (e) => {
        if (!isDragging) return;
        touchCurrentY = e.touches[0].clientY;
        const diff = touchCurrentY - touchStartY;
        if (diff > 0) {
          sheet.style.transform = `translateY(${Math.min(diff, 250)}px)`;
          sheet.style.transition = 'none';
        }
      };
      const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        const diff = touchCurrentY - touchStartY;
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (diff > 80) {
          sheet.classList.remove('visible');
          const backdropId = backdropMap[sheet.id];
          if (backdropId) document.getElementById(backdropId).classList.remove('visible');
        }
      };
      sheet.addEventListener('touchstart', onStart, {passive:true});
      sheet.addEventListener('touchmove', onMove, {passive:true});
      sheet.addEventListener('touchend', onEnd, {passive:true});
    }

    function showContextMenu(surah, ayah) {
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      document.getElementById('contextPlayBtn').style.display = 'flex';
      document.getElementById('contextCopyBtn').style.display = 'flex';
      document.getElementById('contextTafsirBtn').style.display = 'flex';
      document.getElementById('contextTasmeeBtn').style.display = 'flex';
      updateContextMushafLabel();
      contextSheet.classList.add('visible');
      document.getElementById('contextSheetBackdrop').classList.add('visible');
    }

    function showGeneralMenu() {
        document.getElementById('contextPlayBtn').style.display = 'none';
        document.getElementById('contextCopyBtn').style.display = 'none';
        document.getElementById('contextTafsirBtn').style.display = 'none';
        document.getElementById('contextTasmeeBtn').style.display = 'none';
        updateContextMushafLabel();
        contextSheet.classList.add('visible');
        document.getElementById('contextSheetBackdrop').classList.add('visible');
    }

    function updateContextMushafLabel() {
      const label = document.getElementById('contextMushafLabel');
      if (label) label.textContent = getVariantInfo(currentMushafVariant).nameAr;
    }

    function closeContextMenu() {
      contextSheet.classList.remove('visible');
      document.getElementById('contextSheetBackdrop').classList.remove('visible');
    }
    function navigateToJuz()   { closeContextMenu(); openJuzSelector(); }
    function navigateToSurah() { closeContextMenu(); openSurahSelector(); }
    function navigateToPage()  { closeContextMenu(); openPageSelector(); }

    function contextPlayAyah() {
      closeContextMenu();
      if(windowCurrentAyahGlobal) showMiniPlayerForAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah, true);
    }

    async function contextCopyAyah() {
      closeContextMenu();
      if(!windowCurrentAyahGlobal) return;
      const reference = `${windowCurrentAyahGlobal.surah}:${windowCurrentAyahGlobal.ayah}`;
      try {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${reference}`);
        const data = await res.json();
        if(data.code === 200) { navigator.clipboard.writeText(data.data.text); showCustomToast("تم نسخ الآية"); }
      } catch(e) { showCustomToast("خطأ في النسخ"); }
    }

    // ========== V3 MUSHAF VARIANT MANAGEMENT ==========
    const MUSHAF_VARIANTS = [
      { id: 'mushaf-colored',    nameAr: 'مصحف المدينة',       desc: 'المصحف الملون - النسخة الافتراضية',        ext: 'webp' },
      { id: 'mushaf-madina1441', nameAr: 'مصحف المدينة 1441', desc: 'مصحف المدينة النبوية - طبعة 1441',            ext: 'webp' },
      { id: 'mushaf-tajweed',    nameAr: 'مصحف التجويد',       desc: 'مصحف التجويد الملون',                    ext: 'webp' },
      { id: 'mushaf-borderd',    nameAr: 'مصحف المدينة 1421', desc: 'مصحف المدينة النبوية - طبعة 1421',                 ext: 'png' },
      { id: 'mushaf-green',    nameAr: 'مصحف المدينة الأخضر', desc: 'مصحف المدينة الأخضر - مجمع الملك فهد',      ext: 'webp' },
      { id: 'mushaf-text',       nameAr: 'المصحف النصي',        desc: 'النسخة النصية للقرآن الكريم',               ext: '' }
    ];

    let currentMushafVariant = localStorage.getItem('quranV3Variant') || 'mushaf-colored';
    document.body.setAttribute('data-variant', currentMushafVariant);

    let borderZoomState = false; // false=OUT (1.2,1.4), true=IN (1.0,1.3)
    let zoomHintTimeout = null;

    const THEME_NAMES = { golden:'ذهبي',teal:'فيروزي',crimson:'قرمزي',camel:'عسلي',olive:'زيتوني',royal:'ملكي' };

    function setColorTheme(themeId) {
      if (!THEME_NAMES[themeId]) return;
      localStorage.setItem('quranColorTheme', themeId);
      document.body.setAttribute('data-color-theme', themeId);
      document.querySelectorAll('.theme-swatch').forEach(el => el.classList.toggle('active', el.dataset.theme === themeId));
      const label = document.getElementById('colorThemeLabel');
      if (label) label.textContent = THEME_NAMES[themeId];
    }

    function setMushafVariant(variantId) {
      if (variantId === 'mushaf-text') {
        window.location.href = 'quran-text.html';
        return;
      }
      if (variantId !== currentMushafVariant) {
        currentMushafVariant = variantId;
        localStorage.setItem('quranV3Variant', variantId);
        document.body.setAttribute('data-variant', variantId);
        updateVariantUI();
        updateContent();
        const v = getVariantInfo(variantId);
        showCustomToast(`تم التبديل إلى ${v.nameAr}`);
        if (variantId === 'mushaf-borderd' || variantId === 'mushaf-green') showZoomHint();
      }
    }

    function getVariantInfo(variantId) {
      return MUSHAF_VARIANTS.find(v => v.id === variantId) || MUSHAF_VARIANTS[0];
    }
    function getImagePath(variantId, page, ext) {
      const dir = variantId === 'mushaf-green' ? '../mushaf pages/madina-green'
                : variantId === 'mushaf-borderd' ? '../mushaf-2'
                : variantId === 'mushaf-tajweed' ? '../mushaf pages/tajweed'
                : variantId === 'mushaf-colored' ? '../mushaf pages/madina-1421'
                : '../mushaf pages/mushaf-madina-1441';
      return `${dir}/${page}.${ext}`;
    }

    function updateVariantUI() {
      const label = document.getElementById('currentMushafLabel');
      if (label) label.textContent = getVariantInfo(currentMushafVariant).nameAr;

      document.querySelectorAll('.mushaf-card').forEach(card => {
        card.classList.toggle('active', card.dataset.variant === currentMushafVariant);
      });
    }

    // ========== V3 MUSHAF SELECTOR MODAL ==========
    function openMushafSelectorModal() {
      const grid = document.getElementById('mushafGrid');
      grid.innerHTML = '';
      MUSHAF_VARIANTS.forEach(v => {
        const card = document.createElement('div');
        card.className = 'mushaf-card' + (v.id === currentMushafVariant ? ' active' : '');
        card.dataset.variant = v.id;
        card.onclick = () => { setMushafVariant(v.id); closeModal('mushafSelectorModal'); };

        const thumb = document.createElement('div');
        thumb.className = 'mushaf-card-thumb';
        const img = document.createElement('img');
        const thumbPage = v.id === 'mushaf-tajweed' ? '003' : '001';
        img.src = v.id === 'mushaf-text' ? '../img/txt.png' : getImagePath(v.id, thumbPage, v.ext);
        img.alt = v.nameAr;
        img.loading = 'lazy';
        img.onerror = function() { this.style.display = 'none'; };
        thumb.appendChild(img);

        const name = document.createElement('div');
        name.className = 'mushaf-card-name';
        name.textContent = v.nameAr;

        const desc = document.createElement('div');
        desc.className = 'mushaf-card-desc';
        desc.textContent = v.desc;

        if (v.id === 'mushaf-madina1441') {
          const badge = document.createElement('span');
          badge.className = 'mushaf-card-badge';
          badge.textContent = 'افتراضي';
          card.appendChild(badge);
        }

        card.appendChild(thumb);
        card.appendChild(name);
        card.appendChild(desc);
        grid.appendChild(card);
      });
      document.getElementById('mushafSelectorModal').classList.add('active');
    }
