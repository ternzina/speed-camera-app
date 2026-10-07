import { sha256, utf8Bytes } from './sha256';
export const CAMERA_DELIVERY_URL='https://speed-camera-data.ternzina.workers.dev';
export const SUPABASE_EXPORT_URL='https://ydgzsdlwnurychkbgsmn.supabase.co/functions/v1/camera-export';
const groups=['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'];
const iso=/^[A-Z]{2}$/;
function countFeed(feed){return groups.reduce((n,k)=>n+(feed[k]?.length||0),0);}
export function validateManifest(manifest){
 if(manifest.schema_version!==1||!Array.isArray(manifest.countries)||manifest.countries.length>250)throw new Error('Unsupported manifest');
 const codes=new Set();let total=0;
 for(const entry of manifest.countries){
  if(!iso.test(entry.country_code)||codes.has(entry.country_code)||!Number.isInteger(entry.record_count)||entry.record_count<0||!Number.isInteger(entry.size_bytes)||entry.size_bytes<=0||entry.size_bytes>16000000||!/^[a-f0-9]{64}$/.test(entry.checksum)||entry.version!==entry.checksum||entry.path!==`production/v1/countries/${entry.country_code}/${entry.checksum}.json`)throw new Error('Invalid manifest entry');
  codes.add(entry.country_code);total+=entry.record_count;
 }
 if(total!==manifest.total_records)throw new Error('Manifest total mismatch');
 return manifest;
}
export function verifyCountryExport(text,entry){
 if(utf8Bytes(text).length!==entry.size_bytes||sha256(text)!==entry.checksum)throw new Error('Country checksum mismatch');
 const feed=JSON.parse(text);
 if(feed.schema_version!==1||feed.country!==entry.country_code||feed.record_count!==entry.record_count||countFeed(feed)!==entry.record_count)throw new Error('Country count mismatch');
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
 if(feed.country==='PL'){
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
export async function refreshCountryDelivery({country,feeds={},versions={},countries=[],fetcher=fetch}){
 const code=String(country).toUpperCase();if(!iso.test(code))throw new Error('Invalid country');
 let manifest;
 try{
  manifest=validateManifest(JSON.parse(await getText(fetcher,CAMERA_DELIVERY_URL+'/production/v1/manifest.json',256000,8000)));
  const entry=manifest.countries.find(x=>x.country_code===code);if(!entry)throw new Error('Country absent');
  if(feeds[code]&&versions[code]===entry.version)return {feed:feeds[code],countries:manifest.countries,version:entry.version,source:'cache-current'};
  const feed=verifyCountryExport(await getText(fetcher,CAMERA_DELIVERY_URL+'/'+entry.path,16000000,20000),entry);
  return {feed,countries:manifest.countries,version:entry.version,source:'r2'};
 }catch{
  try{
   const feed=JSON.parse(await getText(fetcher,SUPABASE_EXPORT_URL+'?country='+code,64000000,20000));
   if(!groups.some(k=>Array.isArray(feed[k])))throw new Error('Invalid fallback feed');
   let fallbackCountries=manifest?.countries||countries;
   if(!manifest){
    try{const coverage=JSON.parse(await getText(fetcher,SUPABASE_EXPORT_URL+'?country=coverage',256000,8000));if(Array.isArray(coverage.countries))fallbackCountries=coverage.countries.filter(entry=>iso.test(entry.country_code));}catch{}
   }
   return {feed,countries:fallbackCountries,version:null,source:'supabase'};
  }catch{
   if(feeds[code])return {feed:feeds[code],countries,version:versions[code]||null,source:'offline'};
   return {feed:null,countries,version:null,source:'bundled'};
  }
 }
}
