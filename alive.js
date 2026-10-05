// Coucou Pocket: he is alive here too. The same moves, faces and sounds as on the PC (acts.js, faces.js, sounds.js and the
// notch's own styles): his face morphs between feelings, he reacts when a card arrives, a tap makes him giggle, rubbing a
// finger over him makes hearts float up, his eyes follow your finger, he glances around and stretches now and then, and after
// a long quiet he dozes off (and yawns awake). Sounds only play after you have touched the page (iOS wants that), never in Quiet.
(function () {
  const Faces = window.CoucouFaces;
  const Acts = window.CoucouActs;
  const Sounds = window.CoucouSounds;
  const lessMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, cls) => {
    const e = document.createElement(tag);
    e.className = cls;
    return e;
  };

  const player = Sounds.createPlayer();
  const env = { touched: false, quiet: () => false, volume: 80 };
  window.addEventListener('pointerdown', () => { env.touched = true; }, { capture: true });
  const play = (name, level = 1) => {
    if (!env.touched || !name) return;
    try {
      player.play(name, Sounds.levelFor(env.volume, level));
    } catch {}
  };

  const gaps = Acts.createGaps();
  const MOVES = [...new Set(Object.values(Acts.ACTS).map((a) => a.move).filter(Boolean))].map((m) => `act-${m}`);
  const CONFETTI = ['#ffd166', '#ff5c8a', '#5eead4', '#a78bfa', '#4ade80', '#60a5fa'];
  const log = []; // (for tests)

  // his mood changes: the eyes close, the face swaps, they pop open with a bounce while the colours fade (all CSS)
  function morph(m, mood, { bounce = true, sound = true } = {}) {
    const from = m.dataset.mood;
    if (from === mood) return;
    if (!from || lessMotion() || !m.getClientRects().length) return Faces.setMood(m, mood);
    if (sound && !env.quiet()) play(Acts.moodSound(from, mood), 0.7);
    clearTimeout(m._morph);
    m.classList.remove('mood-in');
    m.classList.add('mood-out');
    m._morph = setTimeout(() => {
      Faces.setMood(m, mood);
      m.classList.remove('mood-out');
      void m.offsetWidth;
      m.classList.add('mood-in');
      if (!bounce) m.classList.add('no-bounce');
      m._morph = setTimeout(() => m.classList.remove('mood-in', 'no-bounce'), 380);
    }, 95);
  }
  // how he feels now (waits while a move plays: that mood comes after it)
  function face(m, mood) {
    if (!m) return;
    if (m._acting) m._base = mood;
    else morph(m, mood);
  }

  function floatFx(m, kind, n) {
    Acts.fxSpots(kind, n).forEach(([x, y], i) => {
      const f = el('i', `fx fx-${kind}`);
      f.style.left = `${x.toFixed(2)}em`;
      f.style.top = `${(y * 0.74).toFixed(2)}em`;
      f.style.animationDelay = `${(kind === 'confetti' ? Math.random() * 0.4 : i * 0.13).toFixed(2)}s`;
      if (kind === 'confetti') f.style.setProperty('--c', CONFETTI[i % CONFETTI.length]);
      m.append(f);
      setTimeout(() => f.remove(), 3200);
    });
  }

  // a move: a face for a moment, the body's animation, extras floating around him, its sound, then back to how he feels
  function act(m, name, { onCard = false } = {}) {
    const a = Acts.ACTS[name];
    if (!m || !a || !gaps.allow(name, m.id || 'm')) return false;
    log.push(name);
    if (log.length > 50) log.shift();
    if (Acts.canSound(name, { quiet: env.quiet(), gaming: false, prefs: {}, onCard })) play(a.sound, a.touch ? 0.75 : 1);
    clearTimeout(m._actTimer);
    if (!m._acting) m._base = m.dataset.mood || 'calm';
    m._acting = true;
    morph(m, a.mood, { bounce: false, sound: false });
    const body = m.querySelector('.mascot-body');
    body.classList.remove(...MOVES);
    if (a.move && !lessMotion()) {
      void body.offsetWidth;
      body.classList.add(`act-${a.move}`);
    }
    if (a.fx && !lessMotion()) floatFx(m, a.fx[0], a.fx[1]);
    m._actTimer = setTimeout(() => {
      m._acting = false;
      body.classList.remove(...MOVES);
      morph(m, m._base || 'calm', { bounce: false, sound: false });
    }, a.ms);
    return true;
  }

  // ---- touch: a tap = a giggle; rubbing a finger over him = giggle, then hearts and a purr; his eyes follow your finger ----
  function look(m, x, y) {
    const r = m.getBoundingClientRect();
    if (!r.width) return;
    const dx = x - (r.left + r.width / 2);
    const dy = y - (r.top + r.height * 0.42);
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (r.width * 1.5));
    m.style.setProperty('--look-x', `${((dx / d) * k * 0.05).toFixed(3)}em`);
    m.style.setProperty('--look-y', `${((dy / d) * k * 0.03).toFixed(3)}em`);
    clearTimeout(m._ahead);
    m._ahead = setTimeout(() => {
      m.style.removeProperty('--look-x');
      m.style.removeProperty('--look-y');
    }, 3500);
  }
  function touchy(m, { onTouch = () => {} } = {}) {
    const rub = Acts.createRub();
    let pressed = false;
    m.addEventListener('pointerdown', (e) => {
      pressed = true;
      onTouch();
      look(m, e.clientX, e.clientY);
      act(m, 'giggle');
    });
    window.addEventListener('pointerup', () => { pressed = false; });
    window.addEventListener('pointermove', (e) => {
      look(m, e.clientX, e.clientY);
      if (!pressed) return;
      const said = rub(e.clientX, e.timeStamp || Date.now());
      if (said) act(m, said === 'first' ? 'giggle' : 'love');
    });
  }

  // ---- idle life: now and then he glances or stretches (silent); after a long quiet he dozes; any touch / news wakes him ----
  const DOZE_MS = 10 * 60 * 1000;
  function idle(m, { busy = () => false, onDoze = () => {}, onWake = () => {} } = {}) {
    let last = Date.now();
    let dozing = false;
    const wake = () => {
      last = Date.now();
      if (dozing) {
        dozing = false;
        onWake();
        act(m, 'yawn');
      }
    };
    window.addEventListener('pointerdown', wake, { capture: true });
    const tick = () => {
      setTimeout(tick, 25000 + Math.random() * 35000);
      if (busy()) {
        last = Date.now();
        return;
      }
      if (!dozing && Date.now() - last > DOZE_MS) {
        dozing = true;
        onDoze();
        return;
      }
      if (dozing || m._acting) return;
      if (Math.random() < 0.5) {
        m.style.setProperty('--look-x', `${((Math.random() - 0.5) * 0.1).toFixed(3)}em`);
        setTimeout(() => m.style.removeProperty('--look-x'), 1100);
      } else act(m, 'stretch');
    };
    setTimeout(tick, 20000);
    return { wake, dozing: () => dozing };
  }

  window.PocketAlive = { env, face, morph, act, touchy, idle, cardAct: Acts.cardAct, log };
})();
