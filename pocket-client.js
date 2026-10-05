// Coucou Pocket, the phone page's end of the link (runs in the browser; also runs in Node so it can be tested against the PC's end).
// pair(code): the one-time pairing (the 10-character code typed from Coucou's Settings → the real settings, sealed on a pairing topic).
// connect(cfg): listens to the PC's topic, says hello (the PC answers with everything the page needs), and sends answers back.
(function (root) {
  const L = root.PocketLink || require('./pocket-link');
  const R = root.PocketRelay || require('./pocket-relay');

  // The code typed on the phone → the settings, or null (wrong code, nothing there yet, or not reachable).
  async function pair(code, { relay = R.createRelay() } = {}) {
    const clean = L.cleanCode(code);
    if (!L.validCode(clean)) return { error: 'That code has the wrong letters. It is 10 letters and numbers, like K7M2Q-9XAB4.' };
    const { key, topic } = await L.fromCode(clean);
    let texts;
    try {
      texts = await relay.pull(topic);
    } catch {
      return { error: 'Cannot reach the relay. Check your internet.' };
    }
    const joiner = L.joiner();
    for (const t of texts) {
      const whole = joiner.add(t);
      if (!whole) continue;
      const cfg = await L.open(key, whole);
      if (cfg && L.validTopic(cfg.down) && L.validTopic(cfg.up) && L.validKey(cfg.key) && typeof cfg.server === 'string') return { cfg };
    }
    return { error: 'Nothing found for that code. Check it, and make sure Coucou is showing it (it is only good for 10 minutes).' };
  }

  // cfg: { server, down, up, key }. onItem(channel, data) for everything the PC says; onState('open' | 'down' | 'pc-here' | 'pc-quiet').
  function connect(cfg, { relay = R.createRelay({ server: cfg.server }), onItem = () => {}, onState = () => {}, now = () => Date.now(), helloEveryMs = 0 } = {}) {
    const joiner = L.joiner();
    let lastSeq = 0;
    let stopSub = null;
    let helloTimer = null;
    let seenAt = 0;

    async function say(obj) {
      for (const part of L.split(await L.seal(cfg.key, obj))) await relay.publish(cfg.up, part);
    }
    async function onText(text) {
      const whole = joiner.add(text);
      if (!whole) return;
      const msg = await L.open(cfg.key, whole);
      if (!msg || msg.t !== 'batch' || !Array.isArray(msg.items)) return;
      if (msg.seq <= lastSeq && msg.seq > lastSeq - 50) return; // (an old batch that arrived late)
      lastSeq = Math.max(lastSeq, msg.seq);
      seenAt = now();
      onState('pc-here');
      for (const it of msg.items) {
        if (it && typeof it.c === 'string') onItem(it.c, it.d);
      }
    }

    return {
      start() {
        // (the relay keeps recent messages: start a little back so a card that just came is not missed; hello-ok then makes the page start clean)
        stopSub = relay.subscribe(cfg.down, onText, { since: String(Math.floor(Date.now() / 1000) - 30), onState: (s) => { onState(s); if (s === 'open') say({ t: 'hello' }).catch(() => {}); } });
        if (helloEveryMs) helloTimer = setInterval(() => say({ t: 'hello' }).catch(() => {}), helloEveryMs);
      },
      stop() {
        if (stopSub) stopSub();
        clearInterval(helloTimer);
      },
      hello: () => say({ t: 'hello' }),
      answer: (id, answer) => say({ t: 'answer', id, answer }),
      quiet: (on) => say({ t: 'quiet', on: !!on }),
      seenAt: () => seenAt,
    };
  }

  const api = { pair, connect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketClient = api;
})(typeof self !== 'undefined' ? self : globalThis);
