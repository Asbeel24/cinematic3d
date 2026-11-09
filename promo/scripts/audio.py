"""Synthesize the promo soundtrack (CC0, fully procedural, deterministic). 120 BPM, frame-locked at 30 fps.
usage: python3 scripts/audio.py public/promo-audio.wav"""
import sys, wave
import numpy as np

SR = 48000
FPS = 30
DUR = 555 / FPS
N = int(SR * DUR)
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))


def at(frame):
    return int(frame / FPS * SR)


def add(sig, frame, gain=1.0, pan=0.0):
    i = at(frame)
    if sig.ndim == 1:
        sig = np.stack([sig * (1 - max(pan, 0)), sig * (1 + min(pan, 0))], 1)
    j = min(N, i + len(sig))
    mix[i:j] += sig[: j - i] * gain


def env(n, a=0.002, d=0.2):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def kick(d=0.35, f0=150, f1=42):
    n = int(SR * d)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.03)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * env(n, 0.001, d / 3)


def noise(d, decay, hp=0.0):
    n = int(SR * d)
    x = rng.standard_normal(n)
    if hp:
        x = x - np.convolve(x, np.ones(int(hp)) / int(hp), "same")
    return x * env(n, 0.001, decay)


def boom(d=1.6):
    n = int(SR * d)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * (38 + 60 * np.exp(-t / 0.08)) * t) * np.exp(-t / 0.5)
    crack = noise(d, 0.05, 4)
    return np.tanh(1.6 * (sub + 0.5 * crack))


def whoosh(d=0.35, rev=False):
    n = int(SR * d)
    x = rng.standard_normal(n)
    k = 60
    lp = np.convolve(x, np.ones(k) / k, "same") * 4
    hpx = x - lp / 4
    s = np.sin(np.linspace(0, np.pi, n)) ** 2
    y = (0.6 * lp + 0.4 * hpx) * s
    return y[::-1] if rev else y


def riser(d):
    n = int(SR * d)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - np.convolve(x, np.ones(8) / 8, "same")
    tone = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (t / d) ** 2) / SR)
    return (0.5 * x + 0.3 * tone) * (t / d) ** 2


def click():
    return noise(0.03, 0.004, 3) * 0.8


def tone(freq, d, decay, harm=(1, 0.5, 0.25)):
    n = int(SR * d)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * (k + 1) * t) for k, a in enumerate(harm))
    return y * env(n, 0.003, decay)


def pop(p=1.0):
    n = int(SR * 0.12)
    t = np.arange(n) / SR
    f = (900 * p) * np.exp(-t / 0.02) + 200 * p
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.001, 0.03)


BEAT = 15  # frames

# ---- HOOK 0–90 ----
add(boom(), 0, 0.9)
add(boom(1.0), 15, 0.7)
drone_n = at(90)
t = np.arange(drone_n) / SR
drone = (np.sin(2 * np.pi * 55 * t) + 0.4 * np.sin(2 * np.pi * 82.5 * t)) * 0.25 * np.minimum(t / 0.05, 1)
add(drone, 0, 0.6)
for i in range(7):
    f = 30 + round(i * 6.43)
    add(kick(0.15, 220, 60), f, 0.55)
    add(whoosh(0.18), f - 2, 0.35, pan=(-0.6 if i % 2 else 0.6))
add(riser(1.5), 30, 0.35)
add(boom(1.4), 75, 1.0)
add(tone(110, 1.2, 0.5), 75, 0.3)

# ---- PROMPT 90–150 ----
for k in range(17):
    add(click(), 90 + 8 + 2 * k, 0.5, pan=rng.uniform(-0.3, 0.3))
add(kick(0.2, 300, 90), 136, 0.6)
add(noise(0.08, 0.02, 3), 136, 0.4)
add(riser(0.47), 136, 0.5)
add(whoosh(0.5, rev=True), 135, 0.5)

# ---- GROOVE 150–450 ----
bass_notes = [55, 55, 65.4, 49]  # A1 A1 C2 G1, one per bar
for b in range((450 - 150) // BEAT):
    f = 150 + b * BEAT
    add(kick(), f, 0.95)
    add(noise(0.05, 0.012, 2), f + BEAT / 2, 0.22, pan=0.3)  # off-beat hat
    add(noise(0.03, 0.006, 2), f + BEAT / 4, 0.1, pan=-0.3)
    if b % 2 == 1:  # clap on 2 and 4
        add(noise(0.2, 0.06, 6) + 0.3 * noise(0.2, 0.02, 3), f, 0.45)
    bar = b // 4
    n = int(SR * 0.45)
    tt = np.arange(n) / SR
    bf = bass_notes[bar % 4]
    bass = np.tanh(2.5 * np.sin(2 * np.pi * bf * tt)) * env(n, 0.005, 0.25)
    add(bass, f + BEAT / 2, 0.35)
for f in (150, 210, 255, 285, 315, 345, 375, 405):
    add(whoosh(0.3), f - 6, 0.45)
    add(tone(880, 0.4, 0.12, (1, 0.3)), f, 0.08)
add(boom(1.0), 150, 0.7)
add(riser(1.4), 408, 0.3)

for i, f in enumerate((377, 385, 393)):
    add(pop(0.95 + 0.08 * i), f, 0.6)

# ---- END 450–555 ----
add(boom(2.0), 450, 0.9)
add(pop(1.0), 450 + 14, 0.9)
add(pop(1.15), 450 + 22, 0.9)
for i, fr in enumerate((440.0, 554.4, 659.3, 880.0)):
    add(tone(fr, 2.5, 0.9, (1, 0.2)), 490 + i * 2, 0.12)

# master: soft clip + fade out last 0.6 s
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.4) * 0.89
fo = int(SR * 0.6)
mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
pcm = (mix * 32767).astype("<i2")
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], round(DUR, 2), "s")
