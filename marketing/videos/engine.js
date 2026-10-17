// Motor mínimo de animação determinística: cada quadro chama render(t).
// Sem transições de CSS — o renderizador pula direto para qualquer tempo.
window.A = {
  clamp: (v, a = 0, b = 1) => Math.min(b, Math.max(a, v)),
  // progresso 0..1 entre a e b (segundos)
  p(t, a, b) {
    return this.clamp((t - a) / (b - a));
  },
  out: (x) => 1 - Math.pow(1 - x, 3),
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  back: (x) => {
    const c1 = 1.5, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
  // entra (a..a+d), fica, sai (b-d..b)
  life(t, a, b, d = 0.5) {
    if (t < a || t > b) return 0;
    return Math.min(this.out(this.p(t, a, a + d)), 1 - this.p(t, b - d, b));
  },
  $: (s) => document.querySelector(s),
  $$: (s) => [...document.querySelectorAll(s)],
  set(el, { o, x = 0, y = 0, s = 1, r = 0 } = {}) {
    if (typeof el === "string") el = document.querySelector(el);
    if (!el) return;
    if (o !== undefined) {
      el.style.opacity = o;
      el.style.visibility = o <= 0.001 ? "hidden" : "visible";
    }
    el.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${r}deg)`;
  },
  // texto que aparece letra a letra
  type(el, text, prog) {
    if (typeof el === "string") el = document.querySelector(el);
    const n = Math.round(text.length * this.clamp(prog));
    el.textContent = text.slice(0, n);
  },
};
