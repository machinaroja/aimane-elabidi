"""Synthesised sound design for the presenter ad (no external assets).

Writes the score to the path given as argv[1] (48 kHz stereo). Timings follow the voice-over.
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 25.8
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
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


def place(sig, at, gain=1.0):
    a = int(at * SR)
    b = min(N, a + len(sig))
    out[a:b] += sig[: b - a] * gain


def whoosh(length=0.6):
    n = int(length * SR)
    x = rng.standard_normal(n)
    k = np.linspace(0.02, 0.35, n)
    y = np.empty(n)
    acc = 0.0
    for j in range(n):
        acc += k[j] * (x[j] - acc)
        y[j] = acc
    return y * np.sin(np.pi * np.linspace(0, 1, n)) ** 2


def boom(length=1.4, f0=75):
    n = int(length * SR)
    bt = np.arange(n) / SR
    f = f0 * np.exp(-bt * 2.0) + 30
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-bt * 2.8)
    s[: int(0.01 * SR)] += rng.standard_normal(int(0.01 * SR)) * 0.5
    return s


def pop(freq):
    n = int(0.5 * SR)
    pt = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * pt) * np.exp(-pt * 9)


# Pulsing minor bed under the hook and the urgency part (0 -> 12.3)
beat = 0.5 * (1 + np.sign(np.sin(2 * np.pi * 2.0 * t)))  # 120 bpm gate
bass = np.sin(2 * np.pi * 55 * t) * (0.6 + 0.4 * beat) + 0.4 * np.sin(2 * np.pi * 82.4 * t)
urgency = np.clip((t - 7.2) / 5.0, 0, 1)
out += bass * env(0, 12.32, 0.8, 0.12) * (0.08 + 0.07 * urgency)

# Ticking clock while "tout va trop vite" (7.3 -> 12.2), accelerating
tick = np.sin(2 * np.pi * 2400 * np.arange(int(0.02 * SR)) / SR) * np.exp(-np.arange(int(0.02 * SR)) / (0.004 * SR))
tt = 7.3
while tt < 12.2:
    place(tick, tt, 0.13)
    tt += 0.42 - 0.26 * (tt - 7.3) / 4.9

# Warm major pad for the product and the CTA (12.3 -> end)
chord = [130.81, 164.81, 196.0, 261.63, 329.63]
pad = sum(np.sin(2 * np.pi * f * t + i) * (0.8 ** i) for i, f in enumerate(chord))
pad *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
out += pad * env(12.2, DUR, 0.6, 1.2) * 0.05

for at in (5.35, 7.1, 12.75, 21.8):
    place(whoosh(), at, 0.3)
place(boom(), 12.32, 0.5)       # "Maintenant"
place(boom(1.0, 90), 23.52, 0.3)  # "Obtenez le guide"
for k, at in enumerate((17.04, 18.08, 19.52, 20.48)):
    place(pop((523.25, 659.25, 783.99, 1046.5)[k]), at, 0.08)

out = np.tanh(out * 1.2)
out /= max(1e-9, np.abs(out).max()) / 0.7
pcm = (np.stack([out, np.roll(out, 240)], axis=1) * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
