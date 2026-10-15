#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "$HERE"
OUT="$(cd .. && pwd)"
PY="/Users/zina/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"

"$PY" render_frames.py
"$PY" make_music.py
ffmpeg -hide_banner -y -framerate 30 -i frames/%04d.jpg \
  -vf "scale=1080:1920:flags=lanczos,setsar=1,format=yuv420p" \
  -c:v libx264 -preset slow -crf 17 -t 20 -movflags +faststart -an \
  "$OUT/CamAlert_TikTok_clean.mp4"

# Voice lines land at the matching scene beats. The music is an original local
# synth cue; the alert is a short original two-tone chime.
ffmpeg -hide_banner -y -i "$OUT/CamAlert_TikTok_clean.mp4" \
  -i audio/music_original.wav -i audio/alert_beep.wav \
  -i audio/01_warning.mp3 -i audio/02_speed.mp3 \
  -i audio/03_countries.mp3 -i audio/04_tagline.mp3 \
  -filter_complex "\
    [1:a]volume=0.72,atrim=duration=20[music];\
    [2:a]adelay=850|850,volume=0.48[beep];\
    [3:a]adelay=400|400,volume=1.0[v1];\
    [4:a]adelay=5350|5350,volume=1.0[v2];\
    [5:a]adelay=10100|10100,volume=1.0[v3];\
    [6:a]adelay=16050|16050,volume=1.0[v4];\
    [v1][v2][v3][v4]amix=inputs=4:duration=longest:normalize=0,\
      acompressor=threshold=0.16:ratio=2:attack=15:release=160,\
      apad=whole_dur=20,atrim=duration=20,asplit=2[voice_sc][voice_mix];\
    [music][voice_sc]sidechaincompress=threshold=0.025:ratio=5:attack=25:release=450[ducked];\
    [ducked][voice_mix][beep]amix=inputs=3:duration=longest:normalize=0,\
      alimiter=limit=0.95,atrim=duration=20,afade=t=out:st=19.55:d=0.45,\
      loudnorm=I=-16:TP=-1.5:LRA=7[aout]" \
  -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -t 20 -movflags +faststart "$OUT/CamAlert_TikTok_voice.mp4"

ffmpeg -hide_banner -y -i "$OUT/CamAlert_TikTok_clean.mp4" \
  -i audio/music_original.wav -i audio/alert_beep.wav \
  -filter_complex "[1:a]volume=0.72,atrim=duration=20[m];\
    [2:a]adelay=850|850,volume=0.48[b];\
    [m][b]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95,\
      atrim=duration=20,afade=t=out:st=19.55:d=0.45,\
      loudnorm=I=-16:TP=-1.5:LRA=7[a]" \
  -map 0:v:0 -map "[a]" -c:v copy -c:a aac -b:a 192k -ar 48000 \
  -t 20 -movflags +faststart "$OUT/CamAlert_TikTok_music_only.mp4"

echo "Created files in $OUT"
