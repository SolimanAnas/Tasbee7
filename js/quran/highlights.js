    // ========== AYAH HIGHLIGHT RENDERING (uses SQLite coords) ==========

    function getVariantImageDims() {
      switch (currentMushafVariant) {
        case 'mushaf-madina1441': return { w: 1024, h: 1656 };
        case 'mushaf-colored': return { w: 900, h: 1440 };
        case 'mushaf-tajweed': return { w: 600, h: 933 };
        case 'mushaf-borderd': return { w: 682, h: 959 };
        case 'mushaf-green':  return { w: 682, h: 959 };
        default: return { w: 900, h: 1440 };
      }
    }

    function loadAyahHighlights(pageNumber) {
      const overlay = document.getElementById('highlightOverlay');
      const img = document.getElementById('pageImg');
      overlay.innerHTML = '';

      let rects;
      if (currentMushafVariant === 'mushaf-borderd' || currentMushafVariant === 'mushaf-madina1441' || currentMushafVariant === 'mushaf-tajweed' || currentMushafVariant === 'mushaf-green') {
        rects = getMedinaCoordsForPage(pageNumber);
      } else {
        rects = getLegacyCoordsForPage(pageNumber);
      }
      if (!rects || rects.length === 0) return;
      drawAyahHighlights(rects, img, overlay);
    }

    const HL_PAD_X = 0.03;

function getVariantHighlightCal() {
      switch (currentMushafVariant) {
        case 'mushaf-madina1441':
          return {
           refW: 415, refH: 650,
            scaleX: 1.069968, scaleY: 0.949994,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.139991, shiftY: 0.015000,
            imgScaleX: 1.03, imgScaleY: 1.09,
            imgshiftX: 0.0, imgshiftY: -0.060
          };
        case 'mushaf-tajweed':
          return {
            refW: 415, refH: 650,
            scaleX: 1.049968, scaleY: 0.919878,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.129993, shiftY: 0.029069,
            imgScaleX: 1.02, imgScaleY: 1.1,
            imgshiftX: 0.0, imgshiftY: -0.065
          };
        case 'mushaf-borderd':
          return {
            refW: 415, refH: 650,
             scaleX: 0.959980, scaleY: 1.001,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.0, pageBotY: 1.00,
            shiftX: -0.089997, shiftY: -0.013969,
            imgScaleX: 1.2, imgScaleY: 1.4,
            imgshiftX: 0.0, imgshiftY: -0.005
          };
        case 'mushaf-green':
          return {
            refW: 415, refH: 650,
             scaleX: 0.979976, scaleY: 0.890,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.0, pageBotY: 1.00,
            shiftX: -0.089997, shiftY: 0.045083,
            imgScaleX: 1.2, imgScaleY: 1.3,
            imgshiftX: 0.0, imgshiftY: -0.055
          };
        case 'mushaf-colored':
        default:
          return {
            refW: 1024, refH: 1636,
             scaleX: 1.089985, scaleY: 1.00,
            padTop: 0.00, padBot: 0.00,
            pageTopY: 0.00, pageBotY: 1.00,
            shiftX: -0.070002, shiftY: 0.001038,
            imgScaleX: 0.99, imgScaleY: 1.15,
            imgshiftX: 0.0, imgshiftY: 0.010
          };
      }
    }


    function drawAyahHighlights(rects, img, overlay) {
      overlay.style.direction = 'ltr';
      const cal = getVariantHighlightCal();

      for (let rect of rects) {
        const div = document.createElement('div');
        div.className = 'ayah-highlight';
        div.setAttribute('data-surah', rect.surah);
        div.setAttribute('data-ayah', rect.ayah);

        const yRange = cal.pageBotY - cal.pageTopY;

        const leftPct   = (rect.x / cal.refW) * cal.scaleX * 100 + HL_PAD_X * 100 + cal.shiftX * 100;
        const widthPct  = (rect.w / cal.refW) * cal.scaleX * 100;
        const topPct    = (cal.pageTopY + (rect.y / cal.refH) * yRange) * cal.scaleY * 100 + (cal.padTop + cal.shiftY) * 100;
        const heightPct = (rect.h / cal.refH) * yRange * cal.scaleY * 100;

        div.style.left = leftPct + '%';
        div.style.top = topPct + '%';
        div.style.width = widthPct + '%';
        div.style.height = heightPct + '%';

        let clickCount = 0;
        let singleClickTimer;
        div.onclick = (e) => {
          e.stopPropagation();
          clickCount++;
          if (clickCount === 1) {
            singleClickTimer = setTimeout(() => {
              clickCount = 0;
              toggleHeaderUI();
            }, 300);
          } else if (clickCount === 2) {
            clearTimeout(singleClickTimer);
            clickCount = 0;
            highlightAyah(rect.surah, rect.ayah);
            showMiniPlayerForAyah(rect.surah, rect.ayah, false);
          }
        };

        let pressTimer;
        div.addEventListener('touchstart', (e) => {
          pressTimer = setTimeout(() => { highlightAyah(rect.surah, rect.ayah); showContextMenu(rect.surah, rect.ayah); }, 500);
        });
        div.addEventListener('touchend', () => clearTimeout(pressTimer));
        div.addEventListener('touchmove', () => clearTimeout(pressTimer));
        div.addEventListener('contextmenu', (e) => { e.preventDefault(); highlightAyah(rect.surah, rect.ayah); showContextMenu(rect.surah, rect.ayah); });

        if (windowCurrentAyahGlobal && windowCurrentAyahGlobal.surah == rect.surah && windowCurrentAyahGlobal.ayah == rect.ayah) {
          div.classList.add('active');
        }
        overlay.appendChild(div);
      }
    }

    function highlightAyah(surah, ayah) {
      if(!surah || !ayah) return;
      document.querySelectorAll('.ayah-highlight').forEach(el => el.classList.remove('active', 'playing-highlight'));
      const targetHighlights = document.querySelectorAll(`.ayah-highlight[data-surah="${surah}"][data-ayah="${ayah}"]`);
      if (targetHighlights.length > 0) targetHighlights.forEach(el => el.classList.add('active'));
      windowCurrentAyahGlobal = { surah: parseInt(surah), ayah: parseInt(ayah) };
    }

    document.getElementById('mushafContainer').addEventListener('click', (e) => {
      if(e.target.id === 'pageImg' || e.target.id === 'highlightOverlay') {
        toggleHeaderUI();
      }
    });
