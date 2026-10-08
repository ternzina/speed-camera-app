// Small representative datasets for repeatable tests on a fresh checkout. Never publish these fixtures.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const base=path.join(root,'build/protected-delivery/objects');
try {await fs.access(path.join(base,'protected/v2/manifest.json'));process.exit(0);} catch {}
const fixture=JSON.parse(await fs.readFile(path.join(import.meta.dirname,'fixtures/protected-countries.json'),'utf8'));
const manifest={schema_version:2,generated_at:'2026-10-08T00:00:00Z',total_records:0,attribution:fixture.attribution,license_url:fixture.license_url,countries:[]};
for(const feed of fixture.countries){
 feed.counts=Object.fromEntries(['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'].filter(g=>feed[g]).map(g=>[g,feed[g].length]));
 const text=JSON.stringify(feed),checksum=crypto.createHash('sha256').update(text).digest('hex');
 const file=path.join(base,`protected/v2/countries/${feed.country}/${checksum}.json`);
 await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);
 manifest.countries.push({country_code:feed.country,name_key:'country.'+feed.country,record_count:feed.record_count,version:checksum,checksum,size_bytes:Buffer.byteLength(text),updated_at:feed.updated_at});manifest.total_records+=feed.record_count;
}
await fs.writeFile(path.join(base,'protected/v2/manifest.json'),JSON.stringify(manifest));
console.log('Prepared six local test fixtures; not production exports.');
