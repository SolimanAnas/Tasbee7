    // ========== PAGE TRANSITION ==========
    window.goToPage = function (page) {
        page = Math.max(1, Math.min(604, page));
        currentPage = page;
        updateContent();
        updateDesktopNavButtons();
    };

    function updateContent() {
      // Dual-page (desktop): the RIGHT page is always odd and the LEFT even, so the
      // spread reads like a real mushaf. Snap an even currentPage back to its odd
      // partner so navigating/searching to an even page still keeps odd on the right.
      if (dualPage && window.innerWidth >= 700 && currentPage % 2 === 0 && currentPage > 1) currentPage--;
      const formattedPage = currentPage.toString().padStart(3, '0');
      const img = document.getElementById('pageImg');
      const v = getVariantInfo(currentMushafVariant);
      const cal = getVariantHighlightCal();
      const container = document.getElementById('mushafContainer');
      img.style.opacity = '0';
      const _ov = document.getElementById('highlightOverlay');
      _ov.innerHTML = '';
      _ov.style.width  = '';
      _ov.style.height = '';
      img.src = getImagePath(currentMushafVariant, formattedPage, v.ext);
      let sx = cal.imgScaleX, sy = cal.imgScaleY;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-green') {
        sx = borderZoomState ? 1.0 : 1.2;
        sy = borderZoomState ? 1.3 : 1.4;
      }
      const container2 = document.getElementById('mushafContainer2');
      const img2 = document.getElementById('pageImg2');
      const sep = document.getElementById('dualPageSep');
      const label1 = document.getElementById('dualPageLabel1');
      const label2 = document.getElementById('dualPageLabel2');
      const isDual = dualPage && window.innerWidth >= 700;
      const isFitW = fitWidth && window.innerWidth >= 700;
      if (isDual) {
        container.style.transform = 'none';
        img.style.maxHeight = '';
        img.style.width = '';
        const nextPage = Math.min(currentPage + 1, 604);
        const showSecond = nextPage !== currentPage;
        if (container2) container2.classList.toggle('dual-active', showSecond);
        if (sep) sep.style.display = showSecond ? '' : 'none';
        if (label1) { label1.style.display = ''; label1.textContent = currentPage; }
        if (label2) { if (showSecond) { label2.style.display = ''; label2.textContent = nextPage; } else { label2.style.display = 'none'; } }
        const formattedNext = nextPage.toString().padStart(3, '0');
        img2.style.opacity = '0';
        img2.src = getImagePath(currentMushafVariant, formattedNext, v.ext);
        img2.onload = () => { img2.style.opacity = '1'; };
        img2.onerror = () => { img2.style.opacity = '1'; };
        img2.style.maxHeight = '';
        img2.style.width = '';
        if (container2) container2.style.transform = 'none';
      } else {
        if (container2) container2.classList.remove('dual-active');
        if (sep) sep.style.display = 'none';
        if (label1) label1.style.display = 'none';
        if (label2) label2.style.display = 'none';
      }
      if (!isDual && isFitW) {
        container.style.transform = 'none';
        img.style.maxHeight = '';
        img.style.width = '';
      } else if (!isDual && window.innerWidth >= 700) {
        container.style.transform = `scale(${sx}, ${sy})`;
        const headerEl = document.getElementById('appHeader');
        const availH = window.innerHeight - (headerEl ? headerEl.offsetHeight : 44) - 90;
        img.style.maxHeight = Math.floor(availH / sy) + 'px';
        img.style.width = 'auto';
      } else if (!isDual) {
        container.style.transform = `scale(${sx}, ${sy}) translate(${cal.imgshiftX * 100}%, ${cal.imgshiftY * 100}%)`;
        img.style.maxHeight = '';
        img.style.width = '';
      }
      img.onload = () => {
        img.style.opacity = '1';
        const overlay = document.getElementById('highlightOverlay');
        overlay.style.width  = img.offsetWidth  + 'px';
        overlay.style.height = img.offsetHeight + 'px';
        loadAyahHighlights(currentPage);
        if (pendingSearchJump) {
          const { surah, ayah } = pendingSearchJump;
          pendingSearchJump = null;
          const targetHighlights = document.querySelectorAll(`.ayah-highlight[data-surah="${surah}"][data-ayah="${ayah}"]`);
          if (targetHighlights.length > 0) {
            targetHighlights.forEach(el => el.classList.add('active'));
            windowCurrentAyahGlobal = { surah, ayah };
            setTimeout(() => {
              targetHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        } else if (windowCurrentAyahGlobal && isPlaying) {
          highlightAyah(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
        }
      };
      img.onerror = () => { img.style.opacity = '1'; };
      if(typeof updateMeta === 'function') updateMeta();
      localStorage.setItem('lastPage', currentPage);
      localStorage.setItem('lastPageTime', Date.now());
      updateBookmarkStar();
      updatePageLabels();
      trackQuranReading();
    }
