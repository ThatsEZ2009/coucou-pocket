// V15: every sound Coucou makes, made right here with WebAudio (no sound files). Kohen couldn't hear the V9 dings: even
// with every slider at the top they only reached about 20% of full loudness (one or two thin sine notes). Now the tunes
// are fuller (soft bell overtones) and much louder, with a limiter in front of the speakers so they never crackle.
// The tunes are data (a list of notes each). Works as a plain <script> in the page (window.CoucouSounds) and as a
// CommonJS module in the tests and in src/main/prefs.js (the tune names).
(function (root) {
  // A note: { f: Hz, at: start (s), len: length (s), wave: 'sine' | 'triangle' | 'square' | 'sawtooth' (sine),
  //   vol: loudness next to the others (1), to: slides to this pitch, path: [[s, Hz], …] a pitch path,
  //   vib: vibrato (Hz) and depth (a part of f), am: a flutter in loudness (Hz: a purr, a growl),
  //   bell: soft overtones (fuller, like a little bell), noise: a puff of air (f = its colour, q = how narrow) }
  const BELL = [[1, 1], [2.01, 0.32], [3.02, 0.12]];
  const b = true;
  const TUNES = {
    // the card tunes ("the rest"'s names, kept so saved picks still work)
    ding: [{ f: 880, at: 0, len: 0.5, bell: b }, { f: 1318.5, at: 0.11, len: 0.6, bell: b }],
    'uh-oh': [{ f: 659.3, at: 0, len: 0.3, wave: 'triangle' }, { f: 523.3, at: 0.17, len: 0.55, wave: 'triangle' }],
    knock: [{ f: 587.3, at: 0, len: 0.12, wave: 'triangle', to: 520 }, { f: 587.3, at: 0.15, len: 0.14, wave: 'triangle', to: 520 }],
    hm: [{ f: 523.3, at: 0, len: 0.28 }, { f: 659.3, at: 0.12, len: 0.45, to: 784 }],
    soft: [{ f: 440, at: 0, len: 0.6, vol: 0.75, bell: b }, { f: 659.3, at: 0.16, len: 0.75, vol: 0.7, bell: b }],
    wobble: [{ f: 740, at: 0, len: 0.75, to: 494, vib: 11, depth: 0.05 }],
    chime: [{ f: 1046.5, at: 0, len: 0.5, vol: 0.85, bell: b }, { f: 1318.5, at: 0.09, len: 0.5, vol: 0.8, bell: b }, { f: 1568, at: 0.18, len: 0.65, vol: 0.75, bell: b }],
    blip: [{ f: 988, at: 0, len: 0.09, wave: 'square', vol: 0.55 }, { f: 1480, at: 0.08, len: 0.12, wave: 'square', vol: 0.5 }],
    // V15: a job done (ta-da), stuck (aww), Claude needs you (boop), and more to pick from
    tada: [{ f: 523.3, at: 0, len: 0.35, bell: b }, { f: 659.3, at: 0.08, len: 0.35, bell: b }, { f: 784, at: 0.16, len: 0.4, bell: b }, { f: 1046.5, at: 0.26, len: 0.9, bell: b }],
    aww: [{ f: 660, at: 0, len: 0.95, to: 415, vib: 6, depth: 0.02 }, { f: 330, at: 0, len: 0.95, to: 208, wave: 'triangle', vol: 0.35 }],
    boop: [{ f: 587.3, at: 0, len: 0.22, bell: b }, { f: 880, at: 0.14, len: 0.4, bell: b }],
    yay: [{ f: 784, at: 0, len: 0.25, bell: b }, { f: 987.8, at: 0.06, len: 0.25, bell: b }, { f: 1174.7, at: 0.12, len: 0.3, bell: b }, { f: 1568, at: 0.18, len: 0.7, bell: b }],
    bling: [{ f: 1318.5, at: 0, len: 0.3, vol: 0.85, bell: b }, { f: 1760, at: 0.07, len: 0.55, vol: 0.85, bell: b }],
    pop: [{ f: 500, at: 0, len: 0.22, to: 1250 }],
    grr: [{ f: 190, at: 0, len: 0.55, wave: 'square', to: 120, am: 28, vol: 0.32 }, { f: 95, at: 0, len: 0.55, wave: 'triangle', to: 70, vol: 0.6 },
      { noise: true, f: 1200, q: 0.8, at: 0.5, len: 0.2, vol: 0.5 }],
    // V15: touches and moves (not for a card): hello, petting, eating your files, a yawn
    hiya: [{ f: 600, at: 0, len: 0.16, to: 900 }, { f: 900, at: 0.15, len: 0.24, to: 700 }],
    giggle: [{ f: 1000, at: 0, len: 0.08, to: 1100, vol: 0.7 }, { f: 1180, at: 0.08, len: 0.08, to: 1280, vol: 0.7 }, { f: 1050, at: 0.16, len: 0.08, to: 1150, vol: 0.7 }, { f: 1250, at: 0.24, len: 0.12, to: 1400, vol: 0.7 }],
    purr: [{ f: 96, at: 0, len: 0.9, wave: 'triangle', am: 24, vol: 0.8 }, { f: 192, at: 0, len: 0.9, wave: 'triangle', am: 24, vol: 0.35 }],
    nom: [{ f: 320, at: 0, len: 0.13, to: 170 }, { f: 320, at: 0.2, len: 0.13, to: 170 }],
    bleh: [{ f: 220, at: 0, len: 0.18, wave: 'square', to: 180, vol: 0.45 }, { f: 196, at: 0.2, len: 0.28, wave: 'square', to: 150, vol: 0.45 }],
    yawn: [{ f: 330, at: 0, len: 1.3, wave: 'triangle', path: [[0.45, 560], [1.2, 250]], vib: 5, depth: 0.02, vol: 0.8 }],
    // V16: the little sounds of moving around (soft): a tab, the panel closing, the peek, his mood changing
    tick: [{ f: 1568, at: 0, len: 0.07, wave: 'triangle', vol: 0.55 }, { f: 2093, at: 0.03, len: 0.08, vol: 0.35 }],
    bye: [{ f: 784, at: 0, len: 0.14, vol: 0.6, bell: b }, { f: 587.3, at: 0.09, len: 0.25, vol: 0.55, bell: b }],
    peek: [{ f: 1046.5, at: 0, len: 0.12, to: 1318.5, vol: 0.45 }],
    'mood-up': [{ f: 880, at: 0, len: 0.12, vol: 0.5, bell: b }, { f: 1174.7, at: 0.07, len: 0.22, vol: 0.5, bell: b }],
    'mood-down': [{ f: 659.3, at: 0, len: 0.14, vol: 0.5 }, { f: 493.9, at: 0.09, len: 0.3, vol: 0.45, to: 440 }],
    'mood-tick': [{ f: 1318.5, at: 0, len: 0.1, vol: 0.4, bell: b }],
  };
  // the ones Settings' Sounds card can pick for a kind of card (tap the name = the next one), then 'off'
  const PICKABLE = ['ding', 'uh-oh', 'knock', 'hm', 'soft', 'wobble', 'chime', 'blip', 'tada', 'aww', 'boop', 'yay', 'bling', 'pop', 'grr'];
  // today's loudness before V15 (the tests compare): a plain sine at 0.08 (volume 60), 0.2 at Kohen's maxed sliders
  const OLD_DING = [{ f: 880, at: 0, len: 0.45, fade: 'v9' }, { f: 1318.5, at: 0.11, len: 0.45, fade: 'v9' }];

  // How loud a sound peaks: the main volume (0-100, a curve so the low half is still usable) × the kind's loudness
  // (0-1.5; 1 = as is). 100 → 0.95 (the limiter keeps the overtones from crackling).
  function levelFor(volume, kind = 1) {
    const v = Math.max(0, Math.min(100, Number(volume) || 0)) / 100;
    const k = Math.max(0, Math.min(1.5, Number.isFinite(kind) ? kind : 1));
    return 0.95 * Math.pow(v, 1.5) * k;
  }

  // how long a tune lasts (s)
  function duration(notes) {
    return (Array.isArray(notes) ? notes : TUNES[notes] || []).reduce((m, n) => Math.max(m, (n.at || 0) + n.len), 0) + 0.05;
  }

  // The limiter in front of the speakers: loud tunes stay clean; quiet ones pass (the compressor's own lift helps too).
  function limiter(ctx) {
    const l = ctx.createDynamicsCompressor();
    l.threshold.value = -8;
    l.knee.value = 2;
    l.ratio.value = 20;
    l.attack.value = 0.001;
    l.release.value = 0.12;
    l.connect(ctx.destination);
    return l;
  }

  const noiseOf = new WeakMap(); // one second of hiss per audio context
  function noise(ctx) {
    if (!noiseOf.has(ctx)) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      noiseOf.set(ctx, buf);
    }
    return noiseOf.get(ctx);
  }

  // Puts a tune's notes on the audio timeline, starting at `start`, peaking at `peak`. → when it ends (s)
  function schedule(ctx, dest, notes, peak, start) {
    let end = start;
    if (!(peak > 0)) return end;
    for (const n of notes) {
      const t = start + (n.at || 0);
      const parts = n.bell ? BELL : [[1, 1]];
      for (const [ratio, partVol] of parts) {
        const top = Math.max(0.0002, peak * (n.vol === undefined ? 1 : n.vol) * partVol);
        const g = ctx.createGain();
        // The shape: in fast, then a bell rings down slowly (higher overtones faster), anything else holds and lets go.
        // (V9's dings dropped to silence almost at once, one more reason they were hard to hear.)
        const att = Math.min(n.attack || 0.012, n.len / 3);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(top, t + att);
        if (n.fade === 'v9') g.gain.exponentialRampToValueAtTime(0.0001, t + n.len); // (the old shape, for the comparison)
        else if (n.bell) g.gain.setTargetAtTime(0.0001, t + att, Math.max(0.03, (n.len - att) / (2.2 * ratio)));
        else {
          g.gain.setValueAtTime(top, t + Math.max(att, n.len * 0.55));
          g.gain.exponentialRampToValueAtTime(0.0001, t + n.len);
        }
        g.gain.setTargetAtTime(0.0001, t + n.len, 0.01); // (a soft end, no click)
        let src;
        if (n.noise) {
          src = ctx.createBufferSource();
          src.buffer = noise(ctx);
          const f = ctx.createBiquadFilter();
          f.type = 'bandpass';
          f.frequency.value = n.f || 1000;
          f.Q.value = n.q || 1;
          src.connect(f).connect(g);
        } else {
          src = ctx.createOscillator();
          src.type = n.wave || 'sine';
          src.frequency.setValueAtTime(n.f * ratio, t);
          if (n.to) src.frequency.exponentialRampToValueAtTime(n.to * ratio, t + n.len * 0.8);
          if (n.path) for (const [at, f] of n.path) src.frequency.exponentialRampToValueAtTime(f * ratio, t + at);
          if (n.vib) wobble(ctx, src.frequency, n.vib, n.f * ratio * (n.depth || 0.03), t, n.len);
          src.connect(g);
        }
        if (n.am) wobble(ctx, g.gain, n.am, top * 0.45, t, n.len);
        g.connect(dest);
        src.start(t);
        src.stop(t + n.len + 0.05);
      }
      end = Math.max(end, t + n.len + 0.05);
    }
    return end;
  }
  // a slow wave added to a setting (pitch = vibrato, loudness = a purr / growl)
  function wobble(ctx, param, rate, depth, t, len) {
    const lfo = ctx.createOscillator();
    const d = ctx.createGain();
    lfo.frequency.value = rate;
    d.gain.value = depth;
    lfo.connect(d).connect(param);
    lfo.start(t);
    lfo.stop(t + len + 0.05);
  }

  // The page's player. make() = a new AudioContext (the tests pass a pretend one). A suspended context is woken up,
  // a closed one replaced, so a sound never goes missing quietly.
  function createPlayer(make = () => new root.AudioContext()) {
    let ctx = null;
    let input = null;
    function ready() {
      if (!ctx || ctx.state === 'closed') {
        ctx = make();
        input = limiter(ctx);
      }
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') ctx.resume().catch(() => {});
      return ctx;
    }
    // → true when something was played
    function play(name, peak) {
      const notes = TUNES[name];
      if (!notes || !(peak > 0)) return false;
      const c = ready();
      schedule(c, input, notes, peak, c.currentTime + 0.02);
      return true;
    }
    return { play, context: () => ctx };
  }

  // The checks (test/look-v15.js): a tune drawn into numbers without a sound (an OfflineAudioContext), and how loud.
  // raw = straight to the speakers without the limiter (the old ding was played that way).
  async function render(notes, peak, { Offline = root.OfflineAudioContext, rate = 44100, raw = false } = {}) {
    const list = Array.isArray(notes) ? notes : TUNES[notes];
    const ctx = new Offline(1, Math.ceil((duration(list) + 0.3) * rate), rate);
    schedule(ctx, raw ? ctx.destination : limiter(ctx), list, peak, 0.02);
    const buf = await ctx.startRendering();
    return buf.getChannelData(0);
  }
  // → { peak (0-1), peakDb, loudDb: the average loudness (RMS) of the part that sounds, in dB }
  function measure(samples, rate = 44100) {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    const win = Math.max(1, Math.round(rate / 100)); // 10 ms windows
    const loud = [];
    for (let i = 0; i + win <= samples.length; i += win) {
      let s = 0;
      for (let j = i; j < i + win; j++) s += samples[j] * samples[j];
      loud.push(Math.sqrt(s / win));
    }
    const sounding = loud.filter((r) => r > peak * 0.05);
    const rms = sounding.length ? Math.sqrt(sounding.reduce((s, r) => s + r * r, 0) / sounding.length) : 0;
    const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -Infinity);
    return { peak, peakDb: db(peak), loudDb: db(rms) };
  }

  const api = { TUNES, PICKABLE, OLD_DING, levelFor, duration, schedule, createPlayer, render, measure };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoucouSounds = api;
})(this);
