// Paletas = os temas de cor dos baús (app/globals.css). Peças e vídeos usam só variáveis CSS;
// o tema vem de ?tema=<nome> na URL ou de window.applyTheme(nome, elemento).
(function () {
  const P = {
    rosa: { cream: "#fdf3f4", paper: "#fffafa", rose: "#f6d3da", deep: "#d97a92", soft: "#fbe8ec", line: "#f1dfe3", ink: "#4a3b40", taupe: "#8a7178" },
    azul: { cream: "#f1f6fb", paper: "#fafcff", rose: "#c9ddf0", deep: "#4f86b8", soft: "#e3eef8", line: "#dce7f1", ink: "#33404c", taupe: "#6f7d8a" },
    salvia: { cream: "#f4f6f0", paper: "#fbfcf8", rose: "#cfdac6", deep: "#6f8a63", soft: "#e8eee2", line: "#e1e7da", ink: "#3a4136", taupe: "#747c6d" },
    marronzinho: { cream: "#f8f2ec", paper: "#fdf9f5", rose: "#e6cdb6", deep: "#a8683f", soft: "#f3e6da", line: "#ecdfd3", ink: "#45362c", taupe: "#85705f" },
    lavanda: { cream: "#f6f3fb", paper: "#fcfaff", rose: "#dccff0", deep: "#8a6cc1", soft: "#eee7f8", line: "#e7e0f2", ink: "#3f3850", taupe: "#7c7290" },
    vermelho: { cream: "#fcf3f2", paper: "#fffafa", rose: "#f2c4c2", deep: "#c1403f", soft: "#fae4e3", line: "#f1dedd", ink: "#4a3332", taupe: "#8a6c6b" },
    amarelo: { cream: "#fcf8ec", paper: "#fffdf6", rose: "#f2e0a6", deep: "#b8892a", soft: "#f8efcf", line: "#efe6cc", ink: "#4a4130", taupe: "#85795f" },
    noite: { cream: "#1f2738", paper: "#283146", rose: "#4a5570", deep: "#d8b46a", soft: "#323c55", line: "#3a4560", ink: "#f2ede3", taupe: "#b9b2a5" },
  };
  window.PALETTES = P;
  window.applyTheme = function (name, el = document.documentElement) {
    const p = P[name] || P.rosa;
    const set = (k, v) => el.style.setProperty(k, v);
    set("--cream", p.cream); set("--paper", p.paper); set("--rose", p.rose); set("--soft", p.soft); set("--rose-soft", p.soft);
    set("--deep", p.deep); set("--rose-deep", p.deep); set("--line", p.line); set("--ink", p.ink); set("--taupe", p.taupe);
    el.dataset.tema = name;
  };
  window.applyTheme(new URLSearchParams(location.search).get("tema") || "rosa");
})();
