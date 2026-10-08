import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { POLICY, applyPolicy } from '../security-policy.mjs';
import { signToken, privateHash } from '../authorization.mjs';
const root=path.resolve(import.meta.dirname,'../../..');
const objects=path.join(root,'build/protected-delivery/objects');
const manifest=JSON.parse(await fs.readFile(path.join(objects,'protected/v2/manifest.json'),'utf8'));
const secret=crypto.randomBytes(32).toString('hex'); // Ephemeral local test secret, never used in production.
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"camalert-test",modules:true,script:await fs.readFile(path.join(root,'build/protected-worker/worker.js'),'utf8'),compatibilityDate:'2026-10-08',compatibilityFlags:['nodejs_compat'],r2Buckets:['CAMERA_DATA'],durableObjects:{DOWNLOAD_LIMITER:{className:'DownloadLimiter',useSQLite:true}},bindings:{DOWNLOAD_SIGNING_SECRET:secret}}]}));
let checks=0;const ok=(value,message)=>{assert(value,message);checks++;};
try {
 const bucket=await mf.getR2Bucket('CAMERA_DATA');
 await bucket.put('protected/v2/manifest.json',JSON.stringify({...manifest,countries:manifest.countries.map(e=>({...e,path:'DO_NOT_EXPOSE',url:'DO_NOT_EXPOSE',provenance:'DO_NOT_EXPOSE'}))}));
 for(const code of ['UA','PL','DE','FR','US','CA']){
  const e=manifest.countries.find(x=>x.country_code===code),key=`protected/v2/countries/${code}/${e.version}.json`;
  await bucket.put(key,await fs.readFile(path.join(objects,key)));
 }
 const request=(id,endpoint,options={})=>mf.dispatchFetch('https://delivery.test'+endpoint,{...options,headers:{'X-Installation-ID':id,...options.headers}});
 const grant=async(id,country,headers={})=>{
  const r=await request(id,'/v2/token',{method:'POST',body:JSON.stringify({country}),headers:{'Content-Type':'application/json',...headers}});
  return {status:r.status,body:await r.json(),headers:r.headers};
 };
 const download=(id,code,token)=>request(id,'/v2/download/'+code,{headers:{Authorization:'Bearer '+token}});
 const release=(id,code)=>request(id,'/v2/countries/'+code,{method:'DELETE'});
 let r=await request('', '/v2/manifest');const pub=await r.json();ok(r.status===200,'manifest public');
 ok(pub.countries.length===manifest.countries.length,'all metadata retained');
 ok(!JSON.stringify(pub).includes('DO_NOT_EXPOSE'),'no origin paths, URLs or provenance');
 for(const endpoint of ['/production/v1/countries/UA.json','/production/v1/countries/UA/'+manifest.countries[0].version+'.json','/countries/UA.json','/protected/v2/manifest.json','/private/secret'])ok((await request('',endpoint)).status===404,'old/direct route denied');
 ok((await grant('', 'UA')).status===401,'installation required');
 ok((await grant('wrong', 'UA')).status===401,'invalid installation rejected');
 const id=crypto.randomUUID();let a=await grant(id,'UA');ok(a.status===200,'first country');
 r=await download(id,'UA',a.body.token);ok(r.status===200,'authorized download');
 ok(r.headers.get('Cache-Control')==='no-store','no CDN/browser authorized caching');
 const feed=await r.json();ok(feed.country==='UA','correct dataset');
 let b=await grant(id,'PL');ok(b.status===200,'second country');
 ok((await grant(id,'DE')).status===409,'third country denied server-side');
 ok((await grant(id,'PL')).status===200,'update existing country allowed');
 ok((await release(id,'UA')).status===200,'release first slot');
 ok((await download(id,'UA',a.body.token)).status===401,'release invalidates outstanding token');
 ok((await grant(id,'DE')).status===200,'third after deletion');
 const retryId=crypto.randomUUID(),retry=await grant(retryId,'FR');
 const concurrent=await Promise.all(Array.from({length:5},()=>download(retryId,'FR',retry.body.token)));
 ok(concurrent.filter(x=>x.status===200).length===3,'exactly three bounded attempts, atomic under concurrency');
 ok(concurrent.filter(x=>x.status===401).length===2,'replay beyond retry budget denied');
 const wrongId=crypto.randomUUID(),valid=await grant(wrongId,'DE');
 ok((await download(wrongId,'FR',valid.body.token)).status===401,'country change denied');
 ok((await download(crypto.randomUUID(),'DE',valid.body.token)).status===401,'installation change denied');
 ok((await download(wrongId,'DE',valid.body.token.slice(0,-1)+'!')).status===401,'tampered signature denied');
 const expiredId=crypto.randomUUID(),entry=manifest.countries.find(x=>x.country_code==='DE');
 const now=Math.floor(Date.now()/1000),expired=await signToken(secret,{v:2,country:'DE',installation:await privateHash(secret,'installation:'+expiredId),version:entry.version,iat:now-301,exp:now-1,jti:crypto.randomUUID(),generation:crypto.randomUUID()});
 ok((await download(expiredId,'DE',expired)).status===401,'expired token denied');
 const dailyId=crypto.randomUUID();
 for(const country of ['UA','PL','DE','FR']){ok((await grant(dailyId,country)).status===200,'daily allocation');ok((await release(dailyId,country)).status===200,'daily release');}
 r=(await grant(dailyId,'US'));ok(r.status===429 && r.body.error==='daily_country_limit','fifth new country per rolling day denied');
 ok((await grant(dailyId,'UA')).status===200,'retry/re-download of same country allowed after daily cap');
 ok((await grant(dailyId,'UA')).status===200,'update at daily cap allowed');
 const enumerationId=crypto.randomUUID();
 for(let i=0;i<8;i++)r=await grant(enumerationId,'ZZ');
 ok(r.status===429,'country enumeration triggers temporary block');
 ok((await grant(enumerationId,'UA')).status===429,'blocked installation cannot obtain valid grant');
 const badId=crypto.randomUUID();for(let i=0;i<8;i++)r=await download(badId,'UA','bad-token');
 ok(r.status===429,'failed token attempts temporarily block');
 const fastId=crypto.randomUUID();for(let i=0;i<31;i++)r=await grant(fastId,'UA');
 ok(r.status===429 && r.headers.get('Retry-After'),'high request frequency throttled');
 for(let i=0;i<31;i++)r=await grant(crypto.randomUUID(),'UA',{'CF-Connecting-IP':'192.0.2.7'});
 ok(r.status===429,'installation rotation on shared IP detected');
 const state={};let time=100000000;
 for(let i=0;i<4;i++){ok(applyPolicy(state,{action:'token',country:['UA','PL','DE','FR'][i],jti:String(i),generation:'g',exp:time/1000+300},time).status===200,'pure daily allocation');applyPolicy(state,{action:'release',country:['UA','PL','DE','FR'][i]},time);}
 ok(applyPolicy(state,{action:'token',country:'US',jti:'new',generation:'g',exp:time/1000+300},time).status===429,'rolling cap independent of release');
 time+=86400001;ok(applyPolicy(state,{action:'token',country:'US',jti:'nextday',generation:'g',exp:time/1000+300},time).status===200,'next rolling day resets distinct-country cap');
 for(const e of manifest.countries){
  const text=await fs.readFile(path.join(objects,`protected/v2/countries/${e.country_code}/${e.version}.json`),'utf8');
  const data=JSON.parse(text);ok(crypto.createHash('sha256').update(text).digest('hex')===e.checksum,'protected checksum');
  ok(!/"(?:provenance|source_ids|raw_source_id|source_codes|confidence|metadata|moderation_notes|source_registry|canard_device_ids)"\s*:/.test(text),'minimal export only');
  for(const group of ['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'])for(const p of data[group]||[])if(p.start)ok(Object.keys(p.start).every(k=>['latitude','longitude'].includes(k)),'nested endpoints projected');
 }
 // Actual mobile delivery module -> compiled Worker -> private R2 -> verified device cache.
 const require=createRequire(path.join(root,'package.json')),babel=require('@babel/core'),modules={};
 function load(file){if(modules[file])return modules[file];const module={exports:{}};const text=require('node:fs').readFileSync(path.join(root,file),'utf8');vm.runInNewContext(babel.transformSync(text,{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:n=>load(n.replace(/^\.\//,'')+'.js'),AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Date,WeakMap});return modules[file]=module.exports;}
 const delivery=load('camera-delivery.js'),cache=load('camera-data.js'),mobilePolicy=load('offline-country-policy.js');
 const values=new Map(),storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>values.set(k,v),removeItem:async k=>values.delete(k)};
 let generated=0;const identity=()=>{generated++;return crypto.randomUUID();};
 const ids=await Promise.all([mobilePolicy.installationId(storage,identity),mobilePolicy.installationId(storage,identity)]);
 ok(ids[0]===ids[1]&&generated===1,'installation identity race-safe, secure and stable');
 ok(await mobilePolicy.installationId({...storage},identity)===ids[0]&&generated===1,'installation survives storage restart');
 const clientId=ids[0],calls=[];
 const fetcher=(url,options={})=>{calls.push(new URL(url).pathname);return mf.dispatchFetch('https://delivery.test'+new URL(url).pathname,options);};
 let feeds={},versions={};
 for(const code of ['UA','PL']){const result=await delivery.refreshCountryDelivery({country:code,installation:clientId,feeds,versions,fetcher});ok(result.source==='r2','mobile authorized download '+code);feeds[code]=result.feed;versions[code]=result.version;await cache.saveCameraCache(storage,'cache',{feeds,countries:result.countries,countryVersions:versions});}
 const before=calls.length,third=await delivery.refreshCountryDelivery({country:'DE',installation:clientId,feeds,versions,fetcher});
 ok(third.error==='offline_limit'&&calls.length===before,'mobile third-country rejection makes zero requests');
 const current=await delivery.refreshCountryDelivery({country:'PL',installation:clientId,feeds,versions,fetcher});ok(current.source==='cache-current','current country checks manifest only');
 const update=await delivery.refreshCountryDelivery({country:'PL',installation:clientId,feeds,versions:{...versions,PL:'old'},fetcher});ok(update.source==='r2','update retained country bypasses new-country cap');
 await delivery.releaseCountry({country:'UA',installation:clientId,fetcher});delete feeds.UA;delete versions.UA;
 await cache.saveCameraCache(storage,'cache',{feeds,countries:manifest.countries,countryVersions:versions,pendingReleases:['UA']});
 ok((await cache.loadCameraCache(storage,'cache')).pendingReleases[0]==='UA','pending releases persisted atomically with cache deletion');
 const next=await delivery.refreshCountryDelivery({country:'DE',installation:clientId,feeds,versions,fetcher});ok(next.source==='r2','replacement download succeeds');feeds.DE=next.feed;versions.DE=next.version;
 await cache.saveCameraCache(storage,'cache',{feeds,countries:manifest.countries,countryVersions:versions,pendingReleases:[]});
 const restarted=await cache.loadCameraCache({...storage},'cache');ok(Object.keys(restarted.feeds).length===2,'exactly two countries on disk after replacement');
 let forbidden=0;const noNetwork=()=>{forbidden++;throw Error('offline');};
 const offline=await delivery.refreshCountryDelivery({country:'DE',feeds:restarted.feeds,versions:restarted.countryVersions,offline:true,fetcher:noNetwork});ok(offline.source==='offline'&&forbidden===0,'offline launch uses verified cache with zero requests');
 const outage=await delivery.refreshCountryDelivery({country:'DE',feeds:restarted.feeds,versions:restarted.countryVersions,fetcher:noNetwork});ok(outage.source==='offline','Worker outage retains cache');
 const bundled=await delivery.refreshCountryDelivery({country:'UA',fetcher:noNetwork});ok(bundled.source==='bundled'&&bundled.feed===null,'Worker unavailable -> bundled fallback');
 const engine=load('driver-engine.js'),countryFeed=cache.countryFeed({},'UA',require(path.join(root,'cameras.json')),require(path.join(root,'cameras-pl.json')));ok(engine.drivingPoints(countryFeed).length>0,'bundled UA engine dataset remains usable');
 const pointer=JSON.parse(values.get('cache'));values.set(pointer.feedChunks.DE.prefix+':0','corrupt');const damaged=await cache.loadCameraCache(storage,'cache');ok(!damaged.feeds.DE&&damaged.feeds.PL,'corruption isolated to one country');
 const repair=await delivery.refreshCountryDelivery({country:'DE',installation:clientId,feeds:damaged.feeds,versions:damaged.countryVersions,fetcher});ok(repair.source==='r2','corrupt dataset can be re-downloaded');
 let metadataFiles=0;await delivery.refreshCountryDelivery({country:'US',metadataOnly:true,fetcher:(url,options)=>{if(!new URL(url).pathname.includes('manifest'))metadataFiles++;return fetcher(url,options);}});ok(metadataFiles===0,'country selection checks metadata without downloading datasets');
 ok(calls.every(p=>!p.includes('/production/v1/countries/')&&!p.includes('supabase')),'no public R2 path or Supabase bypass');
 // Compatibility proxy has no database access and delegates token checks to the Worker.
 const edgeModule={exports:{}},edgeCode=babel.transformSync(require('node:fs').readFileSync(path.join(root,'supabase/functions/camera-export/index.ts'),'utf8'),{configFile:false,babelrc:false,plugins:[['@babel/plugin-transform-typescript',{allowDeclareFields:true}],'@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(edgeCode,{module:edgeModule,exports:edgeModule.exports,require:()=>({}),Deno:{serve:()=>{}},Request,Response,Headers,URL,AbortSignal,fetch});
 ok((await edgeModule.exports.cameraExport(new Request('https://supabase.test/?country=UA'))).status===401,'Supabase export without token denied');
 const proxied=await edgeModule.exports.cameraExport(new Request('https://supabase.test/?country=DE',{headers:{Authorization:'Bearer '+valid.body.token,'X-Installation-ID':wrongId}}),(url,options)=>fetcher(url,options));ok(proxied.status===200,'authorized compatibility proxy uses same Worker gate');
 ok((await edgeModule.exports.cameraExport(new Request('https://supabase.test/?country=FR',{headers:{Authorization:'Bearer '+valid.body.token,'X-Installation-ID':wrongId}}),(url,options)=>fetcher(url,options))).status===401,'Supabase proxy cannot change signed country');
 const report={checkedAt:new Date().toISOString(),result:'passed',checks,realWorkerRuntime:true,stronglyConsistentSQLiteDO:true,projectedCountries:manifest.countries.length,tokenTTL:POLICY.tokenTTL,tokenRetryUses:POLICY.tokenUses,productionChanged:false};
 await fs.mkdir(path.join(root,'build/offline-security'),{recursive:true});await fs.writeFile(path.join(root,'build/offline-security/worker-results.json'),JSON.stringify(report,null,2));console.log(report);
}finally{await mf.dispose();}
