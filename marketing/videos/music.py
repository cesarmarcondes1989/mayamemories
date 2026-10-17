"""Trilha original de caixinha de música (sintetizada, sem direitos de terceiros).
Uso: python3 music.py saida.wav duracao_em_segundos [variacao]"""
import sys, wave
import numpy as np

SR = 44100
out, dur = sys.argv[1], float(sys.argv[2])
variant = int(sys.argv[3]) if len(sys.argv) > 3 else 0
n = int(SR * dur)
t = np.arange(n) / SR
mix = np.zeros(n)

def hz(m):  # midi -> Hz
    return 440 * 2 ** ((m - 69) / 12)

def music_box(start, midi, vel=0.32, decay=2.6):
    i0 = int(start * SR)
    if i0 >= n: return
    L = min(n - i0, int(SR * 3.5))
    tt = np.arange(L) / SR
    f = hz(midi)
    env = np.exp(-decay * tt) * np.minimum(1, tt / 0.004)
    tone = np.sin(2*np.pi*f*tt) + 0.35*np.sin(2*np.pi*2*f*tt)*np.exp(-4*tt) + 0.12*np.sin(2*np.pi*3.01*f*tt)*np.exp(-7*tt)
    mix[i0:i0+L] += vel * env * tone

def pad(start, length, midis, vel=0.05):
    i0 = int(start * SR); L = min(n - i0, int(SR * length))
    if L <= 0: return
    tt = np.arange(L) / SR
    env = np.minimum(1, tt / 0.8) * np.minimum(1, (length - tt) / 0.8)
    s = sum(np.sin(2*np.pi*hz(m)*tt + 0.3*np.sin(2*np.pi*0.2*tt)) for m in midis)
    mix[i0:i0+L] += vel * env * s

beat = 60 / 72
bar = 4 * beat
chords = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]]  # C, Am, F, G
# melodias originais (graus em midi), uma nota por meio tempo, None = pausa
melodies = [
    [76, None, 79, 77, 76, None, 74, 72],
    [72, None, 76, 74, 72, None, 69, 67],
    [69, 72, 77, 76, 74, None, 72, None],
    [71, None, 74, 72, 71, 67, 74, None],
] if variant == 0 else [
    [72, 76, 79, None, 77, 76, None, 74],
    [69, 72, 76, None, 74, 72, None, 69],
    [65, 69, 72, None, 76, 74, 72, None],
    [67, 71, 74, None, 79, 77, 74, None],
]
bars = int(dur // bar) + 1
for b in range(bars):
    start = b * bar
    ch = chords[b % 4]
    pad(start, bar + 0.4, ch)
    music_box(start, ch[0] + 12, 0.18, 1.6)
    if b == 0 or start > dur - bar * 1.5:
        continue  # começa só com acorde; termina limpo
    for k, m in enumerate(melodies[b % 4]):
        if m is not None:
            music_box(start + k * beat / 2, m, 0.26 if b % 8 < 4 else 0.3)
# acorde final
fin = max(0, dur - bar * 1.4)
for k, m in enumerate([60, 64, 67, 72, 76]):
    music_box(fin + k * 0.18, m, 0.22, 1.2)

# reverb simples (ecos)
wet = np.zeros_like(mix)
for d, g in [(0.11, .35), (0.19, .28), (0.31, .2), (0.47, .14), (0.71, .09)]:
    k = int(d * SR); wet[k:] += g * mix[:-k]
mix = mix + wet
fade = np.minimum(1, t / 1.5) * np.minimum(1, (dur - t) / 2.5)
mix *= fade
mix /= np.max(np.abs(mix)) * 1.25
stereo = np.stack([mix, np.roll(mix, int(0.012 * SR))], axis=1)
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((stereo * 32767).astype(np.int16).tobytes())
