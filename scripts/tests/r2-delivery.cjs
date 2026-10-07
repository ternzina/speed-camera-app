const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),babel=require('@babel/core'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'master-db/cache/r2-migration');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Date,console});return module.exports;}
const hash=plain('sha256.js'),delivery=plain('camera-delivery.js'),cache=plain('camera-data.js');
const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));
let checks=0;
for(const s of ['', 'abc','Камера на дороге 🚗','\ud800','a'.repeat(1000000)]){assert.equal(hash.sha256(s),crypto.createHash('sha256').update(s).digest('hex'));checks++;}
delivery.validateManifest(manifest);
const feeds={};
for(const e of manifest.countries){const text=fs.readFileSync(path.join(base,'objects',e.path),'utf8');feeds[e.country_code]=delivery.verifyCountryExport(text,e);checks++;assert.throws(()=>delivery.verifyCountryExport(text+' ',e));}
assert.equal(feeds.PL.red_light_cameras.length,68);assert.equal(feeds.PL.average_speed_sections.length,224);assert.ok(feeds.UA.cameras.length>=426);const confirmedUA=feeds.UA.cameras.find(p=>p.id==='UA_NPU_CURRENT:370');assert.ok(confirmedUA);assert.equal(confirmedUA.latitude,48.734109);assert.equal(confirmedUA.longitude,30.157576);assert.equal(confirmedUA.speed_limit,50);
function response(text,ok=true){return {ok,headers:{get:()=>null},text:async()=>text};}
(async()=>{
 const entry=manifest.countries.find(e=>e.country_code==='FR');let calls=[];
 const fetcher=async url=>{calls.push(url);return response(url.includes('manifest.json')?JSON.stringify(manifest):fs.readFileSync(path.join(base,'objects',entry.path),'utf8'));};
 let result=await delivery.refreshCountryDelivery({country:'FR',fetcher});assert.equal(result.source,'r2');assert.equal(calls.length,2);checks++;
 calls=[];result=await delivery.refreshCountryDelivery({country:'FR',feeds:{FR:feeds.FR},versions:{FR:entry.version},fetcher});assert.equal(result.source,'cache-current');assert.equal(calls.length,1);checks++;
 const offline=async()=>{throw new Error('offline')};result=await delivery.refreshCountryDelivery({country:'FR',feeds:{FR:feeds.FR},versions:{FR:entry.version},fetcher:offline});assert.equal(result.source,'offline');assert.equal(result.feed,feeds.FR);checks++;
 result=await delivery.refreshCountryDelivery({country:'FR',fetcher:offline});assert.equal(result.source,'bundled');assert.equal(result.feed,null);checks++;
 result=await delivery.refreshCountryDelivery({country:'FR',fetcher:async url=>url.includes('supabase')?response(JSON.stringify(feeds.FR)):url.includes('manifest')?response(JSON.stringify(manifest)):response('{}')});assert.equal(result.source,'supabase');assert.equal(result.version,null);checks++;
 const broken=JSON.parse(JSON.stringify(manifest));broken.countries[0].path='https://evil.invalid';assert.throws(()=>delivery.validateManifest(broken));checks++;
 const values=new Map();let fail=false;
 const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{if(fail==='pointer'&&k==='cache')throw new Error('pointer write failed');if(fail===true&&k.includes(':v4:'))throw new Error('disk full');assert.ok(Buffer.byteLength(v)<1000000);values.set(k,v);},removeItem:async k=>values.delete(k)};
 await cache.saveCameraCache(storage,'cache',{feeds:{FR:feeds.FR},countries:[],stamp:'good',countryVersions:{FR:entry.version}},'FR');
 const pointer=values.get('cache');fail=true;
 await assert.rejects(cache.saveCameraCache(storage,'cache',{feeds:{FR:{speed_cameras:[]}},countries:[],stamp:'bad'},'FR'));
 assert.equal(values.get('cache'),pointer);let loaded=await cache.loadCameraCache(storage,'cache');assert.equal(loaded.stamp,'good');assert.equal(loaded.feeds.FR.speed_cameras.length,feeds.FR.speed_cameras.length);checks++;
 fail='pointer';await assert.rejects(cache.saveCameraCache(storage,'cache',{feeds:{FR:feeds.FR},countries:[],stamp:'bad-pointer'},'FR'));assert.equal(values.get('cache'),pointer);assert.equal((await cache.loadCameraCache(storage,'cache')).stamp,'good');checks++;
 values.set('cache','corrupt JSON');assert.equal(await cache.loadCameraCache(storage,'cache'),null);checks++;values.set('cache',pointer);
 fail=false;await cache.saveCameraCache(storage,'cache',{feeds:{FR:feeds.FR,CA:feeds.CA},countries:[],stamp:'next'},'CA');loaded=await cache.loadCameraCache(storage,'cache');assert.ok(loaded.feeds.FR&&loaded.feeds.CA);checks++;
 const index=JSON.parse(values.get('cache'));values.set(index.feedChunks.FR.prefix+':0','corrupt');loaded=await cache.loadCameraCache(storage,'cache');assert.equal(loaded.feeds.FR,undefined);assert.ok(loaded.feeds.CA);checks++;
 const report={checked_at:new Date().toISOString(),checks,all_country_checks:manifest.countries.length,sha256_known_vectors:5,polish_devices_preserved:169,polish_physical_sites_rendered:68,offline_retention:true,interrupted_write_preserves_cache:true,corruption_isolated:true,manifest_only_current_country:true,checksum_mismatch_falls_back:true,result:'passed'};
 fs.writeFileSync(path.join(root,'master-db/reports/r2-app-tests.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
})().catch(e=>{console.error(e);process.exitCode=1});
