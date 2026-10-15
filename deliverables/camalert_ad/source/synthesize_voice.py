#!/usr/bin/env python3
"""Generate the four editable Russian voice lines with configured ElevenLabs."""
import os, urllib.request, json
from pathlib import Path

ROOT=Path(__file__).parent/'audio'; ROOT.mkdir(parents=True,exist_ok=True)
VOICE_ID='dZde1M1SiLkAKiqjpqqT' # Anton 2.0 — soft male voice
LINES=[
 ('01_warning','Камера впереди! CamAlert предупредит заранее.'),
 ('02_speed','Контролируй скорость и знай, что ждёт впереди.'),
 ('03_countries','Тысячи дорожных камер в ста двадцати двух странах.'),
 ('04_tagline','CamAlert. Езжай спокойнее.'),
]
key=os.environ.get('ELEVENLABS_API_KEY')
if not key: raise SystemExit('Set ELEVENLABS_API_KEY before regenerating voice.')
for slug,text in LINES:
    body=json.dumps({'text':text,'model_id':'eleven_multilingual_v2','voice_settings':{'stability':.62,'similarity_boost':.78,'style':.18,'use_speaker_boost':True}}).encode()
    req=urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}',data=body,headers={'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'})
    with urllib.request.urlopen(req,timeout=120) as res: (ROOT/f'{slug}.mp3').write_bytes(res.read())
    print('Generated',slug)
