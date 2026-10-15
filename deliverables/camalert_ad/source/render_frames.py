#!/usr/bin/env python3
"""Animate the four supplied CamAlert artworks into a 20-second 2.5D spot."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
import math, os

W,H,FPS,DURATION=720,1280,30,20
ROOT=os.path.dirname(__file__); ASSETS=os.path.join(ROOT,'assets'); OUT=os.path.join(ROOT,'frames')
os.makedirs(OUT,exist_ok=True)
FILES=['01_warning.png','02_approach.png','03_122_countries.png','04_final_app_store.png']
ART=[Image.open(os.path.join(ASSETS,n)).convert('RGB') for n in FILES]
FONT='/System/Library/Fonts/Supplemental/Arial.ttf'; BOLD='/System/Library/Fonts/Supplemental/Arial Bold.ttf'
def ease(v):
    v=max(0,min(1,v)); return v*v*(3-2*v)
def smooth(t,a,b): return ease((t-a)/(b-a))
def font(px,bold=False): return ImageFont.truetype(BOLD if bold else FONT,px)

def camera_state(art,scene,local):
    zoom=1.012+.078*ease(local/5)
    dx=math.sin(local*1.15+scene*.8)*9
    dy=math.sin(local*.85)*10 - 13*ease(local/5)
    fit=H/art.height
    fw=round(round(art.width*fit)*zoom); fh=round(H*zoom)
    return zoom,dx,dy,(W-fw)//2+int(dx),(H-fh)//2+int(dy),fit

def on_art(state,x,y):
    zoom,dx,dy,left,top,fit=state
    return (x*fit*zoom+left,y*fit*zoom+top)

def base_plate(art, state):
    # Blurred, gently drifting extension fills the vertical 9:16 frame. The crisp
    # portrait artwork stays fully visible in the middle instead of being cropped.
    zoom,drift_x,drift_y,left,top,fit_scale=state
    cover_scale=max(W/art.width,H/art.height)
    bg=art.resize((round(art.width*cover_scale),round(art.height*cover_scale)),Image.Resampling.LANCZOS)
    cx=(bg.width-W)//2+int(drift_x*.35); cy=(bg.height-H)//2+int(drift_y*.35)
    bg=bg.crop((cx,cy,cx+W,cy+H)).filter(ImageFilter.GaussianBlur(34))
    bg=ImageEnhance.Brightness(bg).enhance(.40)
    # Fill side gutters with an enlarged, low-contrast version of the source.
    fw,fh=round(art.width*fit_scale),H
    fg=art.resize((fw,fh),Image.Resampling.LANCZOS)
    # Restrained camera push-in and float establish depth without losing copy.
    z=zoom; fw2,fh2=round(fw*z),round(fh*z)
    fg=fg.resize((fw2,fh2),Image.Resampling.LANCZOS)
    # Tiny dutch tilt moves by scene to make the still artwork feel dimensional.
    fg=fg.rotate(math.sin(drift_y/45)*.22,resample=Image.Resampling.BICUBIC,expand=True)
    x=left; y=top
    bg.paste(fg,(x,y))
    # Vignette keeps the eye on the actual supplied key art.
    shade=Image.new('RGBA',(W,H)); sd=ImageDraw.Draw(shade)
    for k in range(7):
        a=4+k*2
        sd.rounded_rectangle((k*9,k*10,W-k*9,H-k*10),radius=32,outline=(0,8,20,a),width=22)
    return Image.alpha_composite(bg.convert('RGBA'),shade).convert('RGB')

def curve_path(draw, t, color=(48,190,255,130)):
    # Moving light dashes on the route and near road shoulders, composited above
    # the source photo as a restrained depth cue.
    phase=(t*170)%120
    pts=[(360,660),(356,568),(375,480),(420,399),(458,337)]
    draw.line(pts,fill=color,width=5,joint='curve')
    for n in range(7):
        v=(n*120+phase)%840
        q=v/840
        i=min(3,int(q*4)); u=q*4-i
        x=pts[i][0]*(1-u)+pts[i+1][0]*u; y=pts[i][1]*(1-u)+pts[i+1][1]*u
        r=3+4*(y/1280)
        draw.ellipse((x-r,y-r,x+r,y+r),fill=(156,233,255,220))

def road_pulse(layer,t,scene,state):
    d=ImageDraw.Draw(layer,'RGBA')
    if scene in (0,1): curve_path(d,t)
    # softly pulsing radar rings, placed over the camera unit in the artwork
    cx,cy=on_art(state,690,500)
    cx,cy=int(cx),int(cy)
    pulse=(t*1.45)%1
    for k in range(3):
        r=18+((pulse+k/3)%1)*48
        alpha=int(145*(1-((pulse+k/3)%1)))
        d.ellipse((cx-r,cy-r,cx+r,cy+r),outline=(61,185,255,alpha),width=3)
    if scene==0:
        a=int(60+50*(.5+.5*math.sin(t*5)))
        # warning-banner edge glow, without replacing any supplied copy
        d.rounded_rectangle((118,168,602,262),radius=40,outline=(255,54,58,a),width=8)
    if scene==1:
        # Redraw only the supplied distance banner so the number visibly counts
        # down from 450 m to the prepared 250 m value.
        p=max(0,min(1,(t-5)/4.7)); metres=round(450-200*p)
        # Match the original artwork's banner coordinates after the same camera
        # transform, so no part of its old static wording peeks through.
        x1,y1=on_art(state,150,278); x2,y2=on_art(state,795,418)
        box=(int(x1),int(y1),int(x2),int(y2))
        d.rounded_rectangle(box,radius=44,fill=(224,28,31,250),outline=(255,108,96,255),width=3)
        # subtle banner sheen
        d.rounded_rectangle((int(x1+12),int(y1+5),int(x2-12),int(y1+26)),radius=14,fill=(255,92,81,65))
        # warning triangle
        tri=[on_art(state,208,300),on_art(state,238,367),on_art(state,178,367)]
        d.polygon(tri,fill=(255,255,255,255))
        ic=on_art(state,208,344)
        d.text((int(ic[0]),int(ic[1])),'!',font=font(27,True),fill=(209,35,36),anchor='mm')
        tx,ty=on_art(state,490,346)
        d.text((int(tx),int(ty)),f'{metres} м до камеры',font=font(28,True),fill='white',anchor='mm',stroke_width=1,stroke_fill=(170,20,20))
        # The supplied speed-sign plate also contains a fixed 250 m label;
        # animate it with the banner so both distance cues stay consistent.
        sx1,sy1=on_art(state,625,670); sx2,sy2=on_art(state,748,738)
        d.rounded_rectangle((int(sx1),int(sy1),int(sx2),int(sy2)),radius=7,fill=(250,251,252,255),outline=(20,30,39,255),width=3)
        sx,sy=on_art(state,686,704)
        d.text((int(sx),int(sy)),f'{metres} м',font=font(17,True),fill=(12,20,29),anchor='mm')
    if scene==2:
        # Animated pin pulses and route sparkles on the illustrated Europe map.
        for i,(x,y) in enumerate([(185,520),(280,440),(376,560),(470,454),(535,620),(330,685)]):
            p=(t*.9+i*.17)%1; r=8+32*p; a=int(120*(1-p))
            d.ellipse((x-r,y-r,x+r,y+r),outline=(67,183,255,a),width=2)
        # Translate the baked-in directional labels for the Russian-language cut.
        for x1,y1,x2,y2,label,cx,cy in [
            (756,850,918,902,'ЕВРОПА',825,876),
            (756,914,894,964,'АЗИЯ',817,939),
            (740,972,894,1029,'АФРИКА',817,1001),
            (730,1026,920,1082,'АМЕРИКА',817,1054),
        ]:
            a=on_art(state,x1,y1); b=on_art(state,x2,y2)
            d.rounded_rectangle((int(a[0]),int(a[1]),int(b[0]),int(b[1])),radius=5,fill=(18,48,83,255))
            c=on_art(state,cx,cy)
            d.text((int(c[0]),int(c[1])),label,font=font(17,True),fill=(244,249,255,255),anchor='mm')
    if scene==3:
        # App Store callout gets a soft breathing blue halo.
        a=int(48+28*(.5+.5*math.sin(t*2.8)))
        x1,y1=on_art(state,126,1305); x2,y2=on_art(state,818,1514)
        d.rounded_rectangle((int(x1),int(y1),int(x2),int(y2)),radius=72,outline=(40,142,255,a),width=10)
    return layer

def scene_image(scene,local,t):
    state=camera_state(ART[scene],scene,local)
    im=base_plate(ART[scene],state)
    overlay=Image.new('RGBA',(W,H)); road_pulse(overlay,t,scene,state)
    im=Image.alpha_composite(im.convert('RGBA'),overlay).convert('RGB')
    return im

def frame_at(t):
    scene=min(3,int(t//5)); local=t-scene*5
    im=scene_image(scene,local,t)
    # Short soft cross-dissolves give the transitions a continuous camera move.
    if scene<3 and local>4.62:
        p=ease((local-4.62)/.38)
        nxt=scene_image(scene+1,local-5,t)
        im=Image.blend(im,nxt,p)
    # Brief exposure bloom follows each handoff, like a moving lens catching light.
    for boundary in (5,10,15):
        if boundary<=t<boundary+.22:
            a=int(44*(1-(t-boundary)/.22))
            flash=Image.new('RGBA',(W,H),(170,215,255,a))
            im=Image.alpha_composite(im.convert('RGBA'),flash).convert('RGB')
    return im

if __name__=='__main__':
    for i in range(FPS*DURATION):
        t=i/FPS; current=frame_at(t)
        current.save(os.path.join(OUT,f'{i:04d}.jpg'),quality=93)
        if i%60==0: print(f'{i}/{FPS*DURATION}',flush=True)
