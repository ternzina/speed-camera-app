import { sha256, utf8Bytes } from './sha256';
import { canSaveCountry } from './offline-country-policy';
export const CAMERA_DELIVERY_URL='https://speed-camera-protected.ternzina.workers.dev';
const groups=['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'];
const iso=/^[A-Z]{2}$/;
function countFeed(feed){return groups.reduce((n,k)=>n+(feed[k]?.length||0),0);}
export function validateManifest(manifest){
 if(![1,2].includes(manifest.schema_version)||!Array.isArray(manifest.countries)||manifest.countries.length>250)throw new Error('Unsupported manifest');
 const codes=new Set();let total=0;
 for(const entry of manifest.countries){
  if(!iso.test(entry.country_code)||codes.has(entry.country_code)||!Number.isInteger(entry.record_count)||entry.record_count<0||!Number.isInteger(entry.size_bytes)||entry.size_bytes<=0||entry.size_bytes>16000000||!/^[a-f0-9]{64}$/.test(entry.checksum)||entry.version!==entry.checksum||(manifest.schema_version===1 && entry.path!==`production/v1/countries/${entry.country_code}/${entry.checksum}.json`))throw new Error('Invalid manifest entry');
  codes.add(entry.country_code);total+=entry.record_count;
 }
 if(total!==manifest.total_records)throw new Error('Manifest total mismatch');
 return manifest;
}
export function verifyCountryExport(text,entry){
 if(utf8Bytes(text).length!==entry.size_bytes||sha256(text)!==entry.checksum)throw new Error('Country checksum mismatch');
 const feed=JSON.parse(text);
 if(![1,2].includes(feed.schema_version)||feed.country!==entry.country_code||feed.record_count!==entry.record_count||countFeed(feed)!==entry.record_count)throw new Error('Country count mismatch');
 const ids=new Set();
 const coords=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.latitude>=-90&&p.latitude<=90&&p.longitude>=-180&&p.longitude<=180;
 for(const group of groups){
  if(feed[group]!==undefined&&!Array.isArray(feed[group]))throw new Error('Invalid camera array');
  for(const p of feed[group]||[]){
   if(p.id==null||ids.has(String(p.id)))throw new Error('Duplicate camera ID');ids.add(String(p.id));
   if(group==='average_speed_sections'){if(!coords(p.start)||!coords(p.end))throw new Error('Missing section endpoints');}
   else if(!coords(p))throw new Error('Invalid camera coordinates');
   if(p.speed_limit!=null&&(!Number.isFinite(p.speed_limit)||p.speed_limit<5||p.speed_limit>200))throw new Error('Invalid speed limit');
  }
 }
 if(feed.country==='PL' && feed.schema_version===1){
  if(!Array.isArray(feed.red_light_sites)||feed.red_light_cameras.length!==feed.counts?.red_light_devices_source||feed.red_light_sites.length!==feed.counts?.red_light_cameras||feed.red_light_sites.some(p=>!coords(p)))throw new Error('Invalid Polish physical-site projection');
  return {...feed,red_light_cameras:feed.red_light_sites,red_light_sites:undefined};
 }
 return feed;
}
async function getText(fetcher,url,limit,timeout){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const res=await fetcher(url,{signal:controller.signal,cache:'no-store'});
  if(!res.ok||Number(res.headers?.get('Content-Length'))>limit)throw new Error('Delivery unavailable');
  const text=await res.text();if(text.length>limit||utf8Bytes(text).length>limit)throw new Error('Delivery too large');return text;
 }finally{clearTimeout(timer);}
}
const metadataKeys=['country_code','name_key','record_count','version','checksum','size_bytes','updated_at','geography_level'];
export async function getDeliveryManifest(fetcher=fetch) {
 let manifest;
 try {manifest=validateManifest(JSON.parse(await getText(fetcher,CAMERA_DELIVERY_URL+'/v2/manifest',256000,8000)));}
 catch {manifest=validateManifest(JSON.parse(await getText(fetcher,CAMERA_DELIVERY_URL+'/production/v1/manifest.json',256000,8000)));}
 // Legacy transition supports metadata only. Never follow a public path/url from it.
 return {...manifest,countries:manifest.countries.map(e=>Object.fromEntries(metadataKeys.filter(k=>e[k]!==undefined).map(k=>[k,e[k]])))};
}
async function authorizedText(fetcher,url,options,limit,timeout) {
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
 try {
  const response=await fetcher(url,{...options,signal:controller.signal,cache:'no-store'});
  if(!response.ok){let code='unavailable';try{code=JSON.parse(await response.text()).error||code;}catch{}const error=new Error(code);error.code=code;error.retryAfter=Number(response.headers?.get('Retry-After'))||null;throw error;}
  if(Number(response.headers?.get('Content-Length'))>limit)throw Error('Delivery too large');
  const text=await response.text();if(utf8Bytes(text).length>limit)throw Error('Delivery too large');return text;
 }finally{clearTimeout(timer);}
}
export async function releaseCountry({country,installation,fetcher=fetch}) {
 if(!/^[A-Z]{2}$/.test(country)||!installation)throw Error('Invalid release');
 return authorizedText(fetcher,CAMERA_DELIVERY_URL+'/v2/countries/'+country,{method:'DELETE',headers:{'X-Installation-ID':installation}},2048,8000);
}
export async function refreshCountryDelivery({country,feeds={},versions={},countries=[],fetcher=fetch,installation,metadataOnly=false,offline=false}) {
 const code=String(country).toUpperCase();if(!iso.test(code))throw new Error('Invalid country');
 let manifest,error;
 const fallback=()=>({feed:feeds[code]||null,countries:manifest?.countries||countries,version:versions[code]||null,source:feeds[code]?'offline':'bundled',error:error?.code||error?.message||null,retryAfter:error?.retryAfter||null});
 if(offline)return fallback();
 if(!metadataOnly&&!canSaveCountry(feeds,code)){error={code:'offline_limit'};return fallback();}
 try {
  manifest=await getDeliveryManifest(fetcher);
  if(metadataOnly)return {...fallback(),source:'manifest'};
  const entry=manifest.countries.find(x=>x.country_code===code);if(!entry)throw Error('country_unavailable');
  if(feeds[code]&&versions[code]===entry.version)return {feed:feeds[code],countries:manifest.countries,version:entry.version,source:'cache-current'};
  if(!installation)throw Error('installation_required');
  const grant=JSON.parse(await authorizedText(fetcher,CAMERA_DELIVERY_URL+'/v2/token',{method:'POST',headers:{'Content-Type':'application/json','X-Installation-ID':installation},body:JSON.stringify({country:code})},4096,8000));
  if(grant.country!==code||grant.version!==entry.version||typeof grant.token!=='string')throw Error('Invalid grant');
  // Retry once with the same short-lived grant on an interrupted transfer. Policy errors are never bypassed.
  let text;
  for(let attempt=0;attempt<2;attempt++){
   try{text=await authorizedText(fetcher,CAMERA_DELIVERY_URL+'/v2/download/'+code,{headers:{'Authorization':'Bearer '+grant.token,'X-Installation-ID':installation}},16000000,20000);break;}
   catch(e){if(e.code||attempt)throw e;}
  }
  const feed=verifyCountryExport(text,entry);
  return {feed,countries:manifest.countries,version:entry.version,source:'r2'};
 }catch(e){error=e;return fallback();}
}
