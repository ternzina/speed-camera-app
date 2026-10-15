"""Run on the selected test emulator; requires existing onboarding and downloaded UA DB.
Uses observed accessibility labels, explicit waits and saves real screenshots.
No production database or application data is reset.
"""
import subprocess,time,re,xml.etree.ElementTree as ET
from pathlib import Path
ADB='/Users/zina/.local/share/bp-scan-android/sdk/platform-tools/adb'
SERIAL='emulator-5554'
OUT=Path(__file__).parent

def adb(*args):
 return subprocess.run([ADB,'-s',SERIAL,*map(str,args)],capture_output=True,timeout=15,check=True).stdout

def tree():
 adb('shell','uiautomator','dump','/sdcard/camalert-ui.xml')
 return ET.fromstring(adb('shell','cat','/sdcard/camalert-ui.xml'))

def wait(label,timeout=45):
 deadline=time.monotonic()+timeout
 while time.monotonic()<deadline:
  root=tree()
  for node in root.iter('node'):
   if label in [node.get('text'),node.get('content-desc')]:return node
  time.sleep(1)
 raise AssertionError('UI not found: '+label)

def tap(label):
 node=wait(label);x1,y1,x2,y2=map(int,re.findall(r'\d+',node.get('bounds')))
 adb('shell','input','tap',(x1+x2)//2,(y1+y2)//2)

def screenshot(name): (OUT/name).write_bytes(adb('exec-out','screencap','-p'))

if __name__=='__main__':
 adb('shell','am','start','-n','com.camera21wek/.MainActivity')
 tap('Google Maps');tap('Google Maps. Маршрут в CamAlert')
 tap('Пункт назначения')
 time.sleep(1)
 adb('shell','input','keycombination','113','29')
 adb('shell','input','keyevent','67')
 time.sleep(.5)
 for char in '50.4589,30.5283':
  adb('shell','input','text',char); time.sleep(.25)
 # Press Find after the input has actually been populated.
 wait('50.4589,30.5283');tap('Найти')
 wait('50.45890, 30.52830')
 adb('emu','geo','fix','30.5335','50.4529','100','10','0')
 tap('Построить маршрут');wait('Начать навигацию',60)
 screenshot('01-route-preview.png')
 print('PASS: route built after install',flush=True)
 tap('Начать навигацию');wait('Завершить маршрут')
 screenshot('02-guidance.png')
 print('PASS: guidance started',flush=True)
