// 暗棋音效：全部用 WebAudio 即時合成，不需要音檔。
// 敲擊聲用「模態合成」：幾個不成整數倍的正弦泛音各自衰減，加上一小段濾波雜訊當起音，比單一音調更像實物。
var DanqiSound = (function () {
  'use strict';

  // 材質：泛音比例、基頻、衰減秒數（不同設計方向可選不同材質）
  const TIMBRES = {
    wood: { ratios: [1, 2.76, 5.4, 8.93], base: 520, decay: 0.09, noise: 2600, body: 0.9 },
    ceramic: { ratios: [1, 2.32, 4.25, 6.63], base: 1150, decay: 0.22, noise: 5200, body: 0.6 },
    plastic: { ratios: [1, 2.02, 3.91, 6.1], base: 760, decay: 0.07, noise: 3600, body: 1.0 }
  };

  let ctx = null, master = null, comp = null;
  let enabled = true, volume = 0.8, timbre = TIMBRES.wood;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('這個瀏覽器不支援 WebAudio');
      ctx = new AC();
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 一次敲擊：pitch 為音高倍率、gain 為音量、decayMul 拉長或縮短餘韻
  function knock(t0, pitch, gain, decayMul) {
    const tb = timbre;
    tb.ratios.forEach((r, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = tb.base * pitch * r;
      const amp = gain * tb.body / (1 + i * 1.6);
      const dec = tb.decay * (decayMul || 1) / (1 + i * 0.7);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amp, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dec);
      o.connect(g).connect(master);
      o.start(t0); o.stop(t0 + dec + 0.02);
    });
    noise(t0, 0.025, tb.noise * pitch, 1.4, gain * 0.7);
  }

  function noise(t0, dur, freq, q, gain, sweepTo) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    g.gain.value = gain;
    src.buffer = buf; src.connect(f).connect(g).connect(master);
    src.start(t0);
  }

  function tone(t0, freq, dur, type, gain) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  // 各種事件
  const EVENTS = {
    select(t) { knock(t, 1.6, 0.18, 0.5); },
    deselect(t) { knock(t, 1.3, 0.1, 0.4); },
    invalid(t) { knock(t, 0.55, 0.22, 0.5); knock(t + 0.07, 0.5, 0.16, 0.5); },
    // 翻棋：掀起的摩擦聲＋清脆落定
    flip(t) { noise(t, 0.12, 900, 0.9, 0.35, 3200); knock(t + 0.1, 1.25, 0.5, 1); },
    // 走棋：推動的沙沙聲＋落定
    move(t) { noise(t, 0.16, 500, 0.8, 0.28, 1400); knock(t + 0.14, 1, 0.55, 1); },
    // 吃子：victimValue 越大越重，大子另加一聲低沉的鐘
    capture(t, o) {
      const v = (o && o.value) || 10, heavy = Math.min(1, v / 100);
      noise(t, 0.1, 700, 0.8, 0.3, 1800);
      knock(t + 0.08, 0.85 - heavy * 0.2, 0.75, 1.3);
      knock(t + 0.1, 1.9, 0.25, 0.6);
      tone(t + 0.08, 110 - heavy * 30, 0.25 + heavy * 0.3, 'sine', 0.35 + heavy * 0.3);
      if (v >= 50) [392, 587, 784].forEach((f, i) => tone(t + 0.2 + i * 0.05, f, 1.1, 'triangle', 0.07));
    },
    // 連吃：每多吃一顆音高往上
    chain(t, o) {
      const n = (o && o.n) || 2;
      knock(t, 0.9 + n * 0.12, 0.7, 1.1);
      tone(t, 330 * Math.pow(1.26, n - 1), 0.3, 'triangle', 0.15);
    },
    // 輪到自己：輕輕提示
    turn(t) { tone(t, 880, 0.12, 'sine', 0.05); tone(t + 0.07, 1320, 0.14, 'sine', 0.04); },
    // 快要和局：滴答兩聲
    warn(t) { tone(t, 1760, 0.06, 'square', 0.04); tone(t + 0.14, 1760, 0.06, 'square', 0.04); },
    undo(t) { noise(t, 0.18, 2400, 1, 0.2, 600); },
    win(t) { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(t + i * 0.09, f, 0.5, 'triangle', 0.13); knock(t + i * 0.09, 1 + i * 0.25, 0.15, 0.6); }); },
    lose(t) { [392, 349, 311, 262].forEach((f, i) => tone(t + i * 0.18, f, 0.5, 'triangle', 0.12)); },
    draw(t) { tone(t, 440, 0.45, 'triangle', 0.12); tone(t + 0.22, 440, 0.45, 'triangle', 0.1); },
    start(t) { [0, 0.06, 0.12, 0.18].forEach((d, i) => knock(t + d, 1 + i * 0.06, 0.25, 0.7)); }
  };

  return {
    play(name, opts) {
      if (!enabled || volume <= 0) return;
      try {
        ensure();
        const fn = EVENTS[name];
        if (!fn) throw new Error('沒有這個音效：' + name);
        fn(ctx.currentTime + 0.005, opts);
      } catch (e) {
        console.warn('[暗棋] 音效無法播放（' + name + '）：', e);
      }
    },
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); if (master) master.gain.value = volume; },
    getVolume() { return volume; },
    setTimbre(name) {
      if (!TIMBRES[name]) throw new Error('沒有這種材質音色：' + name);
      timbre = TIMBRES[name];
    }
  };
})();
