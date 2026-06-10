    // ========== SWIPE LOGIC ==========
    // Robust horizontal swipe: use clientX (screenX is unreliable in some Android
    // browsers/webviews, giving diff~0 = no turn), fire as soon as the horizontal
    // threshold is crossed during touchmove (so it still works when the browser ends
    // the gesture with touchcancel), and ignore mostly-vertical moves so scrolling works.
    let pageSwipeStartX = 0, pageSwipeStartY = 0, pageSwipeActive = false, pageSwipeFired = false;
    function _pageSwipeBlocked(t) {
      return !t || !t.closest || t.closest('.modal-content') || t.closest('.audio-expanded-sheet') ||
             t.closest('.audio-mini-player') || t.closest('input');
    }
    function _pageSwipeGo(diff) {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (diff > 0) { if (currentPage < 604) goToPage(currentPage + step); }
      else { if (currentPage > 1) goToPage(currentPage - step); }
    }
    document.addEventListener('touchstart', e => {
      pageSwipeActive = false; pageSwipeFired = false;
      if (fitWidth && window.innerWidth >= 700) return;
      if (_pageSwipeBlocked(e.target)) return;
      const t = e.changedTouches[0];
      pageSwipeStartX = t.clientX; pageSwipeStartY = t.clientY;
      pageSwipeActive = true;
    }, {passive: true});
    document.addEventListener('touchmove', e => {
      if (!pageSwipeActive || pageSwipeFired) return;
      if (e.touches && e.touches.length > 1) { pageSwipeActive = false; return; } // pinch, not swipe
      const t = e.changedTouches[0];
      const dx = t.clientX - pageSwipeStartX, dy = t.clientY - pageSwipeStartY;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        pageSwipeFired = true;
        _pageSwipeGo(dx);
      }
    }, {passive: true});
    function _pageSwipeEnd(e) {
      if (pageSwipeActive && !pageSwipeFired && e.changedTouches && e.changedTouches[0]) {
        const dx = e.changedTouches[0].clientX - pageSwipeStartX;
        const dy = e.changedTouches[0].clientY - pageSwipeStartY;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) _pageSwipeGo(dx);
      }
      pageSwipeActive = false; pageSwipeFired = false;
    }
    document.addEventListener('touchend', _pageSwipeEnd, {passive: true});
    document.addEventListener('touchcancel', _pageSwipeEnd, {passive: true});

    // ========== KEYBOARD NAV (desktop) ==========
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goToPage(currentPage - step); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); goToPage(currentPage + step); }
    });

    // ========== WINDOW INITIALIZATION ==========
    window.onload = function () {
      const imgCont = document.getElementById('mushafContainer');
      let pressTimerCont = null;
      imgCont.addEventListener('touchstart', (e) => {
        if(e.target.classList.contains('ayah-highlight')) return;
        pressTimerCont = setTimeout(() => { showGeneralMenu(); e.preventDefault(); }, 600);
      });
      imgCont.addEventListener('touchend', () => clearTimeout(pressTimerCont));
      imgCont.addEventListener('touchmove', () => clearTimeout(pressTimerCont));

      // Pinch zoom for borderd variant
      let pinchStartDist = 0;
      imgCont.addEventListener('touchstart', e => {
        if (currentMushafVariant !== 'mushaf-borderd' && currentMushafVariant !== 'mushaf-green') return;
        if (e.touches.length === 2) {
          pinchStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
      }, {passive: true});
      imgCont.addEventListener('touchmove', e => {
        if (currentMushafVariant !== 'mushaf-borderd' && currentMushafVariant !== 'mushaf-green') return;
        if (e.touches.length === 2 && pinchStartDist > 0) {
          const dist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
          const threshold = 30;
          if (Math.abs(dist - pinchStartDist) > threshold) {
            borderZoomState = !borderZoomState;
            pinchStartDist = 0;
            updateContent();
          }
        }
      }, {passive: true});
      imgCont.addEventListener('touchend', e => {
        if (e.touches.length < 2) pinchStartDist = 0;
      }, {passive: true});
      imgCont.addEventListener('contextmenu', (e) => {
        if(e.target.classList.contains('ayah-highlight')) return;
        e.preventDefault(); showGeneralMenu();
      });

      if (typeof totalPages === 'undefined') window.totalPages = 604;
      if (typeof SURAH_MAP === 'undefined') window.SURAH_MAP = [];
      if (typeof JUZ_START_PAGES === 'undefined') window.JUZ_START_PAGES = [1,22,42,62,82,102,121,142,162,182,201,222,242,262,282,302,322,342,362,382,402,422,442,462,482,502,522,542,562,582];
      if (typeof getCurrentSurah === 'undefined') window.getCurrentSurah = function () { return null; };
      if (typeof getCurrentJuz === 'undefined') window.getCurrentJuz = function () { return null; };
      if (typeof updateMeta === 'undefined') window.updateMeta = function () { };

      const savedColorTheme = localStorage.getItem('quranColorTheme') || 'golden';
      document.body.setAttribute('data-color-theme', savedColorTheme);
      if (typeof commonInit === 'function') commonInit();

      updateVariantUI();
      checkDailyResetKhatma();

      // Load coordinate sources, then render
      Promise.all([
        initDatabase(),
        initMedinaCoords()
      ]).then(() => {
        updateContent();
      }).catch(() => {
        updateContent();
      });

      // Sync overlay size with image on any layout/viewport change
      const syncOverlay = () => {
        const img = document.getElementById('pageImg');
        const overlay = document.getElementById('highlightOverlay');
        if (img && overlay && img.offsetHeight > 0) {
          overlay.style.width  = img.offsetWidth  + 'px';
          overlay.style.height = img.offsetHeight + 'px';
        }
        syncPlayerWidth();
      };
      const ro = new ResizeObserver(syncOverlay);
      const imgEl = document.getElementById('pageImg');
      if (imgEl) ro.observe(imgEl);
      window.addEventListener('resize', syncOverlay);
      document.addEventListener('orientationchange', () => setTimeout(syncOverlay, 300));

      expandedReciterSelect.value = currentReciter;
      updateReciterUI();
      updateDesktopNavButtons();
      dlInit();

      // Backdrop click closes sheets
      document.getElementById('contextSheetBackdrop').addEventListener('click', closeContextMenu);
      document.getElementById('audioSheetBackdrop').addEventListener('click', closeAudioExpanded);
      document.getElementById('tafsirSheetBackdrop').addEventListener('click', closeTafsirModal);

      setupSheetDragClose(contextSheet);
      setupSheetDragClose(document.getElementById('tafsirModal'));
      setupSheetDragClose(expandedSheet);

      // Back-button interception for modals (Android / browser back)
      history.pushState({ quran: true }, '');
      window.addEventListener('popstate', () => {
        // If tasmee pro panel is open, close it
        const proPanel = document.getElementById('tasmeeProPanel');
        if (proPanel && proPanel.style.display !== 'none') {
          if (typeof closeTasmeePro === 'function') closeTasmeePro();
          history.pushState({ quran: true }, '');
          return;
        }
        // If tasmee setup sheet is open, close it
        const setupSheet = document.getElementById('tasmeeSetupSheet');
        if (setupSheet && setupSheet.classList.contains('visible')) {
          if (typeof closeTasmeeSetup === 'function') closeTasmeeSetup();
          history.pushState({ quran: true }, '');
          return;
        }
        // If any modal overlay is open, close it
        const openModal = document.querySelector('.modal-overlay.active');
        if (openModal) {
          openModal.classList.remove('active');
          history.pushState({ quran: true }, '');
          return;
        }
        // If any sheet is open, close it
        const openSheet = document.querySelector('.audio-expanded-sheet.visible, .bottom-sheet.active');
        if (openSheet) {
          openSheet.classList.remove('visible', 'active');
          history.pushState({ quran: true }, '');
          return;
        }
        // Otherwise allow normal back (to index.html)
      });
    };

    function goHome() { window.location.href = '/Tasbee7/index.html'; }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('../sw.js').catch(console.warn);
