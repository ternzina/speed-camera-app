"""Continue device-check.py: real background, screen-off and resume observations."""
import importlib.util,time,json
from pathlib import Path
spec=importlib.util.spec_from_file_location('check',Path(__file__).with_name('device-check.py'))
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
c.wait('Завершить маршрут')
c.adb('shell','input','keyevent','3')
c.adb('emu','geo','fix','30.5302','50.4538','100','10','21.6')
time.sleep(5)
c.adb('shell','input','keyevent','223')
power=c.adb('shell','dumpsys','power').decode()
assert 'mWakefulness=Asleep' in power, 'Screen did not sleep'
c.adb('emu','geo','fix','30.5302','50.4562','100','10','21.6')
time.sleep(8)
notifications=c.adb('shell','dumpsys','notification','--noredact').decode()
evidence=[s.strip() for s in notifications.splitlines() if 'Камера через' in s or 'Ограничение' in s]
(c.OUT/'screen-off.json').write_text(json.dumps({'asleep':True,'notifications':evidence},ensure_ascii=False,indent=2))
assert evidence,'No camera notification captured'
c.adb('shell','input','keyevent','224');c.adb('shell','input','keyevent','82')
c.adb('shell','am','start','-n','com.camera21wek/.MainActivity')
c.wait('Завершить маршрут');time.sleep(3);c.screenshot('03-after-wake.png')
c.tap('Назад');c.tap('ЗАВЕРШИТЬ МАРШРУТ');c.wait('Завершить поездку')
c.screenshot('04-return.png');c.tap('Завершить поездку');c.wait('Начать поездку')
c.adb('emu','geo','fix','30.5302','50.4562','100','10','0')
print('PASS: screen-off notification, resume, end route, end trip',flush=True)
