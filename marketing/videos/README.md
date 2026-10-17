# Vídeos de campanha — Guardei pra você

Todos em **1080×1920 (9:16)**, prontos para Reels, TikTok, Shorts e Stories. Trilha de caixinha de música
**original**, sintetizada por `music.py` (sem direitos de terceiros). No Instagram dá para trocar por um áudio
em alta.

| Arquivo | Duração | Para quê |
|---|---|---|
| `out/guardei-video1-motion-52s.mp4` | 52 s | Manifesto + produto: a dor, a marca, o site em 3 passos, "18 anos depois", CTA |
| `out/guardei-video2-familia-50s.mp4` | 50 s | A família guardando (mãe, vó, tio, dinda) → baú → filme e livro → "aos 18, ela abre tudo" |
| `out/guardei-teaser-15s.mp4` | 15 s | Corte para anúncio pago: gancho + marca + CTA |
| `out/guardei-reel-quando-crescer-22s.mp4` | 22 s | Reel manifesto "Quando você crescer" (`reel-quando-crescer.html`) |
| `out/guardei-reel-filme-49s.mp4` | 49 s | O filme em motion do produto, no formato stories, com a demo da Alice |

Os posts prontos (calendário, legendas, carrosséis e stories) ficam em `../instagram/`.

## Como editar e gerar de novo

Cada vídeo é uma página HTML com a identidade do site (Amatic SC, Nunito, Caveat, rosa `#d97a92`). Textos,
tempos e cores ficam no próprio arquivo.

```bash
cd marketing/videos
# prévia de alguns quadros (PNG)
node render.mjs video1-motion.html out/v1.mp4 30 --preview 4,15,40
# vídeo completo (sem som) + trilha
node render.mjs video1-motion.html /tmp/v1.mp4 30
python3 music.py /tmp/m1.wav 52
ffmpeg -i /tmp/v1.mp4 -i /tmp/m1.wav -c:v copy -c:a aac -shortest out/guardei-video1-motion-52s.mp4
```

Precisa de Node + Playwright (Chromium) e ffmpeg.

## Legendas sugeridas

**Vídeo 1 — manifesto**
> Sua mãe tem 40 mil fotos no celular. Quantas o seu filho vai ver um dia? 🤍
> O Guardei pra você é o baú da família: fotos, vozes e cartas que a criança abre quando crescer.
> Crie grátis em guardeipravoce.com.br
> #maternidade #gravidez #chadebebe #memorias #primeirofilho #avó

**Vídeo 2 — a família**
> A mamãe fotografa. A vó grava. O tio filma. A dinda escreve.
> E aos 18, ela abre tudo. 🧸
> Marca aqui quem guardaria uma carta pra sua criança 👇

---

## Roteiro para filmar com família de verdade (versão live action do Vídeo 2)

A versão animada serve para lançar já. A versão filmada é a que mais emociona, e dá para fazer com um
celular, numa tarde.

**Formato:** vertical 9:16, luz natural de janela, sem tripé obrigatório. Duração final: 35–45 s. Sem
locução; só música e textos na tela. Funciona no mudo.

**Elenco:** mãe (ou casal), bebê, avó (de preferência real, não atriz), um tio ou padrinho, uma madrinha.
Termo de uso de imagem assinado por todos (o do bebê, pelos pais).

| # | Plano (2–4 s cada) | Texto na tela |
|---|---|---|
| 1 | Close: mão do bebê segurando o dedo de um adulto | Quem guarda a história de uma criança? |
| 2 | Mãe fotografa o bebê no banho; corta para a tela do celular com "Guardado ❤️" | A mamãe fotografa |
| 3 | Avó, na cozinha dela, grava um áudio cantando baixinho, celular perto da boca | A vó grava |
| 4 | Detalhe: a avó encosta o celular no **ursinho** e sorri | Encostou, entrou. Sem senha. |
| 5 | Tio filma o bebê no bolo de 1 ano (vela acesa, todos cantando) | O tio filma |
| 6 | Madrinha escrevendo à mão uma carta; depois digita no celular; aparece o cadeado "abre aos 18" | A dinda escreve uma carta para os 18 |
| 7 | Gravação de tela do site: a linha do tempo rolando com as memórias da família | Tudo num baú só. Só a família vê. |
| 8 | A família no sofá vendo o "filme do ano" na TV; a avó enxugando os olhos | Todo ano vira filme… |
| 9 | Mãe folheando o livro impresso; para numa foto e sorri | …e livro de verdade |
| 10 | (Opcional, com ator jovem) Rapaz/moça de 18 anos ouvindo o áudio da avó com fone, olhos marejados | Aos 18, ela abre tudo. |
| 11 | Cartão final da marca (use os últimos 5 s do vídeo animado) | guardei pra você · guardeipravoce.com.br |

**Dicas de gravação**
- Grave cada plano 3 vezes e use o mais natural. Peça para a família **não olhar para a câmera**.
- Áudio real da avó cantando é ouro: grave separado, perto, num cômodo silencioso.
- Telas do produto: grave do próprio site com o celular (gravação de tela nativa) usando um baú de
  demonstração. Nunca use fotos reais de crianças sem autorização escrita.
- Edição: CapCut ou Instagram Edits. Textos em fonte manuscrita (Amatic SC ou Caveat), cor `#d97a92`.

**Variações para anúncio (teste A/B, 15 s cada)**
1. Gancho da avó: plano 3 + 4 + cartão final.
2. Gancho da mãe: "Sua mãe tem 40 mil fotos. Seu filho não vai ver nenhuma." + plano 7 + cartão final.
3. Gancho do pai: pai às 3h da manhã gravando um áudio com a bebê no colo + "Selado até os 18." + cartão.
