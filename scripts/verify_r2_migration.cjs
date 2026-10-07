// Verify the production delivery through the same loader used by the app.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),babel=require('@babel/core'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),base=path.join(root,'master-db/cache/r2-migration');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Date,fetch});return module.exports;}
const delivery=plain('camera-delivery.js'),engine=plain('poland-engine.js');
(async()=>{
 const manifest=delivery.validateManifest(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json')).json()),checks=[],compression=[];
 let hasDirection=0,withoutDirection=0,red=0,sections=0,speeds=0,combined=0;
 for(const entry of manifest.countries){
  const result=await delivery.refreshCountryDelivery({country:entry.country_code});assert.equal(result.source,'r2');
  const feed=result.feed,original=JSON.parse(fs.readFileSync(path.join(base,entry.country_code+'-edge.json')));
  for(const g of ['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections']){
   const points=feed[g]||[],prior=(original[g]||[]).filter(p=>!p._example_only);
   assert.equal(points.length,prior.length);
   for(let i=0;i<points.length;i++){
    const p=points[i],old=prior[i];
    for(const field of ['id','latitude','longitude','speed_limit','direction','start','end']){
     if(old[field]!=null&&old[field]!=='')assert.equal(JSON.stringify(p[field]),JSON.stringify(old[field]),entry.country_code+' '+field);
    }
    if(p.direction!=null)hasDirection++;else withoutDirection++;
    if(p.speed_limit!=null)speeds++;
    if(p.camera_type==='combined')combined++;
   }
  }
  red+=(feed.red_light_cameras||[]).length;sections+=(feed.average_speed_sections||[]).length;
  const response=await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/countries/'+entry.country_code+'.json',{headers:{'Accept-Encoding':'identity'}}),alias=Buffer.from(await response.arrayBuffer());assert.equal(crypto.createHash('sha256').update(alias).digest('hex'),entry.checksum);
  const raw=fs.readFileSync(path.join(base,'objects',entry.path));const br=zlib.brotliCompressSync(raw,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:6}});
  compression.push({country_code:entry.country_code,json_bytes:raw.length,gzip_bytes:zlib.gzipSync(raw,{level:9}).length,brotli_quality6_bytes:br.length});
  checks.push({country_code:entry.country_code,records:entry.record_count,app_records_preserved:true,alias_checksum:true,result:'passed'});
  console.log('App production delivery verified',entry.country_code,entry.record_count);
 }
 const plEntry=manifest.countries.find(e=>e.country_code==='PL'),pl=delivery.verifyCountryExport(fs.readFileSync(path.join(base,'objects',plEntry.path),'utf8'),plEntry),section=pl.average_speed_sections[0];assert.equal(engine.detectAverageSpeedSection(pl,section.end.latitude,section.end.longitude,0,section.id).state,'ending');
 const publisher='https://speed-camera-data-publisher.ternzina.workers.dev/production/v1/manifest.json';assert.ok([401,404].includes((await fetch(publisher,{method:'PUT',body:'{}'})).status));
 assert.equal((await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json',{method:'PUT',body:'{}'})).status,405);
 const options=await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json',{method:'OPTIONS'});assert.equal(options.status,204);assert.equal(options.headers.get('Access-Control-Allow-Origin'),'*');
 const entry=manifest.countries.find(e=>e.country_code==='US'),head=await fetch(entry.url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('X-Content-SHA256'),entry.checksum);const conditional=await fetch(entry.url,{headers:{'If-None-Match':head.headers.get('ETag')}});assert.equal(conditional.status,304);
 const report={checked_at:new Date().toISOString(),countries:checks.length,published_records:manifest.total_records,checks,has_direction:hasDirection,without_direction:withoutDirection,speed_limits:speeds,red_light_render_sites:red,average_sections:sections,combined,polish_section_ending:true,cors:true,head:true,conditional_304:true,unsigned_upload_denied:true,public_write_denied:true,compression,compression_totals:compression.reduce((n,x)=>({json_bytes:n.json_bytes+x.json_bytes,gzip_bytes:n.gzip_bytes+x.gzip_bytes,brotli_quality6_bytes:n.brotli_quality6_bytes+x.brotli_quality6_bytes}),{json_bytes:0,gzip_bytes:0,brotli_quality6_bytes:0}),result:'passed'};
 fs.writeFileSync(path.join(root,'master-db/reports/r2-live-app-verification.json'),JSON.stringify(report,null,2)+'\n');console.log('Verified',report.countries,report.published_records,report.compression_totals);
})().catch(e=>{console.error(e);process.exitCode=1});
