"""Synthesised score + sound design for the Bibliodor ad (no external assets).

Writes public/score.wav (48 kHz stereo). Timings follow the voice-over word timings.
"""
import numpy as np
import wave
import sys

SR = 48000
DUR = 34.6
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
out = np.zeros(N)


def env(start, end, attack=0.3, release=0.6):
    e = np.zeros(N)
    a, b = int(start * SR), int(end * SR)
    seg = np.ones(b - a)
    na, nr = int(attack * SR), int(release * SR)
    seg[:na] = np.linspace(0, 1, na)
    seg[-nr:] *= np.linspace(1, 0, nr)
    e[a:b] = seg
    return e


def lowpass(x, k):
    # cheap one-pole lowpass, k in (0,1)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += k * (x[i] - acc)
        y[i] = acc
    return y


def place(sig, at, gain=1.0):
    a = int(at * SR)
    b = min(N, a + len(sig))
    out[a:b] += sig[: b - a] * gain


# 1. Dark drone for the hook + tension (0 -> 20.0)
lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.12 * t)
drone = (np.sin(2 * np.pi * 55 * t) + 0.6 * np.sin(2 * np.pi * 82.4 * t) + 0.25 * np.sin(2 * np.pi * 110.3 * t)) * lfo
tension = np.clip((t - 8.7) / 11.3, 0, 1)  # builds during "le monde accélère" -> "trop vite"
out += drone * env(0, 20.0, 1.5, 0.25) * (0.10 + 0.08 * tension)

# 2. Accelerating clock ticks (8.8 -> 18.6)
tick = np.sin(2 * np.pi * 2400 * np.arange(int(0.025 * SR)) / SR) * np.exp(-np.arange(int(0.025 * SR)) / (0.004 * SR))
tt, i = 8.8, 0
while tt < 18.6:
    place(tick, tt, 0.16 if i % 2 == 0 else 0.10)
    frac = (tt - 8.8) / 9.8
    tt += 0.5 - 0.32 * frac
    i += 1

# 3. Riser into "Maintenant" (16.9 -> 20.05)
rs = int(3.15 * SR)
rt = np.arange(rs) / SR
riser = rng.standard_normal(rs) * (rt / rt[-1]) ** 2
riser = riser - lowpass(riser, 0.05)  # high-passed noise
riser += 0.5 * np.sin(2 * np.pi * (200 * rt + 260 * rt ** 2)) * (rt / rt[-1]) ** 2
place(riser, 16.9, 0.10)


# 4. Whooshes on scene changes
def whoosh(length=0.7):
    n = int(length * SR)
    x = rng.standard_normal(n)
    k = np.linspace(0.02, 0.35, n)
    y = np.empty(n)
    acc = 0.0
    for j in range(n):
        acc += k[j] * (x[j] - acc)
        y[j] = acc
    shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    return y * shape


for at in (3.2, 6.55, 8.55, 14.6, 18.55, 30.1):
    place(whoosh(), at, 0.35)


# 5. Impacts (sub boom + click)
def boom(length=1.6, f0=70):
    n = int(length * SR)
    bt = np.arange(n) / SR
    f = f0 * np.exp(-bt * 2.0) + 30
    phase = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(phase) * np.exp(-bt * 2.6)
    s[: int(0.01 * SR)] += rng.standard_normal(int(0.01 * SR)) * 0.6
    return s


place(boom(), 20.06, 0.55)   # MAINTENANT
place(boom(1.2, 90), 22.95, 0.35)  # Z
place(boom(1.0, 80), 32.18, 0.35)  # Obtenez le guide

# 6. Warm, hopeful pad for the product reveal (20.9 -> end)
chord = [130.81, 164.81, 196.0, 261.63, 329.63]  # C major, open
pad = sum(np.sin(2 * np.pi * f * t + i) * (0.8 ** i) for i, f in enumerate(chord))
pad *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
out += pad * env(20.5, DUR, 1.2, 1.4) * 0.045

# shimmer arpeggio over the benefits
notes = [523.25, 659.25, 783.99, 1046.5]
for k, at in enumerate((25.2, 26.24, 27.68, 28.72)):
    n = int(0.9 * SR)
    nt = np.arange(n) / SR
    place(np.sin(2 * np.pi * notes[k] * nt) * np.exp(-nt * 4), at, 0.07)

out = np.tanh(out * 1.2)
out /= max(1e-9, np.abs(out).max()) / 0.7
stereo = np.stack([out, np.roll(out, 240)], axis=1)
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "public/score.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
