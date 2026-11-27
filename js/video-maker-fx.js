// The «مؤثرات صوتية احترافية» panel (pages/video-maker.html): the controls for
// js/audio-fx.js. Every setting has its own slider; values live in state.fx (saved with
// the other settings). Shown while the recitation is the user's own recording.
(function () {
  'use strict';

  window.VMFxUi = function (api) {
    const $ = api.$;
    const S = api.state;
    const num = v => (api.arabicNames() ? api.arDigits(v) : String(v));
    // id → [path in state.fx, label format]
    const SLIDERS = {
      vmFxGate:      [['polish', 'gate'], v => num(Math.round(v)) + '%'],
      vmFxWarmth:    [['polish', 'warmth'], v => '+' + num((+v).toFixed(1)) + ' dB'],
      vmFxClarity:   [['polish', 'clarity'], v => '+' + num((+v).toFixed(1)) + ' dB'],
      vmFxComp:      [['polish', 'comp'], v => num(Math.round(v)) + '%'],
      vmFxRevMix:    [['reverb', 'mix'], v => num(Math.round(v * 100)) + '%'],
      vmFxRevDecay:  [['reverb', 'decay'], v => num((+v).toFixed(1)) + ' s'],
      vmFxEchoMix:   [['echo', 'mix'], v => num(Math.round(v * 100)) + '%'],
      vmFxEchoDelay: [['echo', 'delay'], v => num(Math.round(v * 1000)) + ' ms'],
      vmFxEchoFb:    [['echo', 'feedback'], v => num(Math.round(v * 100)) + '%'],
    };

    function render() {
      const show = api.own.active();
      $('vmFxBox').hidden = !show;
      if (!show) return;
      const f = S.fx;
      $('vmFxOn').checked = f.on;
      $('vmFxBody').classList.toggle('off', !f.on);
      $('vmFxPolish').checked = f.polish.on;
      $('vmFxPolishRows').classList.toggle('off', !f.polish.on);
      $('vmFxNorm').checked = f.polish.normalize;
      Object.keys(SLIDERS).forEach(id => {
        const [[g, k], label] = SLIDERS[id];
        const el = $(id);
        if (document.activeElement !== el) el.value = f[g][k];
        $(id + 'Val').textContent = label(f[g][k]);
      });
      document.querySelectorAll('#vmFxRooms button').forEach(b => b.classList.toggle('active', b.dataset.room === f.reverb.preset));
      $('vmFxRevRows').classList.toggle('off', f.reverb.preset === 'none');
      $('vmFxListenLabel').textContent = api.listening() ? api.tr('vm_fx_stop') : api.tr('vm_fx_listen');
    }

    function changed(final) {
      S.fx.touched = true;
      S.fx = Object.assign(window.AudioFx.sanitize(S.fx), { touched: true });
      render();
      api.fxChanged(final);
    }

    function bindUi() {
      $('vmFxOn').onchange = () => { S.fx.on = $('vmFxOn').checked; changed(true); };
      $('vmFxPolish').onchange = () => { S.fx.polish.on = $('vmFxPolish').checked; changed(true); };
      $('vmFxNorm').onchange = () => { S.fx.polish.normalize = $('vmFxNorm').checked; changed(true); };
      Object.keys(SLIDERS).forEach(id => {
        const [[g, k], label] = SLIDERS[id];
        const el = $(id);
        // the label follows the finger; the sound is rebuilt when the finger lifts
        el.oninput = () => { S.fx[g][k] = parseFloat(el.value); $(id + 'Val').textContent = label(S.fx[g][k]); };
        el.onchange = () => { S.fx[g][k] = parseFloat(el.value); changed(true); };
      });
      document.querySelectorAll('#vmFxRooms button').forEach(b => {
        b.onclick = () => {
          const room = window.AudioFx.ROOMS[b.dataset.room];
          S.fx.reverb.preset = b.dataset.room;
          if (room) { S.fx.reverb.decay = room.decay; S.fx.reverb.mix = room.mix; }
          changed(true);
        };
      });
      $('vmFxListen').onclick = () => api.listenFx();
    }

    return { render, bindUi };
  };
})();
