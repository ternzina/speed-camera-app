import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../../camera-alert-copy.js', import.meta.url), 'utf8');
const { cameraAlertCopy } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
let count = 0;
for (const language of ['ru', 'uk', 'pl', 'en']) {
  for (const [limit, speed, available, expected] of [[90,78,true,false],[90,91,true,true],[90,100,false,false], ...[null,undefined,0,-1,'invalid'].map(limit=>[limit,100,true,false])]) {
    assert.equal(cameraAlertCopy(language, {distance:250,speed_limit:limit}, speed, available).over, expected);
    count++;
  }
}
assert.equal(cameraAlertCopy('ru',{distance:250,speed_limit:90},78).body,'Ограничение 90 км/ч.');
console.log(`PASS: ${count + 1} alert wording checks`);
