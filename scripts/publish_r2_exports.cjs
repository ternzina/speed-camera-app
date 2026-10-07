// Node runtime only; private Ed25519 key never leaves ignored .env.r2-publisher.
const fs=require('fs'),path=require('path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base=path.join(root,'master-db/cache/r2-migration');
const publisher='https://speed-camera-data-publisher.ternzina.workers.dev',delivery='https://speed-camera-data.ternzina.workers.dev';
const key=crypto.createPrivateKey(JSON.parse(fs.readFileSync(path.join(root,'.env.r2-publisher'))).private_key);
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
async function upload(object){
 const body=fs.readFileSync(path.join(base,'objects',object)),digest=crypto.createHash('sha256').update(body).digest('hex');
 const time=String(Math.floor(Date.now()/1000)),signature=crypto.sign(null,Buffer.from(['PUT',object,time,digest,String(body.length)].join('\n')),key).toString('base64');
 const r=await fetch(publisher+'/'+object,{method:'PUT',body,headers:{'X-Publish-Time':time,'X-Publish-Signature':signature,'X-Publish-Digest':digest,'Content-Length':String(body.length)},signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error('Upload '+object+': '+r.status+' '+await r.text());
 const result=await r.json();if(result.size!==body.length)throw new Error('Size mismatch');
 return result;
}
async function verify(entry,encoding){
 const r=await fetch(delivery+'/'+entry.path,{headers:{'Accept-Encoding':encoding},signal:AbortSignal.timeout(60000)});
 if(!r.ok)throw new Error('Download '+entry.country_code+': '+r.status);
 const body=Buffer.from(await r.arrayBuffer()),sha=crypto.createHash('sha256').update(body).digest('hex');
 if(sha!==entry.checksum||body.length!==entry.size_bytes)throw new Error('Checksum/size '+entry.country_code);
 if(r.headers.get('X-Content-SHA256')!==sha)throw new Error('Missing digest header');
 if(!r.headers.get('Cache-Control').includes('immutable'))throw new Error('Missing immutable cache');
 if(encoding==='gzip'&&r.headers.get('Content-Encoding')!=='gzip')throw new Error('Missing HTTP gzip');
 const data=JSON.parse(body);
 const count=['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'].reduce((n,g)=>n+(data[g]?.length||0),0);
 if(count!==entry.record_count||data.country!==entry.country_code)throw new Error('Records mismatch');
 return {country_code:entry.country_code,record_count:count,checksum:sha,encoding,result:'passed'};
}
(async()=>{
 const checks=[],uploads=[];
 for(const entry of manifest.countries){
  for(const suffix of [''])uploads.push(await upload(entry.path+suffix));
  checks.push(await verify(entry,'identity'));checks.push(await verify(entry,'gzip'));
  console.log('R2 verified',entry.country_code,entry.record_count);
 }
 const dbCheck=spawnSync(path.join(root,'.bootstrap-venv/bin/python'),[path.join(root,'scripts/verify_r2_db_snapshot.py')],{cwd:root,encoding:'utf8'});
 if(dbCheck.status!==0)throw new Error('Database changed during export; manifest not published: '+dbCheck.stderr);
 // Verify before exposing a new release. Mutable manifest is the only commit pointer.
 const previous=await fetch(delivery+'/production/v1/manifest.json');
 if(previous.ok)fs.writeFileSync(path.join(root,'master-db/backups/r2-migration/previous-manifest.json'),Buffer.from(await previous.arrayBuffer()));
 uploads.push(await upload('production/v1/manifest.json'));
 const r=await fetch(delivery+'/production/v1/manifest.json',{headers:{'Cache-Control':'no-cache'}});
 if(!r.ok)throw new Error('Manifest unavailable');
 const downloaded=await r.json();if(JSON.stringify(downloaded)!==JSON.stringify(manifest))throw new Error('Manifest mismatch');
 const report={checked_at:new Date().toISOString(),delivery_url:delivery,objects_uploaded:uploads.length,total_records:manifest.total_records,countries:manifest.countries.length,total_stored_bytes:uploads.reduce((n,x)=>n+x.size,0),checks};
 fs.writeFileSync(path.join(root,'master-db/reports/r2-delivery-verification.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Published',report.objects_uploaded,report.total_records,report.total_stored_bytes);
})().catch(e=>{console.error(e.message);process.exitCode=1});
