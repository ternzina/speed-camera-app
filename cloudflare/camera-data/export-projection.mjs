// Read-only presentation projection. Master records, collection and source registry are untouched.
const fields=['id','type','camera_type','latitude','longitude','speed_limit','direction','direction_code','location','road','road_index','region','name'];
/** @type {import("./protocol").Group[]} */
export const GROUPS=['cameras','speed_cameras','red_light_cameras','checkpoints','average_speed_sections'];
/** @param {import("./protocol").Coordinates} p */
const endpoint=p=>p ? {latitude:p.latitude,longitude:p.longitude} : null;
/** @param {import("./protocol").CameraFeed} feed @param {string} code @param {string} updatedAt */
export function minimalCountry(feed,code,updatedAt) {
 /** @type {import("./protocol").MinimalFeed} */
 const out={schema_version:2,country:code,updated_at:updatedAt,record_count:0,counts:{}};
 for(const group of GROUPS){
  const source=group==='red_light_cameras'&&feed.red_light_sites ? feed.red_light_sites : feed[group];
  if(!Array.isArray(source))continue;
  out[group]=source.filter(p=>!p._example_only).map(p=>{
   const point=Object.fromEntries(fields.filter(f=>p[f]!=null&&p[f]!=='').map(f=>[f,p[f]]));
   if(group==='average_speed_sections'){point.start=endpoint(p.start);point.end=endpoint(p.end);}
   return point;
  });
 }
 out.record_count=GROUPS.reduce((n,k)=>n+(out[k]?.length||0),0);
 out.counts=Object.fromEntries(GROUPS.filter(g=>out[g]).map(g=>[g,out[g].length]));
 return out;
}
