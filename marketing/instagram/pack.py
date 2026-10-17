"""Monta a pasta prontos/ (um diretório por dia, com arquivos e textos) e o ZIP para o celular.
Uso: python3 pack.py   (rode depois de node build.mjs e dos vídeos em ../videos/out)"""
import json, shutil, zipfile
from pathlib import Path

HERE = Path(__file__).parent
cal = json.loads((HERE / "calendario.json").read_text())
out = HERE / "prontos"
shutil.rmtree(out, ignore_errors=True)

BIO = """NOME (campo "Nome", até 30 caracteres):
Guardei pra você | Memórias

BIO:
Guardei pra você 🤍
O baú da família: fotos, vozes e cartas pra criança abrir quando crescer.
Crie o seu grátis 👇

LINK DA BIO:
{bio}

FOTO DE PERFIL: perfil-foto.png
DESTAQUES (crie ao postar o 1º story de cada tema; capa = imagem destaque-*.png):
- "como funciona": stories dos Reels e do carrossel de passos
- "demonstração": stories com o link da demo
- "planos": deixe para quando o checkout estiver no ar
- "dúvidas": respostas das caixinhas
"""

FAQ = """RESPOSTAS PRONTAS (comentários e direct)

É grátis?
Sim! No plano Grátis você cria o baú e convida até 5 pessoas da família. Os planos pagos liberam mais convidados e eventos; o Legado inclui o filme do ano e o livro impresso. 🤍

Precisa baixar aplicativo?
Não precisa de app nem de senha. A família entra pelo link, pelo QR code ou encostando o celular no ursinho.

Quem consegue ver?
Só quem você convidar. É privado, sem anúncios, e nada aparece em rede social.

E se vocês fecharem um dia?
Você pode baixar tudo a qualquer momento num arquivo ZIP: fotos, vídeos, áudios e cartas, em formatos comuns que abrem em qualquer computador.

Como funciona a carta trancada?
Você escolhe a data (por exemplo, os 18 anos) e ela só abre nesse dia.

Quanto custa?
Grátis para começar. Ninho R$ 19,90/mês, Família R$ 34,90/mês, Legado R$ 1.490 (pagamento único) e Evento R$ 390 (para chá de bebê ou casamento).

Posso ver como fica?
Pode! Tem uma demonstração aberta com a família da Alice: {demo}
"""

def copy(src: str, dest_dir: Path, name: str | None = None) -> str:
    p = (HERE / src).resolve()
    dest_dir.mkdir(parents=True, exist_ok=True)
    target = dest_dir / (name or p.name)
    shutil.copy(p, target)
    return target.name

guide = ["GUARDEI PRA VOCÊ — INSTAGRAM, SEMANAS 1 E 2", "=" * 44, "", "Antes do 1º post: arrume o perfil (pasta 0-perfil).", ""]
for d in cal["dias"]:
    folder = out / d["pasta"]
    folder.mkdir(parents=True, exist_ok=True)
    lines = [d["dia"].upper(), ""]
    guide.append(d["dia"])
    if "feed" in d:
        f = d["feed"]
        names = [copy(a, folder, f"{i + 1:02d}-{Path(a).name}" if f["tipo"].startswith("Carrossel") else None) for i, a in enumerate(f["arquivos"])]
        (folder / "legenda.txt").write_text(f["legenda"] + "\n")
        lines += [f"FEED · {f['hora']} · {f['tipo']}: {f['titulo']}", f"Arquivos: {', '.join(names)}", f"Como postar: {f['como']}", "Legenda: legenda.txt (copie e cole)", ""]
        guide.append(f"  {f['hora']} feed: {f['tipo']} \"{f['titulo']}\"")
    for k, s in enumerate(d.get("stories", [])):
        name = copy(s["arquivo"], folder, f"story-{k + 1}-{Path(s['arquivo']).name}") if s.get("arquivo") else None
        link = cal["links"].get(s.get("link", ""), "")
        lines += [f"STORY {k + 1}{' · ' + name if name else ''}", f"  {s['como']}"] + ([f"  Link: {link}"] if link else []) + [""]
        guide.append(f"  story {k + 1}: {s['como'].split('.')[0]}")
    (folder / "COMO-POSTAR.txt").write_text("\n".join(lines))
    guide.append("")

perfil = out / "0-perfil"
for f in ["pecas/perfil-foto.png", "pecas/destaque-como-funciona.png", "pecas/destaque-demo.png", "pecas/destaque-planos.png", "pecas/destaque-duvidas.png"]:
    copy(f, perfil)
(perfil / "bio-e-perfil.txt").write_text(BIO.format(**cal["links"]))
(out / "respostas-prontas.txt").write_text(FAQ.format(demo=cal["links"]["demo_stories"]))
(out / "LEIA-PRIMEIRO.txt").write_text("\n".join(guide) + "\n")

zip_path = HERE / "guardei-instagram-semanas-1-e-2.zip"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(out))
print(zip_path, round(zip_path.stat().st_size / 1e6, 1), "MB")
