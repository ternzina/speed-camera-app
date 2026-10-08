import { privateHash, signToken, verifyToken } from './authorization.mjs';
import { POLICY } from './security-policy.mjs';
export { DownloadLimiter } from './rate-limiter.mjs';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, HEAD, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Installation-ID','Access-Control-Expose-Headers':'ETag, X-Content-SHA256, Content-Length, Retry-After','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'};
/** @param {unknown} data @param {number} status @param {Record<string,string>} extra */
const reply=(data,status=200,extra={})=>Response.json(data,{status,headers:{...cors,...extra}});
/** @param {import("./protocol").ManifestEntry} e */
const publicEntry=e=>{
 /** @type {Array<keyof import("./protocol").ManifestEntry>} */
 const keys=['country_code','name_key','record_count','version','checksum','size_bytes','updated_at','geography_level'];
 return Object.fromEntries(keys.filter(k=>e[k]!==undefined).map(k=>[k,e[k]]));
};
/** @param {Env} env @returns {Promise<import("./protocol").DeliveryManifest>} */
async function manifest(env) {
 const object=await env.CAMERA_DATA.get('protected/v2/manifest.json');
 if(!object||object.size>256000)throw Error('Manifest unavailable');
 const data=await object.json();
 if(data.schema_version!==2||!Array.isArray(data.countries)||data.countries.length>250)throw Error('Manifest invalid');
 return data;
}
export default {
 /** @param {Request} request @param {Env} env */
 async fetch(request,env) {
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  // All former aliases and immutable country URLs are deliberately inaccessible.
  const publicManifest=path==='/v2/manifest' || path==='/production/v1/manifest.json';
  if(publicManifest) {
   if(!['GET','HEAD'].includes(request.method))return reply({error:'method_not_allowed'},405);
   try {const m=await manifest(env);const data={schema_version:2,generated_at:m.generated_at,total_records:m.total_records,attribution:m.attribution,license_url:m.license_url,countries:m.countries.map(publicEntry)};
    return request.method==='HEAD'?new Response(null,{headers:{...cors,'Cache-Control':'public, max-age=60'}}):reply(data,200,{'Cache-Control':'public, max-age=60'});
   }catch{return reply({error:'unavailable'},503);}
  }
  const match=path.match(/^\/v2\/(download|countries)\/([A-Z]{2})$/);
  const tokenRoute=path==='/v2/token';
  if(!tokenRoute&&!match)return reply({error:'not_found'},404);
  if(tokenRoute&&request.method!=='POST'||match?.[1]==='download'&&request.method!=='GET'||match?.[1]==='countries'&&request.method!=='DELETE')return reply({error:'method_not_allowed'},405);
  const id=request.headers.get('X-Installation-ID');
  if(!ID.test(id||''))return reply({error:'installation_required'},401);
  try {
   const installation=await privateHash(env.DOWNLOAD_SIGNING_SECRET,'installation:'+id);
   const device=env.DOWNLOAD_LIMITER.getByName('device:'+installation);
   /** @param {import("./protocol").PolicyInput} input */
   const check=async input=>{
    const result=await device.check(input);
    if(result.status===429) console.warn(JSON.stringify({event:'download_security',installation:installation.slice(0,12),reason:result.error}));
    return result;
   };
   // Soft temporary shared-IP guard also limits simple installation-ID rotation. Never permanent.
   const ip=request.headers.get('CF-Connecting-IP');
   if(ip){const hash=await privateHash(env.DOWNLOAD_SIGNING_SECRET,'ip:'+ip);const result=await env.DOWNLOAD_LIMITER.getByName('ip:'+hash).check({action:'ip',installation});if(result.status!==200){console.warn(JSON.stringify({event:'download_security',network:hash.slice(0,12),reason:result.error}));return reply({error:result.error},result.status,{'Retry-After':String(result.retryAfter)});}}
   /** @param {string} error @param {number} status */
   const failure=async(error,status=401)=>{const r=await check({action:'invalid',error,status});return reply({error:r.error},r.status,r.retryAfter?{'Retry-After':String(r.retryAfter)}:{});};
   if(match?.[1]==='countries') {const r=await check({action:'release',country:match[2]});return reply({error:r.error,removed:r.status===200},r.status,r.retryAfter?{'Retry-After':String(r.retryAfter)}:{});}
   if(tokenRoute) {
    if(Number(request.headers.get('Content-Length'))>1024)return failure('invalid_request',400);
    const reader=request.body?.getReader();if(!reader)return failure('invalid_request',400);
    const chunks=[];let size=0;
    while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>1024){await reader.cancel();return failure('invalid_request',400);}chunks.push(x.value);}
    const raw=new Uint8Array(size);let offset=0;for(const c of chunks){raw.set(c,offset);offset+=c.length;}
    let body;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{return failure('invalid_request',400);}
    if(!/^[A-Z]{2}$/.test(body.country||''))return failure('invalid_country',400);
    const m=await manifest(env),entry=m.countries.find(e=>e.country_code===body.country);
    if(!entry)return failure('country_unavailable',404);
    const now=Math.floor(Date.now()/1000),jti=crypto.randomUUID(),exp=now+POLICY.tokenTTL;
    const r=await check({action:'token',country:body.country,jti,exp,generation:crypto.randomUUID()});
    if(r.status!==200)return reply({error:r.error,countries:r.countries},r.status,r.retryAfter?{'Retry-After':String(r.retryAfter)}:{});
    const token=await signToken(env.DOWNLOAD_SIGNING_SECRET,{v:2,country:body.country,installation,version:entry.version,iat:now,exp,jti,generation:r.generation});
    return reply({token,expires_at:exp,country:body.country,version:entry.version});
   }
   const country=match[2];let claims;
   try{claims=await verifyToken(env.DOWNLOAD_SIGNING_SECRET,(request.headers.get('Authorization')||'').replace(/^Bearer /,''),country,installation);}catch{return failure('invalid_token');}
   const r=await check({action:'consume',country,jti:claims.jti});
   if(r.status!==200)return reply({error:r.error},r.status,r.retryAfter?{'Retry-After':String(r.retryAfter)}:{});
   const object=await env.CAMERA_DATA.get(`protected/v2/countries/${country}/${claims.version}.json`);
   if(!object||object.size>16000000)return reply({error:'unavailable'},503);
   // Never CDN-cache an authorized response; no origin path / bucket key in the response.
   return new Response(object.body,{headers:{...cors,'Content-Type':'application/json; charset=utf-8','Content-Length':String(object.size),'X-Content-SHA256':claims.version,ETag:'"'+claims.version+'"'}});
  }catch{return reply({error:'unavailable'},503);}
 }
};
