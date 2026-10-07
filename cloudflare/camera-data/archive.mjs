// Private archive gateway. Ed25519 authentication required for every read/write.
// Private archive reads/writes and signed public snapshot PUTs; no bucket listing.
const allowed=/^archive\/v1\/(?:objects\/[a-f0-9]{64}\.jsonl\.gz|files\/[a-f0-9]{64}\.bin\.gz|manifests\/[a-f0-9]{64}\.json)$/;
const from64=v=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
const hex=v=>Array.from(new Uint8Array(v),b=>b.toString(16).padStart(2,'0')).join('');
export default {
 async fetch(request,env){
  const key=new URL(request.url).pathname.slice(1),method=request.method;
  const publicWrite=method==='PUT'&&/^production\/v1\/(?:manifest\.json|countries\/[A-Z]{2}\/[a-f0-9]{64}\.json)$/.test(key),mutableManifest=publicWrite&&key==='production/v1/manifest.json';
  if(!(allowed.test(key)||publicWrite)||!['GET','HEAD','PUT'].includes(method))return new Response('Not found',{status:404});
  const time=request.headers.get('X-Publish-Time'),sig=request.headers.get('X-Publish-Signature'),digest=request.headers.get('X-Publish-Digest'),size=method==='PUT'?Number(request.headers.get('Content-Length')):0;
  if(!time||!sig||!/^[a-f0-9]{64}$/.test(digest||'')||!Number.isFinite(Number(time))||Math.abs(Date.now()/1000-Number(time))>120||!Number.isInteger(size)||size<0||size>16000000||method==='PUT'&&size===0)return new Response('Unauthorized',{status:401});
  const message=new TextEncoder().encode([method,key,time,digest,String(size)].join('\n'));
  try{const pub=await crypto.subtle.importKey('raw',from64(env.PUBLISH_PUBLIC_KEY),'Ed25519',false,['verify']);if(!await crypto.subtle.verify('Ed25519',pub,from64(sig),message))return new Response('Unauthorized',{status:401});}catch{return new Response('Unauthorized',{status:401});}
  if(method!=='PUT'){
   const obj=method==='HEAD'?await env.CAMERA_DATA.head(key):await env.CAMERA_DATA.get(key);
   if(!obj)return new Response('Not found',{status:404});
   return new Response(method==='HEAD'?null:obj.body,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(obj.size),'Cache-Control':'private, no-store','X-Object-SHA256':obj.customMetadata?.sha256||'','X-Content-Type-Options':'nosniff'},encodeBody:'manual'});
  }
  if(!mutableManifest&&key.match(/\/([a-f0-9]{64})\./)[1]!==digest)return new Response('Invalid immutable key',{status:400});
  const prior=await env.CAMERA_DATA.head(key);
  if(prior&&!mutableManifest){if(prior.size!==size||prior.customMetadata?.sha256!==digest)return new Response('Immutable conflict',{status:409});return Response.json({key,sha256:digest,size,existing:true});}
  if(!request.body)return new Response('Missing body',{status:400});
  // Preserve the HTTP body's known length and let R2 verify SHA-256 before commit.
  // Buffering and hashing multi-MB payloads here exhausts the Worker's CPU budget.
  const expected=Uint8Array.from(digest.match(/../g),v=>parseInt(v,16));
  const stored=await env.CAMERA_DATA.put(key,request.body,{...(mutableManifest?{}:{onlyIf:{etagDoesNotMatch:'*'}}),httpMetadata:{contentType:publicWrite?'application/json':'application/octet-stream',cacheControl:publicWrite?(mutableManifest?'public, max-age=60':'public, max-age=31536000, immutable'):'private, no-store'},customMetadata:{sha256:digest},sha256:expected.buffer});
  if(!stored){
   const raced=await env.CAMERA_DATA.head(key);
   if(raced?.size===size&&raced.customMetadata?.sha256===digest)return Response.json({key,sha256:digest,size,existing:true});
   return new Response('Immutable conflict',{status:409});
  }
  if(stored.size!==size||hex(stored.checksums.sha256)!==digest)throw new Error('R2 integrity assertion failed');
  return Response.json({key,sha256:digest,size});
 }
};
