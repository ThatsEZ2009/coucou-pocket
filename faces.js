// V15: how the mascot feels, everywhere he shows (Kohen: "the character should have emotions with its eyes", "depending on
// the face the color should match: love should be pink", "red glow when he's angry"). One mood per mascot, picked here
// from what's going on; CSS draws each mood's face (data-mood), and the colour (his body's gradient, the glow behind him,
// the sparkles) comes from COLORS. Works as a plain <script> in the page (window.CoucouFaces) and in the unit tests.
(function (root) {
  // every mood: its name in Settings' Faces card, the bottom of his body (tint) and the glow (r, g, b)
  const COLORS = {
    calm: { label: 'Calm', tint: '#dde6f1', glow: '255, 138, 112' }, // (the V1 peek's warm coral glow)
    focused: { label: 'Focused', tint: '#bcd3ff', glow: '79, 139, 255' }, // working: blue
    thinking: { label: 'Thinking', tint: '#d9cdff', glow: '167, 139, 250' }, // lavender
    worried: { label: 'Worried', tint: '#ffdca6', glow: '251, 176, 52' }, // amber / peach: asks you
    curious: { label: 'Curious', tint: '#a6efe4', glow: '34, 211, 238' }, // teal: a question
    surprised: { label: 'Surprised', tint: '#fff1a6', glow: '250, 214, 60' }, // lemon
    happy: { label: 'Happy', tint: '#c8f3d5', glow: '34, 197, 94' }, // mint: done
    excited: { label: 'Excited', tint: '#ffe08a', glow: '255, 196, 40' }, // gold: big wins
    proud: { label: 'Proud', tint: '#ffe08a', glow: '255, 196, 40' },
    love: { label: 'Love', tint: '#ffc2d9', glow: '255, 92, 150' }, // pink
    giggle: { label: 'Giggle', tint: '#ffc2d9', glow: '255, 92, 150' },
    sad: { label: 'Sad', tint: '#c3d1e6', glow: '110, 145, 200' }, // rainy grey-blue
    sleepy: { label: 'Sleepy', tint: '#ddd3f5', glow: '176, 156, 240' }, // lilac
    nom: { label: 'Nom', tint: '#ffd0a1', glow: '255, 150, 60' }, // warm orange
    grumpy: { label: 'Grumpy', tint: '#ffc0b0', glow: '255, 120, 90' }, // coral
    angry: { label: 'Angry', tint: '#ff9e9e', glow: '255, 45, 45' }, // red, with a red glow
    dizzy: { label: 'Dizzy', tint: '#d9cdff', glow: '167, 139, 250' },
  };
  const MOODS = Object.keys(COLORS);
  // eyes that are shut or drawn (arcs, stars, hearts, > <, spirals) don't blink: a blink would squash them away
  const NO_BLINK = new Set(['happy', 'excited', 'love', 'giggle', 'sleepy', 'nom', 'grumpy', 'dizzy']);

  // A Claude Code session: { status: busy | waiting | idle | closed, last: what it did last (thinking …), done: finished
  // in the last few minutes } and whether Coucou is quiet.
  function sessionMood(s, { quiet = false } = {}) {
    if (quiet) return 'sleepy';
    if (!s || typeof s !== 'object') return 'calm';
    if (s.status === 'busy') return s.last === 'thinking' ? 'thinking' : 'focused';
    if (s.status === 'waiting') return 'worried';
    if (s.status === 'closed') return 'sleepy';
    return s.done ? 'happy' : 'calm';
  }

  // A card that dropped down.
  function cardMood(c) {
    if (!c || typeof c !== 'object') return 'calm';
    const red = !!c.force || !!(c.risk && typeof c.risk === 'object' && c.risk.force);
    switch (c.kind) {
      case 'dizzy': return 'dizzy';
      case 'warning':
      case 'permission': return red ? 'angry' : 'worried'; // the red ones (force push, deleting everything, .env & keys): angry
      case 'question':
      case 'form':
      case 'link': return 'curious';
      case 'plan': return 'thinking';
      case 'done': return doneMood(c);
      case 'good':
        if (c.news === 'tests' || c.news === 'happy') return 'excited';
        if (c.news === 'push' || c.news === 'commit' || c.news === 'pr') return 'proud';
        return 'happy';
      default: return 'calm';
    }
  }
  // a finished job: sad when it was stopped (the usage limit), excited for passing tests or a big job, proud for a push /
  // commit / PR, worried when something failed, else happy
  function doneMood(c) {
    const s = c.summary && typeof c.summary === 'object' ? c.summary : null;
    if (!s) return 'happy';
    if (s.stopped) return 'sad';
    const result = Array.isArray(s.result) ? s.result.filter((r) => r && typeof r.text === 'string') : [];
    if (result.some((r) => r.tone === 'bad')) return 'worried';
    if (result.some((r) => /tests? passed/i.test(r.text))) return 'excited';
    if (result.some((r) => /^(pushed|opened PR|made \d+ commits?|committed)/i.test(r.text))) return 'proud';
    if ((Number.isInteger(s.count) && s.count >= 8) || (Number.isFinite(s.mins) && s.mins >= 20)) return 'excited';
    return 'happy';
  }

  // The drop zone while a file is dragged over him: ok = "ooh" (big eyes, mouth open), dropped = nom, refused = grumpy.
  function dropFace(mood) {
    return mood === 'got' ? 'nom' : mood === 'bad' || mood === 'full' ? 'grumpy' : 'surprised';
  }

  // The chat's mascot: thinking while Claude answers; then (V16) as the answer was: happy when done, worried for a heads-up.
  function chatMood({ busy = false, quiet = false, answer = '' } = {}) {
    if (quiet) return 'sleepy';
    if (busy) return 'thinking';
    return answer === 'done' ? 'happy' : answer === 'warn' ? 'worried' : 'calm';
  }

  // Gives a mascot every face part (once): eyebrows, cheeks, a mouth, a tear, the anger mark. Small mascots (the resting
  // notch, chips, the crowds) get class face-small: a simpler face (no shine in the eyes, no glow but a faint one).
  function dressMascot(m, doc = root.document) {
    if (!m || m.dataset.dressed === 'yes') return m;
    const body = m.querySelector('.mascot-body');
    if (!body) return m;
    const add = (cls) => {
      if (body.querySelector(`.${cls.split(' ')[0]}${cls.includes(' ') ? `.${cls.split(' ')[1]}` : ''}`)) return;
      const s = doc.createElement('span');
      s.className = cls;
      body.append(s);
    };
    for (const cls of ['brow brow-left', 'brow brow-right', 'cheek cheek-left', 'cheek cheek-right', 'mouth', 'tear', 'mark']) add(cls);
    m.dataset.dressed = 'yes';
    return m;
  }

  // Sets a mascot's mood: its face (data-mood) and its colours (inline: they win over the older per-card rules).
  // host: where the sparkle dust lives (it takes the glow's colour too).
  function setMood(m, mood, host) {
    if (!m) return;
    const name = Object.hasOwn(COLORS, mood) ? mood : 'calm';
    if (m.dataset.mood === name) return;
    m.dataset.mood = name;
    m.style.setProperty('--tint', COLORS[name].tint);
    m.style.setProperty('--glow', COLORS[name].glow);
    m.style.setProperty('--glow-c', `rgb(${COLORS[name].glow})`); // (V16: a colour, so it fades)
    if (host) host.style.setProperty('--glow', COLORS[name].glow);
  }

  const api = { COLORS, MOODS, NO_BLINK, sessionMood, cardMood, doneMood, dropFace, chatMood, dressMascot, setMood };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoucouFaces = api;
})(this);
