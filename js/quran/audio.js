    // ========== AUDIO PLAYER ==========
    const svgPlay = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="padding:13%"><path d="M8 5v14l11-7z"/></svg>`;
    const svgPause = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor" style="padding:13%"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    const AUDIO_FETCH_TIMEOUT = 10000;

    let audioPlayer = new Audio();
    const preloaderAudio = new Audio();

    audioPlayer.onerror = () => {
      console.error('Audio playback error:', audioPlayer.error);
      isPlaying = false;
      updatePlayButtons(false);
      showCustomToast("خطأ في تشغيل الملف الصوتي — تحقق من الاتصال");
    };

    let currentReciter = localStorage.getItem('quranReciter') || 'ar.minshawi';
    let isPlaying = false;
    let currentPlaylist = [];
    let currentIndex = 0;
    let currentVerseRepeat = 0;
    let currentRangeRepeat = 0;

    const miniPlayer = document.getElementById('audioMiniPlayer');
    const expandedSheet = document.getElementById('audioExpandedSheet');
    const miniReciterName = document.getElementById('miniReciterName');
    const miniPlayPause = document.getElementById('miniPlayPauseBtn');
    const expandedPlayPause = document.getElementById('expandedPlayPauseBtn');
    const prevBtn = document.getElementById('prevAyahBtn');
    const nextBtn = document.getElementById('nextAyahBtn');
    const expandedReciterSelect = document.getElementById('expandedReciterSelect');

    const verseRepeatToggle = document.getElementById('verseRepeatToggle');
    const verseRepeatGroup = document.getElementById('verseRepeatGroup');
    const verseRepeatInput = document.getElementById('verseRepeatCount');
    const rangeRepeatToggle = document.getElementById('rangeRepeatToggle');
    const rangeRepeatGroup = document.getElementById('rangeRepeatGroup');
    const rangeRepeatInput = document.getElementById('rangeRepeatCount');
    const rangeFromInput = document.getElementById('rangeFromInput');
    const rangeToInput = document.getElementById('rangeToInput');
    const speedSelect = document.getElementById('playbackSpeed');

    miniPlayPause.innerHTML = svgPlay;
    expandedPlayPause.innerHTML = svgPlay;

    verseRepeatToggle.addEventListener('change', (e) => {
        if(e.target.checked) verseRepeatGroup.classList.add('active');
        else verseRepeatGroup.classList.remove('active');
    });
    rangeRepeatToggle.addEventListener('change', (e) => {
        if(e.target.checked) rangeRepeatGroup.classList.add('active');
        else rangeRepeatGroup.classList.remove('active');
    });

    function updateReciterUI() {
      if(expandedReciterSelect) {
          let exists = Array.from(expandedReciterSelect.options).some(opt => opt.value === currentReciter);
          if (!exists && expandedReciterSelect.options.length > 0) {
              currentReciter = expandedReciterSelect.options[0].value;
          }
          expandedReciterSelect.value = currentReciter;
          if(expandedReciterSelect.selectedIndex >= 0) {
              const opt = expandedReciterSelect.options[expandedReciterSelect.selectedIndex];
              if(miniReciterName) miniReciterName.textContent = opt.dataset.short || opt.text;
              const tn = document.getElementById('reciterTriggerName');
              if(tn) tn.textContent = opt.text;
          }
      }
      localStorage.setItem('quranReciter', currentReciter);
    }

    function toggleReciterPicker() {
      const wrap = document.querySelector('.reciter-wrapper');
      if (!wrap) return;
      const opening = !wrap.classList.contains('rp-open');
      wrap.classList.toggle('rp-open', opening);
      if (opening) {
        buildReciterPicker();
        setTimeout(() => {
          document.addEventListener('click', closeReciterPickerOutside, { once: true });
        }, 0);
      }
    }
    function closeReciterPickerOutside(e) {
      if (!e.target.closest('.reciter-wrapper')) {
        document.querySelector('.reciter-wrapper')?.classList.remove('rp-open');
      }
    }
    function buildReciterPicker() {
      const panel = document.getElementById('reciterPickerEl');
      if (!panel) return;
      panel.innerHTML = '';
      const sel = document.getElementById('expandedReciterSelect');
      [...sel.children].forEach(child => {
        if (child.tagName === 'OPTGROUP') {
          const lbl = document.createElement('div');
          lbl.className = 'rp-group-lbl';
          lbl.textContent = child.label;
          panel.appendChild(lbl);
          [...child.children].forEach(opt => panel.appendChild(makeRpItem(opt, sel)));
        } else if (child.tagName === 'OPTION') {
          panel.appendChild(makeRpItem(child, sel));
        }
      });
    }
    function makeRpItem(opt, sel) {
      const item = document.createElement('div');
      item.className = 'rp-item' + (opt.value === sel.value ? ' rp-active' : '');
      item.innerHTML = `<div class="rp-dot"></div><div class="rp-name">${opt.text}</div>`;
      item.onclick = (e) => {
        e.stopPropagation();
        sel.value = opt.value;
        sel.dispatchEvent(new Event('change'));
        document.querySelector('.reciter-wrapper')?.classList.remove('rp-open');
      };
      return item;
    }

    async function fetchAudioData(surah, ayah) {
      const reference = `${surah}:${ayah}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), AUDIO_FETCH_TIMEOUT);
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${reference}/${currentReciter}`, { signal: controller.signal });
        clearTimeout(timer);
        const data = await res.json();
        if(data.code === 200 && data.data) {
          if (data.data.audio && typeof AudioCache !== 'undefined') {
            AudioCache.put(data.data.audio, new Response('')).catch(() => {});
          }
          return data.data;
        }
      } catch(e) {
        if (e.name === 'AbortError') console.warn('Audio fetch timeout:', reference);
        else console.error('Audio fetch error:', e);
      }
      return null;
    }

    async function preloadNext() {
       if(!windowCurrentAyahGlobal) return;
       let nextSurah = windowCurrentAyahGlobal.surah;
       let nextAyahNum = windowCurrentAyahGlobal.ayah + 1;
       const rTo = parseInt(rangeToInput.value);
       const rFrom = parseInt(rangeFromInput.value) || 1;
       const rCount = parseInt(rangeRepeatInput.value) || 1;
       const vRepeat = parseInt(verseRepeatInput.value) || 1;
       if (verseRepeatToggle.checked && currentVerseRepeat < vRepeat - 1) {
           nextAyahNum = windowCurrentAyahGlobal.ayah;
       } else if (rangeRepeatToggle.checked && rTo > 0 && windowCurrentAyahGlobal.ayah >= rTo) {
           if (currentRangeRepeat < rCount - 1) nextAyahNum = rFrom;
           else return;
       } else {
         const maxAyah = ayahCountMap[nextSurah] || AYAH_COUNTS_FALLBACK[nextSurah] || 286;
         if (nextAyahNum > maxAyah) { nextSurah++; nextAyahNum = 1; }
         if (nextSurah > 114) return;
       }
       try {
         const nextData = await fetchAudioData(nextSurah, nextAyahNum);
         if (nextData && nextData.audio) {
             preloaderAudio.src = nextData.audio;
             preloaderAudio.preload = 'auto';
             preloaderAudio.load();
         }
       } catch (_) {}
    }

    async function startPlayback(surah, ayah) {
      if(!surah || !ayah) return;
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      const data = await fetchAudioData(surah, ayah);
      if(!data) {
          try {
            const next = await getNextAyahDb(surah, ayah);
            if (next) { startPlayback(next.surah, next.ayah); }
            else { stopAudio(); showCustomToast("تم اختراق القرآن الكريم"); }
          } catch (_) {
            stopAudio();
          }
          return;
      }
      currentPlaylist = [{ surah, ayah, audioUrl: data.audio, page: data.page }];
      currentIndex = 0;
      playCurrent();
    }

    async function playCurrent() {
      if(currentIndex >= currentPlaylist.length) { stopAudio(); return; }
      const item = currentPlaylist[currentIndex];
      windowCurrentAyahGlobal = { surah: item.surah, ayah: item.ayah };
      if (item.page && item.page !== currentPage) { window.goToPage(item.page); }

      let audioUrl = item.audioUrl;
      if (typeof AudioCache !== 'undefined') {
        try {
          const cached = await AudioCache.fetchCached(item.audioUrl);
          if (cached) {
            const blob = await cached.blob();
            audioUrl = URL.createObjectURL(blob);
          }
        } catch (_) {}
      }

      audioPlayer.src = audioUrl;
      audioPlayer.playbackRate = parseFloat(speedSelect.value);
      audioPlayer.play().catch(e => {
        console.error('Audio play() error:', e);
        showCustomToast("خطأ في التشغيل — جارٍ المحاولة مرة أخرى");
        setTimeout(() => {
          audioPlayer.play().catch(() => {});
        }, 1500);
      });
      isPlaying = true; updatePlayButtons(true);
      highlightAyah(item.surah, item.ayah);
      preloadNext().catch(() => {});
      if ('mediaSession' in navigator) {
        const surahName = document.getElementById('surahLabel')?.textContent || `سورة ${item.surah}`;
        const recOpt = expandedReciterSelect.options[expandedReciterSelect.selectedIndex];
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  `${surahName} — الآية ${item.ayah}`,
          artist: recOpt ? recOpt.text : '',
          album:  'المصحف الشريف',
          artwork: [
            { src: '../icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '../icons/icon_512.png', sizes: '512x512', type: 'image/png' }
          ]
        });
        navigator.mediaSession.setActionHandler('play',          () => { audioPlayer.play(); isPlaying = true;  updatePlayButtons(true); });
        navigator.mediaSession.setActionHandler('pause',         () => { audioPlayer.pause(); isPlaying = false; updatePlayButtons(false); });
        navigator.mediaSession.setActionHandler('nexttrack',     () => nextAyah());
        navigator.mediaSession.setActionHandler('previoustrack', () => prevAyah());
      }
    }

    async function nextAyah() {
       try {
         if(!windowCurrentAyahGlobal) {
             const first = await getFirstAyahOfPage(currentPage);
             if (first) { windowCurrentAyahGlobal = first; } else return;
         }
         const rTo = parseInt(rangeToInput.value);
         const rFrom = parseInt(rangeFromInput.value) || 1;
         const rCount = parseInt(rangeRepeatInput.value) || 1;
         if (rangeRepeatToggle.checked && rTo > 0 && windowCurrentAyahGlobal.ayah >= rTo) {
             if (currentRangeRepeat < rCount - 1) {
                 currentRangeRepeat++;
                 startPlayback(windowCurrentAyahGlobal.surah, rFrom);
             } else {
                 stopAudio(); currentRangeRepeat = 0;
             }
         } else {
             const next = await getNextAyahDb(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
             if (next) {
                 startPlayback(next.surah, next.ayah);
             } else {
                 stopAudio(); showCustomToast("تم اختراق القرآن الكريم");
             }
         }
       } catch (e) {
         console.error('nextAyah error:', e);
         stopAudio();
       }
    }

    async function prevAyah() {
       try {
         if(!windowCurrentAyahGlobal) {
             const first = await getFirstAyahOfPage(currentPage);
             if (first) { windowCurrentAyahGlobal = first; } else return;
         }
         const prev = await getPrevAyahDb(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
         if (prev) {
             startPlayback(prev.surah, prev.ayah);
         } else {
             showCustomToast("هذه بداية المصحف");
         }
       } catch (e) {
         console.error('prevAyah error:', e);
         stopAudio();
       }
    }

    async function togglePlayPause(e) {
      if(e) e.stopPropagation();
      if(isPlaying) { audioPlayer.pause(); isPlaying = false; updatePlayButtons(false); }
      else {
        if(audioPlayer.src && currentPlaylist.length && currentPlaylist[0].surah === windowCurrentAyahGlobal?.surah && currentPlaylist[0].ayah === windowCurrentAyahGlobal?.ayah) {
            audioPlayer.play(); isPlaying = true; updatePlayButtons(true);
        } else if(windowCurrentAyahGlobal) {
            startPlayback(windowCurrentAyahGlobal.surah, windowCurrentAyahGlobal.ayah);
        } else {
            try {
              const first = await getFirstAyahOfPage(currentPage);
              if (first) {
                  windowCurrentAyahGlobal = first;
                  startPlayback(first.surah, first.ayah);
              } else {
                  showCustomToast("الرجاء تحديد آية أولاً");
              }
            } catch (_) {
              showCustomToast("خطأ في تحميل الآيات");
            }
        }
      }
    }
        }
      }
    }

    function updatePlayButtons(playing) {
      miniPlayPause.innerHTML = playing ? svgPause : svgPlay;
      expandedPlayPause.innerHTML = playing ? svgPause : svgPlay;
    }

    function stopAudio() {
      audioPlayer.pause(); audioPlayer.currentTime = 0; isPlaying = false; updatePlayButtons(false);
      document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
    }

    audioPlayer.onended = () => {
      if (verseRepeatToggle.checked) {
          const vRepeat = parseInt(verseRepeatInput.value) || 1;
          if(currentVerseRepeat < vRepeat - 1) { currentVerseRepeat++; playCurrent(); return; }
      }
      currentVerseRepeat = 0;
      nextAyah();
    };

    speedSelect.onchange = () => { if(audioPlayer) audioPlayer.playbackRate = parseFloat(speedSelect.value); };

    // â”€â”€ Desktop page nav â”€â”€
    function updateDesktopNavButtons() {
      const prev = document.getElementById('desktopPrevBtn');
      const next = document.getElementById('desktopNextBtn');
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (prev) prev.classList.toggle('disabled', currentPage <= 1);
      if (next) next.classList.toggle('disabled', currentPage >= 604);
    }
    window.desktopNavPrev = function() {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (currentPage > 1) goToPage(currentPage - step);
    };
    window.desktopNavNext = function() {
      const step = (dualPage && window.innerWidth >= 700) ? 2 : 1;
      if (currentPage < 604) goToPage(currentPage + step);
    };

    /* â”€â”€ Fit-width & dual-page modes (desktop only) â”€â”€ */
    let fitWidth = localStorage.getItem('quranFitWidth') === '1';
    let dualPage = localStorage.getItem('quranDualPage') === '1';

    window.toggleFitWidth = function() {
      if (window.innerWidth < 700) return;
      fitWidth = !fitWidth;
      dualPage = false;
      localStorage.setItem('quranFitWidth', fitWidth ? '1' : '0');
      localStorage.setItem('quranDualPage', '0');
      document.body.classList.toggle('fit-width', fitWidth);
      document.body.classList.remove('dual-page');
      document.getElementById('fitWidthBtn')?.classList.toggle('mode-active', fitWidth);
      document.getElementById('dualPageBtn')?.classList.remove('mode-active');
      updateContent();
    };
    window.toggleDualPage = function() {
      if (window.innerWidth < 700) return;
      dualPage = !dualPage;
      fitWidth = false;
      localStorage.setItem('quranDualPage', dualPage ? '1' : '0');
      localStorage.setItem('quranFitWidth', '0');
      document.body.classList.toggle('dual-page', dualPage);
      document.body.classList.remove('fit-width');
      document.getElementById('dualPageBtn')?.classList.toggle('mode-active', dualPage);
      document.getElementById('fitWidthBtn')?.classList.remove('mode-active');
      if (dualPage && currentPage % 2 === 0 && currentPage > 1) currentPage--;
      updateContent();
    };
    function initDesktopModes() {
      if (window.innerWidth >= 700) {
        const fb = document.getElementById('fitWidthBtn');
        const db = document.getElementById('dualPageBtn');
        if (fb) { fb.style.display = ''; fb.classList.toggle('mode-active', fitWidth); }
        if (db) { db.style.display = ''; db.classList.toggle('mode-active', dualPage); }
      }
      document.body.classList.toggle('fit-width', fitWidth && window.innerWidth >= 700);
      document.body.classList.toggle('dual-page', dualPage && window.innerWidth >= 700);
    }
    initDesktopModes();
    window.addEventListener('resize', initDesktopModes);

    // â”€â”€ Sync audio player width to mushaf image â”€â”€
    function syncPlayerWidth() {
      const player = document.getElementById('audioMiniPlayer');
      if (!player) return;
      if (window.innerWidth < 700) { player.style.left = ''; player.style.right = ''; return; }
      const img = document.getElementById('pageImg');
      if (!img || !img.offsetWidth) return;
      const rect = img.getBoundingClientRect();
      const pad = 4;
      player.style.left  = Math.max(8, Math.round(rect.left  + pad)) + 'px';
      player.style.right = Math.max(8, Math.round(window.innerWidth - rect.right + pad)) + 'px';
    }

    // â”€â”€ Header/UI show-hide â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let _headerHidden     = false;
    let _headerToggleLock = false;
    let _headerLastShown  = Date.now();

    function setHeaderVisible(show) {
      if (window.innerWidth >= 700) return; // pinned on desktop via CSS
      if (_headerHidden === !show) return;
      if (!show && Date.now() - _headerLastShown < 1500) return;
      if (show) _headerLastShown = Date.now();
      _headerHidden = !show;
      const header = document.getElementById('appHeader');
      header.classList.toggle('hidden-ui', !show);
      if (!show) {
        miniPlayer.classList.add('hidden-ui');
        miniPlayer.classList.remove('visible');
        if (!isPlaying) {
          document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
          windowCurrentAyahGlobal = null;
        }
      }
    }

    function toggleHeaderUI() {
      if (window.innerWidth >= 700) return;
      if (_headerToggleLock) return;
      _headerToggleLock = true;
      setTimeout(() => { _headerToggleLock = false; }, 420);
      setHeaderVisible(_headerHidden);
    }
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    function showMiniPlayerForAyah(surah, ayah, autoplay = false) {
      setHeaderVisible(true); // ensure header is visible when mini-player appears
      miniPlayer.classList.remove('hidden-ui');
      miniPlayer.classList.add('visible');
      rangeFromInput.value = ayah; rangeToInput.value = ''; currentRangeRepeat = 0;
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
      if(autoplay) {
         startPlayback(surah, ayah);
      } else {
         if(audioPlayer.src && isPlaying) stopAudio();
         updatePlayButtons(false);
         highlightAyah(surah, ayah);
      }
    }

    function toggleExpandPlayer() {
      expandedSheet.classList.add('visible');
      document.getElementById('audioSheetBackdrop').classList.add('visible');
    }
    function openRepeatSettings() { closeContextMenu(); toggleExpandPlayer(); }

    expandedPlayPause.onclick = () => togglePlayPause();
    prevBtn.onclick = prevAyah; nextBtn.onclick = nextAyah;
    expandedReciterSelect.onchange = () => {
      currentReciter = expandedReciterSelect.value;
      updateReciterUI();
      if(currentPlaylist.length) startPlayback(currentPlaylist[0].surah, currentPlaylist[0].ayah);
    };
    function closeAudioExpanded() {
      expandedSheet.classList.remove('visible');
      document.getElementById('audioSheetBackdrop').classList.remove('visible');
    }
