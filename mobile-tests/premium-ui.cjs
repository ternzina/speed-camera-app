const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('node:assert/strict'),babel=require('@babel/core');
const modules={};
function load(file){file=path.resolve(file);if(modules[file])return modules[file];const m={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(file,'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module:m,exports:m.exports,require:n=>load(path.resolve(path.dirname(file),n+'.js')),Uint8Array,Uint32Array,DataView,Set,Map,Date,AbortController,setTimeout,clearTimeout});return modules[file]=m.exports;}
const ui=load('premium-presentation.js'),transport=load('download-progress.js'),cache=load('camera-data.js');
(async()=>{
 const counts=ui.typeCounts({cameras:[{latitude:50,longitude:30,type:'speed_camera'},{latitude:null,longitude:30},{latitude:0,longitude:0},{latitude:50,longitude:30,type:'speed_and_red_light'},{latitude:50,longitude:30,_example_only:true}],average_speed_sections:[{start:{latitude:50,longitude:30},end:{latitude:51,longitude:31}},{start:{latitude:50,longitude:30},end:null}]});
 assert.equal(counts.speed_camera,1);assert.equal(counts.combined,1);assert.equal(counts.average_speed,1);
 assert.equal(ui.countryMetrics({record_count:900},null).candidates,null);assert.equal(ui.countryMetrics({},null).found,null);
 assert.equal(ui.displaySpeed(100,'imperial'),62);assert.equal(ui.displayDistance(1609.344,'imperial',ui.PREMIUM_COPY.en),'1.0 mi');
 const first=ui.trackStep(null,{latitude:50,longitude:30},1000);assert.equal(first.metres,0);
 assert.equal(ui.trackStep(first.point,{latitude:50.00001,longitude:30},2000).metres,0);
 assert(ui.trackStep(first.point,{latitude:50.0002,longitude:30},2000).metres>20);
 assert.equal(ui.trackStep(first.point,{latitude:51,longitude:30},2000).metres,0);
 assert.equal(ui.trackStep(first.point,{latitude:50.0002,longitude:30},30000).metres,0);
 assert.equal(ui.trackStep(first.point,{latitude:50.0002,longitude:30},2000,100).point,null);
 let req;class XHR {constructor(){req=this;}open(method,url){this.url=url;}setRequestHeader(){}getResponseHeader(){return null;}send(){this.sent=true;}abort(){this.aborted=true;this.onabort?.();}}
 const observed=[];let forwards=0;const fetcher=transport.progressFetch(async()=>{forwards++;return 'manifest'},p=>observed.push(p),'UA',200,XHR);
 assert.equal(await fetcher('https://r2/manifest.json'),'manifest');assert.equal(forwards,1);
 const pending=fetcher('https://r2/countries/UA.json');req.onprogress({loaded:100,lengthComputable:true,total:200});assert.equal(observed.at(-1).loaded,100);assert.equal(observed.at(-1).total,200);
 req.responseText='{"name":"Україна"}';req.status=200;req.onload();const response=await pending;assert.equal(await response.text(),req.responseText);assert.equal(observed.at(-1).loaded,Buffer.byteLength(req.responseText));assert.equal(observed.at(-1).phase,'verify');
 const abort=new AbortController();const stopped=fetcher('https://r2/countries/UA.json',{signal:abort.signal});abort.abort();await assert.rejects(stopped);assert(req.aborted);
 const bad=fetcher('https://r2/countries/UA.json');req.onerror();await assert.rejects(bad);
 const fallback=fetcher('https://supabase/camera-export?country=UA');assert.equal(observed.at(-1).total,null);req.status=503;req.onload();assert.equal((await fallback).ok,false);
 // Removal through the existing cache writer removes old chunks and leaves other countries intact.
 const values=new Map(),storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
 const feed={cameras:[{latitude:50,longitude:30,id:1}]};await cache.saveCameraCache(storage,'premium-cache',{feeds:{UA:feed,PL:feed},countryVersions:{UA:'1',PL:'1'}});
 const old=JSON.parse(values.get('premium-cache')).feedChunks.PL.prefix;
 await cache.saveCameraCache(storage,'premium-cache',{feeds:{UA:feed},countryVersions:{UA:'1'}});
 assert.equal((await cache.loadCameraCache(storage,'premium-cache')).feeds.PL,undefined);assert((await cache.loadCameraCache(storage,'premium-cache')).feeds.UA);assert(![...values.keys()].some(k=>k.startsWith(old)));
 console.log('Premium UI passed: honest metrics, valid type counts, units, GPS jitter/jump/gap rejection, real transport bytes/abort/failure/fallback, local cache removal and country retention.');
})().catch(e=>{console.error(e);process.exit(1);});
