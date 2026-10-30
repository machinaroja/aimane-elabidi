# Third-party notices

## cstack (animated-video skill)

Several template files are copied from, or adapted from, the `templates/remotion-film/` starter of
the `animated-video` skill in [cstack](https://github.com/goodnight000/cstack), which is MIT licensed:

- Copied unchanged: `src/kit/camera.tsx`, `src/kit/finish.tsx`, `src/kit/three-canvas.tsx`,
  `audio/dsp.py`, `sheet.py`, `tsconfig.json` (where present in `skills/*/template/`).
- Adapted: `align.py`, `board.py`, `render.sh`, `snap.sh`, `src/lib.ts` (where present in `skills/*/template/`).

```
MIT License

Copyright (c) 2026 Charles Zheng

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Not bundled

These are dependencies you install yourself; nothing from them is included in this repository:
Remotion, three.js / @react-three/fiber, HyperFrames, GSAP, FFmpeg, faster-whisper,
RobustVideoMatting, OpenCV (YuNet, Haar cascades), DeepFilterNet (MIT / Apache-2.0; used by news-qa-reel in its own venv), edge-tts, and the ElevenLabs / HeyGen APIs.
Fonts named in the skills (Fraunces, Anton, Caveat, Courier Prime, Source Serif 4, IBM Plex Mono,
JetBrains Mono, Ink Free and others) are not included; get them under their own licences.
