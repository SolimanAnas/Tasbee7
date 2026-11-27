// Noise gate for the voice-polish effect (js/audio-fx.js): lowers the level between
// phrases, where only room noise is left, and opens instantly when the voice comes back.
// An AudioWorklet so it runs the same in the live preview and in OfflineAudioContext
// renders (the export).
class ZadGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'threshold', defaultValue: 0.01, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'floor', defaultValue: 0.25, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.env = 0;
    this.gain = 1;
    this.hold = 0;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0], out = outputs[0];
    if (!inp || !inp.length) return true;
    const th = params.threshold[0], fl = params.floor[0];
    const sr = sampleRate;
    const att = Math.exp(-1 / (0.002 * sr)), rel = Math.exp(-1 / (0.1 * sr));
    const open = Math.exp(-1 / (0.004 * sr)), close = Math.exp(-1 / (0.09 * sr));
    const holdLen = Math.round(0.12 * sr);
    const n = inp[0].length;
    for (let i = 0; i < n; i++) {
      let peak = 0;
      for (let c = 0; c < inp.length; c++) { const v = Math.abs(inp[c][i]); if (v > peak) peak = v; }
      this.env = peak > this.env ? att * this.env + (1 - att) * peak : rel * this.env + (1 - rel) * peak;
      if (this.env >= th) this.hold = holdLen; else if (this.hold > 0) this.hold--;
      const target = this.hold > 0 ? 1 : fl;
      this.gain = target > this.gain ? open * this.gain + (1 - open) * target : close * this.gain + (1 - close) * target;
      for (let c = 0; c < out.length; c++) out[c][i] = (inp[c] || inp[0])[i] * this.gain;
    }
    return true;
  }
}
registerProcessor('zad-gate', ZadGate);
