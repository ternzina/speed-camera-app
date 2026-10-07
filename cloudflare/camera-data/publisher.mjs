// Temporary upload-only Worker. Deploy for an authorized export run, delete after verification.
// Ed25519 private key remains local; only its public key is bound here. No unsigned writes.
const allowed=/^production\/v1\/(?:manifest\.json|countries\/[A-Z]{2}\/[a-f0-9]{64}\.json(?:\.gz)?)$/;
const bytes=v=>Uint8Array.from(atob(v),c=>c.charCodeAt(0));
export default {
 async fetch(request,env){
  const key=new URL(request.url).pathname.slice(1);
  if(request.method!=='PUT'||!allowed.test(key))return new Response('Not found',{status:404});
  const time=request.headers.get('X-Publish-Time'),sig=request.headers.get('X-Publish-Signature'),digest=request.headers.get('X-Publish-Digest');
  const size=Number(request.headers.get('Content-Length'));
  if(!time||!sig||!/^[a-f0-9]{64}$/.test(digest||'')||Math.abs(Date.now()/1000-Number(time))>120||!Number.isFinite(Number(time))||!(size>0&&size<=16000000))return new Response('Unauthorized',{status:401});
  const message=new TextEncoder().encode(['PUT',key,time,digest,String(size)].join('\n'));
  try{
   const publicKey=await crypto.subtle.importKey('raw',bytes(env.PUBLISH_PUBLIC_KEY),{name:'Ed25519'},false,['verify']);
   if(!await crypto.subtle.verify('Ed25519',publicKey,bytes(sig),message))return new Response('Unauthorized',{status:401});
  }catch{return new Response('Unauthorized',{status:401});}
  // Strictly bounded authenticated body; public delivery streams without buffering.
  const reader=request.body.getReader();let length=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>size){await reader.cancel();return new Response('Too large',{status:413});}chunks.push(value);}
  if(length!==size)return new Response('Length mismatch',{status:400});
  const body=new Uint8Array(length);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',body)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==digest)return new Response('Checksum mismatch',{status:400});
  let decoded;
  if(key.endsWith('.gz'))decoded=await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();else decoded=body;
  const contentSha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',decoded)),v=>v.toString(16).padStart(2,'0')).join('');
  const immutable=key.match(/\/([a-f0-9]{64})\.json/);
  if(immutable&&immutable[1]!==contentSha)return new Response('Invalid immutable key',{status:400});
  await env.CAMERA_DATA.put(key,body,{httpMetadata:{contentType:'application/json; charset=utf-8',...(key.endsWith('.gz')?{contentEncoding:'gzip'}:{}),cacheControl:immutable?'public, max-age=31536000, immutable':'public, max-age=60'},customMetadata:{sha256:contentSha},sha256:await crypto.subtle.digest('SHA-256',body)});
  return Response.json({key,size:length,sha256:contentSha});
 }
};
