// Offline preparation only: no database connections, writes to R2, or collector changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { minimalCountry } from '../cloudflare/camera-data/export-projection.mjs';
const root=path.resolve(import.meta.dirname,'..');
const input=path.resolve(process.argv[2]||path.join(root,'master-db/cache/r2-migration'));
const output=path.resolve(process.argv[3]||path.join(root,'build/protected-delivery'));
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
const source=JSON.parse(await fs.readFile(path.join(input,'manifest.json'),'utf8'));
const manifest={schema_version:2,generated_at:new Date().toISOString(),total_records:0,countries:[],attribution:source.attribution,license_url:source.license_url};
for(const entry of source.countries){
 if(!/^[A-Z]{2}$/.test(entry.country_code)||entry.path!==`production/v1/countries/${entry.country_code}/${entry.checksum}.json`)throw Error('Unsafe input key');
 const raw=await fs.readFile(path.join(input,'objects',entry.path));
 if(sha(raw)!==entry.checksum||raw.length!==entry.size_bytes)throw Error('Source checksum mismatch');
 const feed=minimalCountry(JSON.parse(raw),entry.country_code,entry.updated_at);
 const text=JSON.stringify(feed),checksum=sha(text);
 const target=path.join(output,'objects',`protected/v2/countries/${entry.country_code}/${checksum}.json`);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,text);
 manifest.countries.push({country_code:entry.country_code,name_key:`country.${entry.country_code}`,record_count:feed.record_count,version:checksum,checksum,size_bytes:Buffer.byteLength(text),updated_at:entry.updated_at,...(entry.geography_level?{geography_level:entry.geography_level}:{})});
 manifest.total_records+=feed.record_count;
}
const target=path.join(output,'objects/protected/v2/manifest.json');await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,JSON.stringify(manifest));
console.log(JSON.stringify({prepared:true,published:false,countries:manifest.countries.length,records:manifest.total_records,output}));
