// Coucou Pocket: the phone page. Pairs once with the code from Coucou's Settings → Phone, then shows what the notch shows and
// answers for you. All text goes in with textContent (nothing the PC says is ever treated as HTML).
(function () {
  const Faces = window.CoucouFaces;
  const Sounds = window.CoucouSounds;
  const Alive = window.PocketAlive;
  const Link = window.PocketLink;
  const Client = window.PocketClient;
  const $ = (id) => document.getElementById(id);
  const KEY = 'coucou-pocket-v1';
  const WIDGET = /[?&]w=1/.test(location.search); // the Home Screen widget view (inside the Widget Web app)

  const store = {
    load() {
      try {
        const o = JSON.parse(localStorage.getItem(KEY));
        return o && Link.validKey(o.key) && Link.validTopic(o.down) && Link.validTopic(o.up) ? o : null;
      } catch {
        return null;
      }
    },
    save(cfg) {
      try {
        localStorage.setItem(KEY, JSON.stringify(cfg));
      } catch {}
    },
    clear() {
      try {
        localStorage.removeItem(KEY);
      } catch {}
    },
  };

  // ---------- small helpers ----------
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const mascot = (size) => {
    const m = el('div', 'mascot');
    m.style.setProperty('--mascot-size', `${size}px`);
    const body = el('div', 'mascot-body');
    body.append(el('span', 'eye eye-left'), el('span', 'eye eye-right'));
    m.append(body);
    Faces.dressMascot(m);
    return m;
  };
  const sparkle = (host, count, seed) => {
    const dust = el('span', 'dust');
    dust.setAttribute('aria-hidden', 'true');
    let s = seed;
    const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < count; i++) {
      const star = el('i');
      const a = rand() * Math.PI * 2;
      const r = 0.55 + rand() * 0.45;
      const size = 4 + Math.round(rand() * 4);
      star.style.left = `${(50 + Math.cos(a) * r * 50).toFixed(1)}%`;
      star.style.top = `${(50 + Math.sin(a) * r * 50).toFixed(1)}%`;
      star.style.width = star.style.height = `${size}px`;
      star.style.animationDuration = `${(2.4 + rand() * 2.6).toFixed(2)}s`;
      star.style.animationDelay = `${(-rand() * 4).toFixed(2)}s`;
      star.style.setProperty('--o', (0.3 + rand() * 0.35).toFixed(2));
      dust.append(star);
    }
    host.prepend(dust);
  };

  // ---------- sounds (only after you have touched the page: iOS wants that) ----------
  const player = Sounds.createPlayer();
  let touched = false;
  window.addEventListener('pointerdown', () => { touched = true; }, { once: true, capture: true });
  const TUNE_OF = { permission: 'knock', question: 'hm', plan: 'soft', done: 'tada', stuck: 'aww', warning: 'ding', 'warning-red': 'uh-oh' };
  function ding(kind) {
    if (!touched || quietNow()) return;
    const name = TUNE_OF[kind];
    if (name) try { player.play(name, Sounds.levelFor(80, 1)); } catch {}
  }

  // ---------- state ----------
  const S = { cfg: null, client: null, conn: 'down', seenAt: 0, quietUntil: 0, sessions: { main: null, chips: [], running: 0 }, asks: new Map(), cards: [],
    ui: new Map(), banner: '', drawn: new Set(), widget: false, dozing: false };
  const quietNow = () => Date.now() < S.quietUntil;
  const uiOf = (id) => {
    if (!S.ui.has(id)) S.ui.set(id, { qi: 0, answers: {}, picked: new Set(), confirm: false, sent: false, sentAt: 0 });
    return S.ui.get(id);
  };

  // a card arrived: his move for it (a hop and confetti for good news, a stomp for the red ones, a shake for a worry…)
  function reactTo(card) {
    if (S.widget || !heroMascot) return;
    if (S.dozing) { S.dozing = false; }
    setTimeout(() => Alive.act(heroMascot, Alive.cardAct(card, Faces.cardMood(card)), { onCard: true }), 260);
  }

  function onItem(c, d) {
    switch (c) {
      case 'hello-ok': S.asks.clear(); break; // the PC's snapshot follows: what is really waiting
      case 'sessions': S.sessions = d || S.sessions; break;
      case 'quiet': S.quietUntil = d && d.until ? d.until : 0; break;
      case 'ask':
        if (d && d.id) {
          const fresh = !S.asks.has(d.id);
          S.asks.set(d.id, d);
          if (fresh) {
            ding(d.kind === 'plan' ? 'plan' : d.kind === 'permission' ? (d.risk && d.risk.force ? 'warning-red' : 'permission') : 'question');
            reactTo(d);
          }
        }
        break;
      case 'ask-over': S.asks.delete(d); S.ui.delete(d); break;
      case 'answer-result':
        if (d && !d.ok) {
          S.banner = 'That one was already answered on your PC.';
          S.asks.delete(d.id);
          setTimeout(() => { S.banner = ''; render(); }, 5000);
        }
        break;
      case 'card':
        if (d && d.id) {
          S.cards = [d, ...S.cards.filter((x) => x.id !== d.id && x.id !== d.replaces)].slice(0, 6);
          if (d.kind === 'done' && !(d.summary && d.summary.pending)) {
            ding(d.summary && d.summary.stopped ? 'stuck' : 'done');
            reactTo(d);
          }
        }
        break;
      case 'toast':
        if (d && d.msg) {
          S.banner = `${d.name || 'Claude'} ${d.msg}${d.sub ? ` · ${d.sub}` : ''}`;
          if (d.kind === 'problem') ding('stuck');
          setTimeout(() => { S.banner = ''; render(); }, 8000);
        }
        break;
      case 'warning':
        if (d && d.id && d.state !== 'done') ding(d.force ? 'warning-red' : 'warning');
        break;
      default: break;
    }
    if (!S.widget) render();
  }

  // ---------- answers ----------
  function answer(id, reply) {
    const u = uiOf(id);
    u.sent = true;
    u.sentAt = Date.now();
    render();
    S.client.answer(id, reply).catch(() => { u.sent = false; S.banner = 'Could not send that. Check your internet.'; render(); });
  }

  // ---------- pieces ----------
  function cardHead(a, what) {
    const head = el('div', 'card-head');
    const m = mascot(44);
    m.dataset.color = Number.isInteger(a.color) ? a.color : '';
    Faces.setMood(m, Faces.cardMood(a));
    const t = el('div');
    const who = el('div', 'pk-who', a.name || 'Claude Code');
    if (a.risk && a.risk.tag) who.append(el('span', 'tag', a.risk.tag));
    if (a.script) who.append(el('span', 'tag', 'script'));
    t.append(who, el('div', 'what', what));
    head.append(m, t);
    return head;
  }
  const btn = (text, cls, fn, small) => {
    const b = el('button', `pk-btn ${(cls || '').split(' ').filter(Boolean).map((c) => `pk-${c}`).join(' ')}`, text);
    if (small) b.append(el('small', '', small));
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };

  function askCard(a) {
    const u = uiOf(a.id);
    const card = el('article', 'pk-card');
    if (!S.drawn.has(a.id)) { S.drawn.add(a.id); card.classList.add('pk-new'); }
    card.dataset.kind = a.kind;
    card.dataset.mood = Faces.cardMood(a);
    const risky = !!(a.risk && a.risk.force) || !!(a.risk && a.risk.tag);
    if (a.kind === 'permission') {
      card.append(cardHead(a, a.title || 'wants to run a command'));
      card.append(el('div', 'pk-cmd', a.detail || ''));
      if (u.sent) card.append(el('div', 'sending', 'Sending your answer…'));
      else if (u.confirm) {
        card.append(el('div', 'q', 'This one is risky. Really allow it?'));
        const row = el('div', 'btns row');
        row.append(btn('Yes, allow', 'good', () => answer(a.id, { type: 'allow' })), btn('No', 'bad', () => answer(a.id, { type: 'deny' })));
        card.append(row);
      } else {
        const row = el('div', 'btns');
        row.append(btn('Allow', 'primary', () => { if (risky) { u.confirm = true; render(); } else answer(a.id, { type: 'allow' }); }));
        row.append(btn('Deny', 'bad', () => answer(a.id, { type: 'deny' })));
        if (a.canAlways && !risky) row.append(btn('Always allow', '', () => answer(a.id, { type: 'always' })));
        card.append(row);
      }
    } else if (a.kind === 'plan') {
      card.append(cardHead(a, 'has a plan'));
      if (a.title) card.append(el('div', 'q', a.title));
      const ol = el('ol', 'pk-steps');
      for (const s of a.steps || []) ol.append(el('li', '', s));
      card.append(ol);
      if (a.more) card.append(el('div', 'what', `+${a.more} more steps. Read the whole plan on your PC.`));
      if (u.sent) card.append(el('div', 'sending', 'Sending your answer…'));
      else {
        const row = el('div', 'btns');
        row.append(btn('Approve', 'primary', () => answer(a.id, { type: 'approve' })), btn('Approve + auto-edit', '', () => answer(a.id, { type: 'approve-auto' })),
          btn('Keep planning', 'bad', () => answer(a.id, { type: 'keep' })));
        card.append(row);
      }
    } else if (a.kind === 'question') {
      const q = (a.questions || [])[u.qi];
      card.append(cardHead(a, (a.questions || []).length > 1 ? `asks (${u.qi + 1}/${a.questions.length})` : 'is asking you'));
      if (!q) return card;
      const qt = el('div', 'q', q.question);
      if (q.multiSelect) qt.append(el('small', '', 'Pick any, then Done'));
      card.append(qt);
      if (u.sent) card.append(el('div', 'sending', 'Sending your answer…'));
      else {
        const col = el('div', 'btns');
        (q.options || []).forEach((o, i) => {
          const b = btn(o.label, 'opt', () => {
            if (q.multiSelect) {
              if (u.picked.has(i)) u.picked.delete(i);
              else u.picked.add(i);
              render();
            } else next(o.label);
          }, o.description || '');
          if (q.multiSelect) b.setAttribute('aria-pressed', u.picked.has(i) ? 'true' : 'false');
          col.append(b);
        });
        if (q.multiSelect) {
          const done = btn('Done', 'primary', () => { if (u.picked.size) next([...u.picked].sort((x, y) => x - y).map((i) => q.options[i].label).join(', ')); });
          done.disabled = !u.picked.size;
          col.append(done);
        }
        card.append(col);
      }
      function next(text) {
        u.answers[q.question] = text;
        if (u.qi + 1 < a.questions.length) {
          u.qi += 1;
          u.picked = new Set();
          render();
        } else answer(a.id, { type: 'answers', answers: u.answers });
      }
    } else {
      card.append(cardHead(a, `${a.server || 'A tool'} needs you`));
      card.append(el('div', 'what', `${a.message || 'It has a form or a link for you.'} Answer it on your PC.`));
    }
    return card;
  }

  function listOf(items) {
    const ul = el('ul');
    for (const t of items) ul.append(el('li', '', t));
    return ul;
  }
  function doneCard(c) {
    const s = c.summary;
    const card = el('article', 'pk-card');
    if (!S.drawn.has(c.id)) { S.drawn.add(c.id); card.classList.add('pk-new'); }
    card.dataset.kind = 'done';
    card.dataset.mood = Faces.cardMood(c);
    card.dataset.stopped = s && s.stopped ? 'yes' : 'no';
    const what = s ? (s.stopped ? `stopped · ${[s.stopped.why, s.stopped.when].filter(Boolean).join(' · ')}` : `is done${s.mins ? ` · ${s.mins} min` : ''}`) : c.title || c.words || '';
    card.append(cardHead(c, what));
    if (s) {
      const sum = el('div', 'sum');
      const asked = el('div', 'box');
      asked.append(el('h4', '', 'You asked'), el('div', '', s.asked || ''));
      sum.append(asked);
      const did = el('div', 'box');
      did.append(el('h4', '', s.stopped ? 'It got done' : 'It did'));
      if (s.pending) did.append(el('div', 'what', 'Writing it up…'));
      else did.append(listOf(s.did && s.did.length ? s.did : [c.words || '…']));
      sum.append(did);
      if (s.stopped) {
        const left = el('div', 'box result');
        left.dataset.tone = 'bad';
        left.append(el('h4', '', 'Not done yet'), listOf(s.left && s.left.length ? s.left : ['Ask Claude to carry on.']));
        sum.append(left);
      } else if (s.result && s.result.length) {
        const r = el('div', 'box result');
        r.dataset.tone = s.result.some((x) => x.tone === 'bad') ? 'bad' : 'ok';
        r.append(el('h4', '', 'Result'), listOf(s.result.map((x) => x.text)));
        sum.append(r);
      }
      card.append(sum);
    } else if (c.words) card.append(el('div', 'what', c.words));
    card.append(btn('Got it', 'dismiss', () => { S.cards = S.cards.filter((x) => x.id !== c.id); render(); }));
    return card;
  }

  // ---------- the whole page ----------
  function heroMood() {
    if (S.conn !== 'open' && !S.seenAt) return 'sleepy';
    if (S.dozing) return 'sleepy';
    if (S.asks.size) return Faces.cardMood([...S.asks.values()][0]);
    if (quietNow()) return 'sleepy';
    if (S.cards[0]) return Faces.cardMood(S.cards[0]);
    const m = S.sessions.main;
    if (m) return Faces.sessionMood({ status: m.status, last: m.last, done: m.done }, {});
    return 'calm';
  }
  function headline() {
    const n = S.asks.size;
    if (n) return [`${n === 1 ? 'Something needs' : `${n} things need`} you`, [...S.asks.values()].map((a) => a.name).filter(Boolean).slice(0, 3).join(', ')];
    if (quietNow()) return ['Quiet for now', `back at ${new Date(S.quietUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`];
    const m = S.sessions.main;
    if (!S.seenAt) return [S.conn === 'open' ? 'Looking for your PC…' : 'Connecting…', 'Is Coucou running on your PC?'];
    if (!m) return ['All quiet', 'No Claude Code sessions right now'];
    if (m.status === 'busy') return [`${m.name} is working`, m.action ? `${m.action.verb} ${m.action.target}` : m.words || ''];
    if (m.status === 'waiting') return [`${m.name} is waiting for you`, ''];
    return [`${m.name} is resting`, m.words || ''];
  }

  let heroMascot = null;
  function render() {
    if (!S.cfg) return;
    // top
    const mood = heroMood();
    if (!heroMascot) {
      heroMascot = $('hero');
      Faces.dressMascot(heroMascot);
      sparkle(heroMascot.parentElement, 10, 7);
      Alive.env.quiet = quietNow;
      Alive.touchy(heroMascot);
      Alive.idle(heroMascot, { busy: () => S.asks.size > 0 || (S.sessions.main && S.sessions.main.status === 'busy'), onDoze: () => { S.dozing = true; render(); }, onWake: () => { S.dozing = false; render(); } });
      setTimeout(() => Alive.act(heroMascot, 'hello'), 700);
    }
    Alive.face(heroMascot, mood);
    const [h, sub] = headline();
    $('headline').textContent = h;
    $('subline').textContent = sub;
    $('quiet').setAttribute('aria-pressed', quietNow() ? 'true' : 'false');
    const ban = $('banner');
    ban.hidden = !S.banner;
    ban.textContent = S.banner;
    // asks, then cards
    const asks = $('asks');
    asks.replaceChildren(...[...S.asks.values()].map(askCard));
    $('cards').replaceChildren(...S.cards.map(doneCard));
    // the main session
    const now = $('now');
    const m = S.sessions.main;
    now.hidden = !m;
    if (m) {
      now.replaceChildren();
      now.append(el('h3', '', 'Right now'));
      const nm = el('div', 'now-name');
      const dot = el('span', 'pk-dot');
      dot.dataset.s = m.status;
      nm.append(dot, document.createTextNode(m.name));
      now.append(nm);
      if (m.prompt && m.status === 'busy' && !m.action) now.append(el('div', 'now-line', `You: ${m.prompt}`));
      if (m.action) {
        const line = el('div', 'now-line');
        line.append(document.createTextNode(`${m.action.verb} `), el('code', '', m.action.target));
        now.append(line);
      }
      if (m.words && (m.status !== 'busy' || !m.action)) now.append(el('div', 'now-line', m.words));
      if (m.checklist && m.checklist.length) {
        const ul = el('ul', 'check');
        for (const x of m.checklist) {
          const li = el('li', '', x.subject);
          li.dataset.s = x.status;
          ul.append(li);
        }
        now.append(ul);
      }
    }
    const others = $('others');
    others.hidden = !(S.sessions.chips && S.sessions.chips.length);
    if (!others.hidden) {
      others.replaceChildren(el('h3', '', 'Other sessions'));
      const row = el('div', 'pk-chips');
      for (const c of S.sessions.chips) {
        const chip = el('div', 'pk-chip');
        chip.dataset.s = c.status;
        chip.dataset.color = Number.isInteger(c.color) ? c.color : '';
        const mm = mascot(22);
        Faces.setMood(mm, Faces.sessionMood({ status: c.status, done: c.done }, {}));
        chip.append(mm, document.createTextNode(c.name));
        row.append(chip);
      }
      others.append(row);
    }
    const conn = $('conn');
    const here = S.seenAt && Date.now() - S.seenAt < 150000;
    conn.dataset.on = here ? 'yes' : 'no';
    conn.textContent = here ? 'PC connected' : S.seenAt ? 'PC not heard from lately' : S.conn === 'open' ? 'Waiting for your PC' : 'Connecting…';
  }

  // ---------- starting up ----------
  function start(cfg) {
    S.cfg = cfg;
    $('pair').hidden = true;
    $('live').hidden = false;
    if (S.client) S.client.stop();
    S.client = Client.connect(cfg, {
      onItem,
      onState: (s) => {
        if (s === 'open' || s === 'down') S.conn = s;
        if (s === 'pc-here') S.seenAt = Date.now();
        render();
      },
      helloEveryMs: 60000,
    });
    S.client.start();
    render();
  }
  function showPair() {
    $('live').hidden = true;
    $('pair').hidden = false;
    const m = $('pair-mascot');
    Faces.dressMascot(m);
    Faces.setMood(m, 'happy');
    sparkle(m.parentElement, 10, 3);
    Alive.touchy(m);
    $('pair-code').focus();
    $('a2hs').hidden = window.navigator.standalone !== false; // (iOS Safari, not yet on the Home Screen)
  }

  $('pair-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const note = $('pair-note');
    note.dataset.tone = '';
    note.textContent = 'Connecting…';
    const r = await Client.pair($('pair-code').value);
    if (!r.cfg) {
      note.dataset.tone = 'bad';
      note.textContent = r.error;
      return;
    }
    store.save(r.cfg);
    start(r.cfg);
  });
  $('quiet').addEventListener('click', () => {
    const on = !quietNow();
    S.quietUntil = on ? Date.now() + 3600000 : 0;
    S.client.quiet(on).catch(() => {});
    render();
  });
  // the address to paste into the Widget Web app: this page in widget mode, with the link settings in the #hash
  $('wlink').addEventListener('click', async () => {
    const url = Link.makeLink(`${location.origin}${location.pathname}?w=1`, S.cfg);
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {}
    S.banner = ok ? 'Widget link copied. Paste it into the Widget Web app.' : 'Could not copy. Try again.';
    render();
    setTimeout(() => { S.banner = ''; render(); }, 6000);
  });
  $('unpair').addEventListener('click', () => {
    if (!confirm('Unpair this phone from Coucou?')) return;
    if (S.client) S.client.stop();
    store.clear();
    S.cfg = null;
    showPair();
  });
  // coming back to the page (iOS freezes it in the background): reconnect and ask the PC for everything again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.cfg) {
      S.client.stop();
      S.client = Client.connect(S.cfg, { onItem, onState: (s) => { if (s === 'open' || s === 'down') S.conn = s; if (s === 'pc-here') S.seenAt = Date.now(); render(); }, helloEveryMs: 60000 });
      S.client.start();
    }
  });
  setInterval(() => { if (S.cfg) render(); }, 15000); // (the "PC connected" light and the quiet time)
  window.CoucouMascot.startBlinking(document.body);

  // ---------- the widget view (?w=1): read the relay once and show his face + one line ----------
  async function runWidget(cfg) {
    S.widget = true;
    S.cfg = cfg;
    document.body.classList.add('pk-widget');
    $('widget').hidden = false;
    const m = $('w-mascot');
    Faces.dressMascot(m);
    let lastAt = 0;
    try {
      const relay = window.PocketRelay.createRelay({ server: cfg.server });
      const joiner = Link.joiner();
      const batches = [];
      for (const t of await relay.pull(cfg.down, '30m')) {
        const whole = joiner.add(t);
        const msg = whole ? await Link.open(cfg.key, whole) : null;
        if (msg && msg.t === 'batch' && Array.isArray(msg.items)) batches.push(msg);
      }
      batches.sort((a, b) => a.at - b.at); // (by time: the counter starts again whenever the PC restarts)
      for (const b of batches) {
        lastAt = b.at;
        for (const it of b.items) if (it && typeof it.c === 'string') onItem(it.c, it.d);
      }
    } catch {}
    S.seenAt = lastAt; // (so the headline and the face know the PC spoke)
    const ago = lastAt ? Math.max(0, Math.round((Date.now() - lastAt) / 60000)) : -1;
    Faces.setMood(m, ago < 0 || ago > 30 ? 'sleepy' : heroMood());
    const [h, sub] = ago < 0 ? ['All quiet', 'Nothing from your PC lately'] : headline();
    $('w-head').textContent = h;
    $('w-sub').textContent = [sub, ago > 1 ? `${ago >= 60 ? `${Math.floor(ago / 60)} h` : `${ago} min`} ago` : ''].filter(Boolean).join(' · ');
  }

  const saved = store.load();
  // a pairing link opened directly (#...) also works: it carries the settings
  const fromLink = !saved && !WIDGET && location.hash.length > 20 ? Link.parseLink(location.hash) : null;
  if (fromLink) {
    store.save(fromLink);
    history.replaceState(null, '', location.pathname);
  }
  const cfg = saved || fromLink;
  if (WIDGET) {
    // (the Widget Web app has its own storage: the widget's address carries the settings in its #hash)
    const w = Link.parseLink(location.hash) || saved;
    if (w) runWidget(w);
    else { document.body.classList.add('pk-widget'); $('widget').hidden = false; $('w-head').textContent = 'Open Coucou first'; $('w-sub').textContent = 'and copy the widget link'; }
  } else if (cfg) start(cfg);
  else showPair();
  window.__pocket = { S, onItem, render }; // (for tests)
})();
