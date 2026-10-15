import subprocess,time,math,argparse,json
ADB='/Users/zina/.local/share/bp-scan-android/sdk/platform-tools/adb'
p=argparse.ArgumentParser();p.add_argument('--seconds',type=int,default=65);p.add_argument('--speed',type=float,default=40);a=p.parse_args()
# Existing camera #2, Kyiv embankment. Emulator-only GPS injection, no database writes.
# Synthetic straight segment, not a road-accurate Google route. geo fix reports bearing 0.
# Run only during an explicitly started test trip; verify the device screen separately.
lat0,lon0=50.4529,30.5335
lat1,lon1=50.4589,30.5283
course=(math.degrees(math.atan2((lon1-lon0)*math.cos(math.radians(lat0)),lat1-lat0))+360)%360
length=math.hypot((lat1-lat0)*111320,(lon1-lon0)*111320*math.cos(math.radians(lat0)))
started=time.monotonic()
for i in range(a.seconds):
 f=min(1,i*a.speed/3.6/length);lat=lat0+(lat1-lat0)*f;lon=lon0+(lon1-lon0)*f
 r=subprocess.run([ADB,'-s','emulator-5554','emu','geo','fix',str(lon),str(lat),'100','10',str(a.speed/1.852)],capture_output=True,text=True,timeout=10)
 if r.returncode or 'OK' not in r.stdout:raise RuntimeError(r.stdout+r.stderr)
 print(json.dumps({'second':i,'latitude':lat,'longitude':lon,'kmh':a.speed}),flush=True)
 time.sleep(max(0,started+i+1-time.monotonic()))
