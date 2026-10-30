# Bibliodor : pub « L'intelligence artificielle de A à Z »

Vidéo verticale 9:16 (1080x1920, 34,6 s) pour Reels, TikTok et le site.

- Voix off : ElevenLabs, voix « Paul K — French Ad & Trailer Voice » (eleven_v4), prise A (`public/vo_a.mp3`).
- Minutage des mots : transcription ElevenLabs Scribe. Les temps sont repris en dur dans `src/Pub.tsx`.
- Musique et bruitages : synthétisés par `audio/sfx.py` (aucun fichier externe).
- Mixage : voix + score dans `public/mix.wav`, normalisé à −14 LUFS.
- Rendu final : `out/bibliodor-ia-a-z.mp4`.

## Refaire le rendu

```bash
npm install
python3 audio/sfx.py public/score.wav
ffmpeg -y -i public/vo_a.mp3 -i public/score.wav -filter_complex "[0:a]aresample=48000,loudnorm=I=-15:TP=-1.5:LRA=11,apad=whole_dur=34.6[v];[1:a]volume=0.55[m];[v][m]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1:LRA=11[o]" -map "[o]" -ar 48000 -ac 2 public/mix.wav
npx remotion render src/index.ts Pub out/bibliodor-ia-a-z.mp4 --codec=h264 --crf=16 --audio-codec=aac --audio-bitrate=320k
```
