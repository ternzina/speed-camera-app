# CamAlert TikTok / Reels ad

Exports are 1080×1920, 30 fps, 20 seconds:

- `CamAlert_TikTok_voice.mp4` — music, alert sound, and Russian voice-over.
- `CamAlert_TikTok_music_only.mp4` — music and alert sound, no voice.
- `CamAlert_TikTok_clean.mp4` — picture only, no audio.

## Editable source

The `source/` folder contains the supplied artwork in `assets/`, the rendered
frames, the original synthesized music and alert sound, the four voice clips,
and the scripts used to render and assemble the ad. Edit `source/copy.txt` and
`source/synthesize_voice.py` when translating or revising narration. Then run
`source/build.sh` to rebuild all three videos. ElevenLabs regeneration requires
`ELEVENLABS_API_KEY` in the environment.

The animation uses the supplied key art as the main plane, with a gently moving
camera, blurred depth extension, a pulsing camera marker, animated route lights,
a distance count from 450 m to 250 m, and a short cross-dissolve between scenes.
The source artwork remains visible, including the App Store-only final frame.
Music and alert sound are synthesized locally for this spot.

## Source assets and reference

The four supplied PNGs are copied into `source/assets/` and ordered by scene.
The reference video path in the brief (`/mnt/data/ScreenRecording_10-09-2026
10-50-05_1.mp4`) was not available on this Mac, so the timing and movement use
the written brief and supplied key art.
