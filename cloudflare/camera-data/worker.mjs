// Read-only public delivery. No database credential, upload or bucket-list route.
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, HEAD, OPTIONS","Access-Control-Expose-Headers":"ETag, X-Content-SHA256, Content-Length","X-Content-Type-Options":"nosniff"};
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url),path=url.pathname;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:{...cors,Allow:'GET, HEAD, OPTIONS'}});
  let key=path.slice(1),alias=false;
  if(/^production\/v1\/countries\/[A-Z]{2}\.json$/.test(key)){
   const m=await env.CAMERA_DATA.get('production/v1/manifest.json');
   if(!m)return new Response('Unavailable',{status:503,headers:cors});
   const code=key.slice(-7,-5),entry=(await m.json()).countries.find(x=>x.country_code===code);
   if(!entry)return new Response('Not found',{status:404,headers:cors});
   key=entry.path;alias=true;
  }
  const isManifest=key==='production/v1/manifest.json';
  if(!isManifest&&!/^production\/v1\/countries\/[A-Z]{2}\/[a-f0-9]{64}\.json$/.test(key))return new Response('Not found',{status:404,headers:cors});
  const cacheKey=new Request(url.origin+'/'+key+'?variant=3');
  let response=!isManifest&& !alias?await caches.default.match(cacheKey):null;
  if(!response){
   const object=await env.CAMERA_DATA.get(key);
   if(!object)return new Response('Not found',{status:404,headers:cors});
   const headers=new Headers(cors);object.writeHttpMetadata(headers);
   headers.set('Content-Type','application/json; charset=utf-8');headers.set('Vary','Accept-Encoding');
   headers.set('ETag',object.httpEtag);headers.set('Cache-Control',isManifest||alias?'public, max-age=60':'public, max-age=31536000, immutable');
   const digest=object.customMetadata?.sha256;
   if(digest)headers.set('X-Content-SHA256',digest);
   headers.set('Content-Length',String(object.size));
   response=new Response(object.body,{headers});
   if(!isManifest&&!alias)ctx.waitUntil(caches.default.put(cacheKey,response.clone()));
  }
  if((request.headers.get('If-None-Match')||'').split(',').some(tag=>tag.trim()==='*'||tag.trim().replace(/^W\//,'')===(response.headers.get('ETag')||'').replace(/^W\//,'')))return new Response(null,{status:304,headers:response.headers});
  if(request.method==='HEAD')return new Response(null,{headers:response.headers});
  return new Response(response.body,{status:response.status,headers:response.headers});
 }
};
