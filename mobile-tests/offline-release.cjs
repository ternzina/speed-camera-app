const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),fetch,AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Date,console});return module.exports;}
const delivery=plain('camera-delivery.js'),cache=plain('camera-data.js');
const offline=async()=>{throw Error('offline')};
const response=text=>({ok:true,headers:{get:()=>null},text:async()=>text});
(async()=>{
 const manifest=delivery.validateManifest(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json')).json());
 assert.equal(manifest.countries.length,49);
 const values=new Map();let fail=false;
 const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{if(fail)throw Error('disk full');assert.ok(Buffer.byteLength(v)<1000000);values.set(k,v)},removeItem:async k=>values.delete(k)};
 const feeds={},versions={},results=[];
 for(const code of ['UA','PL','DE','FR','US','CA']){
  const result=await delivery.refreshCountryDelivery({country:code});assert.equal(result.source,'r2');
  feeds[code]=result.feed;versions[code]=result.version;
  await cache.saveCameraCache(storage,'cache',{feeds,countries:manifest.countries,countryVersions:versions,stamp:'verified'});
  results.push({country:code,records:manifest.countries.find(x=>x.country_code===code).record_count,source:result.source});
 }
 let saved=await cache.loadCameraCache(storage,'cache');assert.equal(Object.keys(saved.feeds).length,6);assert.equal(saved.countries.length,49);
 for(const code of Object.keys(feeds)){
  const result=await delivery.refreshCountryDelivery({country:code,feeds:saved.feeds,versions:saved.countryVersions,countries:saved.countries,fetcher:offline});assert.equal(result.source,'offline');assert.deepEqual(result.feed,saved.feeds[code]);
  let calls=0;const current=await delivery.refreshCountryDelivery({country:code,feeds:saved.feeds,versions:saved.countryVersions,fetcher:async()=>{calls++;return response(JSON.stringify(manifest));}});assert.equal(current.source,'cache-current');assert.equal(calls,1);
 }
 const entry=manifest.countries.find(x=>x.country_code==='DE');
 const text=await (await fetch(delivery.CAMERA_DELIVERY_URL+'/'+entry.path)).text();
 const changed=await delivery.refreshCountryDelivery({country:'DE',feeds:saved.feeds,versions:{DE:'old-version'},fetcher:async url=>response(url.includes('manifest')?JSON.stringify(manifest):text)});assert.equal(changed.source,'r2');assert.equal(changed.version,entry.version);
 for(const code of Object.keys(feeds)){
  const fallbackLive=await delivery.refreshCountryDelivery({country:code,fetcher:async(url,options)=>{if(url.startsWith(delivery.CAMERA_DELIVERY_URL))throw Error('R2 outage');return fetch(url,options);}});assert.equal(fallbackLive.source,'supabase',code+' live Supabase fallback');
 }
 const invalid=await delivery.refreshCountryDelivery({country:'DE',feeds:saved.feeds,fetcher:async url=>{if(url.includes('supabase'))return response(JSON.stringify({...feeds.DE,country:'FR'}));throw Error('R2 outage');}});assert.equal(invalid.source,'offline');

 assert.throws(()=>delivery.verifyCountryExport(text+' ',entry));
 const fallback=await delivery.refreshCountryDelivery({country:'DE',fetcher:async url=>url.includes('manifest')?response(JSON.stringify(manifest)):url.includes('supabase')?response(JSON.stringify(feeds.DE)):response(text+' ')});assert.equal(fallback.source,'supabase');assert.equal(fallback.version,null);
 const local=await delivery.refreshCountryDelivery({country:'DE',feeds:saved.feeds,fetcher:async url=>{if(url.includes('manifest'))return response(JSON.stringify(manifest));throw Error('unavailable');}});assert.equal(local.source,'offline');assert.equal(local.countries.length,49);
 const bundled=await delivery.refreshCountryDelivery({country:'UA',fetcher:offline});assert.equal(bundled.source,'bundled');assert.ok(cache.cameraPoints(cache.countryFeed({},'UA',require('../cameras.json'),require('../cameras-pl.json'))).length);
 const pointer=values.get('cache');fail=true;await assert.rejects(cache.saveCameraCache(storage,'cache',{feeds:{DE:feeds.DE},countries:[]}));assert.equal(values.get('cache'),pointer);fail=false;
 const index=JSON.parse(pointer);values.set(index.feedChunks.DE.prefix+':0','corrupt');saved=await cache.loadCameraCache(storage,'cache');assert.equal(saved.feeds.DE,undefined);assert.equal(saved.countryVersions.DE,undefined);assert.ok(saved.feeds.FR);
 console.log(JSON.stringify({checkedAt:new Date().toISOString(),manifestCountries:49,results,offlineRestart:true,manifestOnlyUpdateCheck:true,checksumRejection:true,supabaseFallback:true,localFallback:true,bundledFallback:true,failedWritePreservesCache:true,corruptionIsolated:true},null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
