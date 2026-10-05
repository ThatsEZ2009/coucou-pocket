// V15: the mascot's little moves, each with a face, floating extras and a sound that fits ("a cozy little person").
// An act = a mood for a moment (then back to how he feels) + a body move (CSS) + extras (hearts, stars, z's, ?, !, ✦,
// steam, confetti…) + a sound. Kohen's rule: sounds when something happens or you touch him; silent while idle and during
// Quiet; in a game only the cards. A card's own sound is its kind's tune (Settings), so a card's act adds only the move.
// Works as a plain <script> in the page (window.CoucouActs) and in the unit tests.
(function (root) {
  // mood: the face meanwhile · move: the body's animation · ms: how long · fx: [kind, how many] · sound: its tune ·
  // card: a card plays its own tune, so the act stays silent there · touch: a "cozy sound" (Settings can turn them off) ·
  // gap: the least time between two (ms)
  const ACTS = {
    celebrate: { mood: 'happy', move: 'hop', ms: 1400, fx: ['spark', 5], sound: 'tada', card: true },
    bigwin: { mood: 'excited', move: 'jump2', ms: 1800, fx: ['confetti', 14], sound: 'tada', card: true },
    yay: { mood: 'excited', move: 'jump2', ms: 1600, fx: ['star', 6], sound: 'yay', card: true },
    proud: { mood: 'proud', move: 'squish', ms: 1400, fx: ['spark', 4], sound: 'bling', card: true },
    oh: { mood: 'surprised', move: 'pop', ms: 700, fx: ['q', 1], sound: 'hm', card: true },
    knock: { mood: 'worried', move: 'shake', ms: 900, fx: ['sweat', 1], sound: 'knock', card: true },
    grr: { mood: 'angry', move: 'stomp', ms: 1500, fx: ['steam', 4], sound: 'grr', card: true },
    ponder: { mood: 'thinking', move: 'sway', ms: 1600, fx: ['dot', 3], sound: 'soft', card: true },
    aww: { mood: 'sad', move: 'droop', ms: 1800, fx: ['rain', 3], sound: 'aww', card: true },
    whoa: { mood: 'dizzy', move: 'wobble', ms: 1600, fx: ['star', 4], sound: 'wobble', card: true },
    hello: { mood: 'happy', move: '', ms: 1700, fx: ['spark', 3], sound: 'hiya', touch: true, gap: 45000 },
    nom: { mood: 'nom', move: 'chew', ms: 1100, fx: ['crumb', 4], sound: 'nom', touch: true },
    bleh: { mood: 'grumpy', move: 'shake', ms: 900, fx: ['bang', 1], sound: 'bleh', touch: true, gap: 1500 },
    giggle: { mood: 'giggle', move: 'wiggle', ms: 1200, fx: ['spark', 3], sound: 'giggle', touch: true, gap: 1500 },
    love: { mood: 'love', move: 'sway', ms: 2200, fx: ['heart', 5], sound: 'purr', touch: true, gap: 2500 },
    dizzy: { mood: 'dizzy', move: 'wobble', ms: 1600, fx: ['star', 4], sound: 'wobble', touch: true, gap: 1200 },
    angry: { mood: 'angry', move: 'stomp', ms: 2200, fx: ['steam', 5], sound: 'grr', touch: true, gap: 3000 },
    yawn: { mood: 'sleepy', move: 'stretch', ms: 1800, fx: ['z', 2], sound: 'yawn', touch: true, gap: 20000 },
    doze: { mood: 'sleepy', move: 'breathe', ms: 4000, fx: ['z', 3], sound: '' },
    stretch: { mood: 'happy', move: 'stretch', ms: 1800, fx: null, sound: '' }, // idle life: silent
    // V16: little life everywhere: perks up when the mouse comes, nods while you type, happy when the chat answered
    perk: { mood: 'surprised', move: 'pop', ms: 420, fx: null, sound: '', gap: 1500 },
    nod: { mood: 'curious', move: 'nod', ms: 420, fx: null, sound: '', gap: 650 },
    answered: { mood: 'happy', move: 'hop', ms: 1300, fx: ['spark', 4], sound: 'mood-up', touch: true },
  };

  // V16: the little sounds of moving around: a tab, the big panel closing, the peek opening, his mood changing.
  // Same rules as touches (never in Quiet or a game, Cozy sounds off = none); each at most every gap ms.
  const UI = {
    tab: { sound: 'tick', gap: 120 },
    toggle: { sound: 'tick', gap: 80 },
    close: { sound: 'bye', gap: 4000 },
    peek: { sound: 'peek', gap: 12000 },
    'mood-up': { sound: 'mood-up', gap: 2500 },
    'mood-down': { sound: 'mood-down', gap: 2500 },
    'mood-tick': { sound: 'mood-tick', gap: 2500 },
  };
  const GOOD = new Set(['calm', 'happy', 'excited', 'proud', 'love', 'giggle', 'surprised', 'curious', 'nom']);
  const WORK = new Set(['focused', 'thinking']);
  // his mood changed from → to: which little sound ('' = none: working ↔ thinking happens all the time)
  function moodSound(from, to) {
    if (!from || !to || from === to || (WORK.has(from) && WORK.has(to))) return '';
    if (WORK.has(to)) return 'mood-tick';
    return GOOD.has(to) ? 'mood-up' : 'mood-down';
  }

  // The act for a card that drops down (mood = its face, from faces.js) → a name, or '' for none
  function cardAct(c, mood) {
    if (!c || typeof c !== 'object') return '';
    if (c.kind === 'dizzy') return 'whoa';
    return { angry: 'grr', worried: c.kind === 'done' ? 'aww' : 'knock', curious: 'oh', thinking: 'ponder', happy: 'celebrate',
      excited: c.kind === 'done' && !(c.summary && Array.isArray(c.summary.result) && c.summary.result.some((r) => r && /tests? passed/i.test(r.text))) ? 'bigwin' : 'yay',
      proud: 'proud', sad: 'aww' }[mood] || '';
  }

  // The act the Settings' Faces card plays for each feeling (so every one can be seen and heard)
  const FACE_ACT = { calm: 'hello', focused: '', thinking: 'ponder', worried: 'knock', curious: 'oh', surprised: 'oh', happy: 'celebrate',
    excited: 'yay', proud: 'proud', love: 'love', giggle: 'giggle', sad: 'aww', sleepy: 'yawn', nom: 'nom', grumpy: 'bleh', angry: 'grr', dizzy: 'dizzy' };

  // May this act make its sound? (onCard: it's a card's act, and the card plays its own tune; preview: the Faces card)
  function canSound(name, { quiet = false, gaming = false, prefs = {}, onCard = false, preview = false } = {}) {
    if (UI[name]) return !quiet && !gaming && prefs.sound !== false && prefs.cozySounds !== false; // (V16)
    const a = ACTS[name];
    if (!a || !a.sound || quiet || prefs.sound === false) return false;
    if (preview) return true;
    if (onCard && a.card) return false;
    if (a.touch && (gaming || prefs.cozySounds === false)) return false;
    return true;
  }

  // Remembers when each act last played (per mascot), so nothing repeats too often.
  function createGaps(now = () => Date.now()) {
    const last = new Map();
    return {
      allow(name, who = '') {
        const a = ACTS[name] || UI[name];
        if (!a) return false;
        const key = `${who}|${name}`;
        const t = now();
        if (a.gap && last.has(key) && t - last.get(key) < a.gap) return false;
        last.set(key, t);
        return true;
      },
    };
  }

  // Rubbing: the mouse turning back and forth over him (or the notch shaken while you slide it). Feed it the x of each
  // move; it answers 'first' after `first` quick turns, 'more' after `more` (each once until it's still for `restMs`).
  function createRub({ first = 3, more = 8, windowMs = 1300, restMs = 1200, minMove = 4 } = {}) {
    let turns = [];
    let lastX = null;
    let dir = 0;
    let lastAt = 0;
    let said = '';
    return function feed(x, t) {
      if (lastAt && t - lastAt > restMs) {
        turns = [];
        said = '';
        dir = 0;
        lastX = null;
      }
      lastAt = t;
      if (lastX === null) {
        lastX = x;
        return '';
      }
      const dx = x - lastX;
      if (Math.abs(dx) < minMove) return '';
      lastX = x;
      const d = Math.sign(dx);
      if (dir && d !== dir) turns.push(t);
      dir = d;
      turns = turns.filter((at) => t - at <= windowMs * (said === 'first' ? 2.5 : 1));
      if (said !== 'more' && said === 'first' && turns.length >= more) return (said = 'more');
      if (!said && turns.length >= first) return (said = 'first');
      return '';
    };
  }

  // Where the extras go and how they fly: [left, top] in the mascot's own size (em), around his head.
  function fxSpots(kind, n, rand = Math.random) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const spread = n > 1 ? i / (n - 1) : 0.5;
      if (kind === 'confetti') out.push([0.1 + rand() * 0.8, -0.15 - rand() * 0.2]);
      else if (kind === 'steam') out.push([i % 2 ? 0.86 : 0.14, 0.02 + (i >> 1) * 0.04]);
      else if (kind === 'z' || kind === 'dot') out.push([0.78 + i * 0.1, kind === 'z' ? 0.05 - i * 0.12 : 0.02]);
      else if (kind === 'sweat') out.push([0.9, 0.18]);
      else if (kind === 'rain') out.push([0.25 + spread * 0.5, -0.2]);
      else if (kind === 'crumb') out.push([0.25 + spread * 0.5, 0.95]);
      else if (kind === 'q' || kind === 'bang') out.push([0.88, -0.12]);
      else out.push([0.05 + spread * 0.9, -0.08 - Math.sin(spread * Math.PI) * 0.2]); // hearts, stars, sparks: an arc over him
    }
    return out;
  }

  const api = { ACTS, UI, FACE_ACT, cardAct, moodSound, canSound, createGaps, createRub, fxSpots };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoucouActs = api;
})(this);
