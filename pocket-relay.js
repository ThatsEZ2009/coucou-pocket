// Coucou Pocket's relay: two topics on an ntfy server (https://docs.ntfy.sh) carry the scrambled messages between your PC and
// the phone page, so nothing on your PC has to be reachable from the internet. Shared by both ends (Node and the browser):
// fetch only. publish = a plain POST of the text to the topic; subscribe = the topic's /json stream, again and again, from
// where it stopped. ntfy.sh lets a visitor send 60 messages at once and then one every 5 seconds, so every send waits for a
// token (a little under that), and a "too many" answer waits and tries again.
(function (root) {
  const DEFAULT_SERVER = 'https://ntfy.sh';

  // a token bucket: `burst` at the start, one more every `everyMs`
  function bucket({ burst = 30, everyMs = 6000, now = () => Date.now() } = {}) {
    let tokens = burst;
    let at = now();
    return {
      // ms to wait before one can be taken (0 = take it now)
      take() {
        const t = now();
        tokens = Math.min(burst, tokens + (t - at) / everyMs);
        at = t;
        if (tokens >= 1) {
          tokens -= 1;
          return 0;
        }
        const wait = Math.ceil((1 - tokens) * everyMs);
        tokens = 0; // (the caller waits, then it is spent)
        at = t + wait;
        return wait;
      },
    };
  }

  const parseLines = (buffer) => {
    const parts = String(buffer).split('\n');
    const rest = parts.pop();
    const events = [];
    for (const p of parts) {
      if (!p.trim()) continue;
      try {
        events.push(JSON.parse(p));
      } catch {}
    }
    return { events, rest };
  };

  function createRelay({ server = DEFAULT_SERVER, fetchFn = (...a) => root.fetch(...a), tokens = bucket(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
    const base = () => String(typeof server === 'function' ? server() : server).replace(/\/+$/, '');
    let queue = Promise.resolve();

    // Sends one text (≤ 4096 bytes) to a topic. In order, one at a time. Resolves with the relay's message id.
    function publish(topic, text) {
      const job = queue.then(async () => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const wait = tokens.take();
          if (wait) await sleep(wait);
          const res = await fetchFn(`${base()}/${topic}`, { method: 'POST', body: text, signal: AbortSignal.timeout(15000) });
          if (res.status === 429) {
            await sleep(10000 * (attempt + 1));
            continue;
          }
          if (!res.ok) throw new Error(`relay ${res.status}`);
          try {
            return (await res.json()).id || '';
          } catch {
            return '';
          }
        }
        throw new Error('relay says too many messages');
      });
      queue = job.catch(() => {});
      return job;
    }

    // Listens to a topic until stop(): onText(text, id) for each message, from "now" on (or from `since`).
    // onState('open' | 'down') says whether the stream is up.
    function subscribe(topic, onText, { since = String(Math.floor(Date.now() / 1000)), onState = () => {} } = {}) {
      let running = true;
      let aborter = null;
      let last = since;
      (async () => {
        let failed = 0;
        while (running) {
          aborter = new AbortController();
          try {
            const res = await fetchFn(`${base()}/${topic}/json?since=${last}`, { signal: aborter.signal });
            if (!res.ok) throw new Error(`relay ${res.status}`);
            failed = 0;
            onState('open');
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let pending = '';
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              const { events, rest } = parseLines(pending + decoder.decode(value, { stream: true }));
              pending = rest;
              for (const e of events) {
                if (e.event !== 'message' || typeof e.message !== 'string') continue; // (open and keepalive have ids that are not messages)
                if (e.id) last = e.id;
                try {
                  await onText(e.message, e.id);
                } catch {}
              }
            }
            onState('down');
            if (running) await sleep(1000);
          } catch {
            if (!running) break;
            onState('down');
            failed++;
            await sleep(Math.min(30000, 1500 * failed));
          }
        }
      })();
      return () => {
        running = false;
        if (aborter) aborter.abort();
      };
    }

    // Everything the relay still holds for a topic (ntfy.sh keeps messages about 12 hours), oldest first: for pairing.
    async function pull(topic) {
      const res = await fetchFn(`${base()}/${topic}/json?poll=1&since=all`);
      if (!res.ok) throw new Error(`relay ${res.status}`);
      return parseLines(await res.text()).events.filter((e) => e.event === 'message' && typeof e.message === 'string').map((e) => e.message);
    }

    return { publish, subscribe, pull };
  }

  const api = { createRelay, bucket, parseLines, DEFAULT_SERVER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketRelay = api;
})(typeof self !== 'undefined' ? self : globalThis);
