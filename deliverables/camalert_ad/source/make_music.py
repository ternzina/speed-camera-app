#!/usr/bin/env python3
"""Create original, royalty-free synthetic underscore and warning chirp."""
import numpy as np, wave, os
SR=44100; D=20.0
base=os.path.dirname(__file__)
def write(path,x):
    x=np.clip(x,-1,1); data=(x*32767).astype('<i2')
    with wave.open(path,'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(data.tobytes())
t=np.arange(int(SR*D))/SR
# Gentle four-chord ambient synth: Dm – Bb – F – C.
chords=[(146.83,174.61,220.00),(116.54,146.83,174.61),(87.31,110.00,130.81),(130.81,164.81,196.00)]
pad=np.zeros_like(t); beat=60/94
for ci,notes in enumerate(chords):
    start=ci*5; mask=(t>=start)&(t<start+5)
    local=t[mask]-start; a=np.minimum(1,local/.8)*np.minimum(1,(5-local)/1.1)
    for j,f in enumerate(notes):
        pad[mask]+=a*(np.sin(2*np.pi*f*t[mask]+j*.5)+.23*np.sin(4*np.pi*f*t[mask]+j))*.055
# Plucked muted notes, low pulse and light percussive ticks.
pluck=np.zeros_like(t); kick=np.zeros_like(t); tick=np.zeros_like(t)
for n in range(int(D/beat)+1):
    s=n*beat
    if s>=D: continue
    idx=(t>=s)&(t<s+.42); u=t[idx]-s
    f=chords[(int(s)//5)%4][n%3]
    pluck[idx]+=.11*np.exp(-u*9)*np.sin(2*np.pi*f*2*u)
    if n%2==0:
        kick[idx]+=.13*np.exp(-u*20)*np.sin(2*np.pi*(58-24*u)*u)
    if n%2==1:
        tick[idx]+=.015*np.exp(-u*48)*np.sin(2*np.pi*6800*u)
# airy high note motif on off-beats
for s in np.arange(beat/2,D,beat*2):
    idx=(t>=s)&(t<s+.75); u=t[idx]-s
    freq=[440,523.25,392,587.33][int(s//2)%4]
    pluck[idx]+=.035*np.exp(-u*4.5)*np.sin(2*np.pi*freq*u)
env=np.minimum(1,t/.7)*np.minimum(1,(D-t)/1.3)
mono=(pad+pluck+kick+tick)*env
mono*=.8
# Slight stereo width from a delayed low-level copy.
delay=int(.018*SR); right=np.roll(mono,delay)*.82; right[:delay]=0
write(os.path.join(base,'audio','music_original.wav'),np.column_stack([mono,right]))
# Short, gentle descending two-tone alert
T=.42; s=np.arange(int(SR*T))/SR
beep=.24*np.sin(2*np.pi*(1040-260*s/T)*s)*np.minimum(1,s/.025)*np.minimum(1,(T-s)/.08)
write(os.path.join(base,'audio','alert_beep.wav'),np.column_stack([beep,beep]))
