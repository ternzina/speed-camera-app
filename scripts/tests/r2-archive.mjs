import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash,webcrypto} from 'node:crypto';
import worker from '../../cloudflare/camera-data/archive.mjs';
if(!globalThis.crypto)Object.defineProperty(globalThis,"crypto",{value:webcrypto});
const pair=generateKeyPairSync('ed25519'),objects=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
const bucket={head:async key=>objects.get(key)||null,put:async(key,body,options)=>{
 assert(body instanceof ReadableStream,'Upload must stream directly to R2');
 if(options.onlyIf&&objects.has(key))return null;
 const bytes=Buffer.from(await new Response(body).arrayBuffer());
 assert.equal(hash(bytes),Buffer.from(options.sha256).toString('hex'),'Native R2 checksum validation');
 const object={size:bytes.length,customMetadata:options.customMetadata,checksums:{sha256:options.sha256}};
 objects.set(key,object);return object;
}};
const env={CAMERA_DATA:bucket,PUBLISH_PUBLIC_KEY:Buffer.from(pair.publicKey.export({format:'jwk'}).x,'base64url').toString('base64')};
function request(key,body,digest=hash(body),age=0){const time=String(Math.floor(Date.now()/1000)-age),size=body.length,signature=sign(null,Buffer.from(['PUT',key,time,digest,String(size)].join('\n')),pair.privateKey).toString('base64');return new Request('https://archive/'+key,{method:'PUT',body,headers:{'Content-Length':String(size),'X-Publish-Time':time,'X-Publish-Digest':digest,'X-Publish-Signature':signature}});}
const body=Buffer.alloc(8000000,31),digest=hash(body),key=`archive/v1/files/${digest}.bin.gz`;
assert.equal((await worker.fetch(new Request('https://archive/'+key,{method:'PUT',body:'x'}),env)).status,401);
assert.equal((await worker.fetch(request(key,body,digest,180),env)).status,401);
assert.equal((await worker.fetch(request(key,body),env)).status,200);
assert.equal((await worker.fetch(request(key,body),env)).status,200);
const wrong=hash(Buffer.from('different')),wrongKey=`archive/v1/files/${wrong}.bin.gz`;
await assert.rejects(worker.fetch(request(wrongKey,body,wrong),env),/checksum/);assert(!objects.has(wrongKey));
const manifest='production/v1/manifest.json';await worker.fetch(request(manifest,Buffer.from('{}')),env);
await assert.rejects(worker.fetch(request(manifest,body,wrong),env),/checksum/);assert.equal(objects.get(manifest).size,2);
const originalHead=bucket.head;let calls=0;bucket.head=async k=>++calls===1?null:originalHead(k);
assert.equal((await worker.fetch(request(key,body),env)).status,200);
console.log('Private archive: streaming 8MB, authentication, immutable race, native checksum and atomic manifest checks passed');
