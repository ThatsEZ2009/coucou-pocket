// The mascot's random blinking. Every mascot on the page blinks together (it's the same character).
// Works as a plain <script> in the page and as a CommonJS module in tests.
(function (root) {
  const BLINK_MS = 130;

  // Waits 2.5–6s between blinks; about 1 in 5 blinks is a quick double blink.
  function nextBlink(random = Math.random) {
    return { wait: Math.round(2500 + random() * 3500), double: random() < 0.2 };
  }

  function startBlinking(target) {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const blinkOnce = async () => {
      target.classList.add('blinking');
      await sleep(BLINK_MS);
      target.classList.remove('blinking');
    };
    (async function loop() {
      for (;;) {
        const { wait, double } = nextBlink();
        await sleep(wait);
        await blinkOnce();
        if (double) {
          await sleep(140);
          await blinkOnce();
        }
      }
    })();
  }

  const api = { nextBlink, startBlinking };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoucouMascot = api;
})(this);
