// Coucou Pocket: the link between your PC and the phone page. Shared by both ends (Node in Coucou, the browser in the page).
// Everything that crosses the internet is sealed here first: AES-256-GCM with a key that lives only on your PC and in your
// phone (it travels in the pairing link's #hash, which a web server never receives). The relay (ntfy.sh) only ever carries
// scrambled text on two long random topic names. A message too long for one relay message is cut into parts.
(function (root) {
  const webcrypto = root.crypto || require('crypto').webcrypto;
  const subtle = webcrypto.subtle;
  const rnd = (n) => webcrypto.getRandomValues(new Uint8Array(n));

  // base64url without padding (works in Node and the browser)
  const b64u = (bytes) => {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const unb64u = (s) => {
    const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  };
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const validTopic = (t) => typeof t === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(t);
  const newTopic = () => `cp-${b64u(rnd(18))}`; // 3 + 24 characters, 144 random bits
  const newKey = () => b64u(rnd(32));
  const validKey = (k) => typeof k === 'string' && /^[A-Za-z0-9_-]{43}$/.test(k);

  // The pairing link: https://<where the page lives>/#<base64url of { v, s: relay server, d: topic PC→phone, u: topic phone→PC, k: key }>
  function makeLink(page, { server, down, up, key }) {
    return `${String(page).replace(/#.*$/, '')}#${b64u(enc.encode(JSON.stringify({ v: 1, s: server, d: down, u: up, k: key })))}`;
  }
  function parseLink(text) {
    try {
      const all = String(text);
      const hash = all.includes('#') ? all.slice(all.indexOf('#') + 1) : all;
      const o = JSON.parse(dec.decode(unb64u(hash)));
      if (o && o.v === 1 && typeof o.s === 'string' && validTopic(o.d) && validTopic(o.u) && validKey(o.k) && o.d !== o.u) {
        return { server: o.s, down: o.d, up: o.u, key: o.k };
      }
    } catch {}
    return null;
  }

  const keyOf = (k) => subtle.importKey('raw', unb64u(k), 'AES-GCM', false, ['encrypt', 'decrypt']);

  // object → one scrambled string (12 random bytes + the sealed JSON, base64url)
  async function seal(key, obj) {
    const iv = rnd(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, await keyOf(key), enc.encode(JSON.stringify(obj))));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return b64u(out);
  }
  // scrambled string → the object, or null when it isn't ours / was changed on the way
  async function open(key, text) {
    try {
      const all = unb64u(text);
      if (all.length < 29) return null;
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, await keyOf(key), all.slice(12));
      return JSON.parse(dec.decode(pt));
    } catch {
      return null;
    }
  }

  // A sealed string → relay messages of at most `size` characters: {"m": id, "i": part, "n": parts, "c": piece}
  function split(sealed, size = 3000, id = b64u(rnd(6))) {
    const n = Math.max(1, Math.ceil(sealed.length / size));
    return Array.from({ length: n }, (_, i) => JSON.stringify({ m: id, i, n, c: sealed.slice(i * size, (i + 1) * size) }));
  }
  // Puts the parts back together, in any order; half-finished messages are forgotten after `ttl` ms.
  function joiner(ttl = 120000, now = () => Date.now()) {
    const partial = new Map();
    return {
      add(text) {
        let p;
        try {
          p = JSON.parse(text);
        } catch {
          return null;
        }
        if (!p || typeof p.m !== 'string' || !Number.isInteger(p.i) || !Number.isInteger(p.n) || p.n < 1 || p.n > 40 || p.i < 0 || p.i >= p.n || typeof p.c !== 'string') return null;
        for (const [k, v] of partial) if (now() - v.at > ttl) partial.delete(k);
        if (p.n === 1) return p.c;
        const e = partial.get(p.m) || { at: now(), n: p.n, parts: new Map() };
        e.parts.set(p.i, p.c);
        partial.set(p.m, e);
        if (e.parts.size < e.n) return null;
        partial.delete(p.m);
        return Array.from({ length: e.n }, (_, i) => e.parts.get(i)).join('');
      },
      pending: () => partial.size,
    };
  }

  // ---- pairing: a short code typed on the phone, once ----
  // The PC makes the real settings (topics + key), seals them with a key made from a 10-character code and leaves them on a
  // pairing topic that is itself made from the code; the phone page, given the code, makes the same two things and picks them up.
  // The code is only good for a few minutes (the PC stops expecting it) and never travels: only what is derived from it does.
  const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0 O 1 I L
  const newCode = () => Array.from(rnd(10), (b) => CODE_LETTERS[b % CODE_LETTERS.length]).join('');
  const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  const showCode = (c) => `${c.slice(0, 5)}-${c.slice(5)}`;
  const validCode = (c) => /^[A-Z0-9]{10}$/.test(c) && [...c].every((x) => CODE_LETTERS.includes(x));
  async function fromCode(code) {
    const base = await subtle.importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', iterations: 150000, salt: enc.encode('coucou-pocket-pair-v1') }, base, 8 * (32 + 18)));
    return { key: b64u(bits.slice(0, 32)), topic: `pr-${b64u(bits.slice(32))}` };
  }

  const api = { newCode, cleanCode, showCode, validCode, fromCode, b64u, unb64u, validTopic, validKey, newTopic, newKey, makeLink, parseLink, seal, open, split, joiner };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PocketLink = api;
})(typeof self !== 'undefined' ? self : globalThis);
