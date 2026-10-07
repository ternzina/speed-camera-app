// Signing helper. Reads the private key only from the ignored project-local file.
const fs=require('fs'),path=require('path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),key=crypto.createPrivateKey(JSON.parse(fs.readFileSync(path.join(root,'.env.r2-publisher'))).private_key);
const [method,object,digest,size]=process.argv.slice(2),time=String(Math.floor(Date.now()/1000));
if(!['GET','HEAD','PUT'].includes(method)||!(/^archive\/v1\//.test(object)||method==='PUT'&&/^production\/v1\/(?:manifest\.json|countries\/[A-Z]{2}\/[a-f0-9]{64}\.json)$/.test(object))||!/^[a-f0-9]{64}$/.test(digest)||!/^\d+$/.test(size))throw new Error('Invalid signing request');
console.log(JSON.stringify({'X-Publish-Time':time,'X-Publish-Digest':digest,'X-Publish-Signature':crypto.sign(null,Buffer.from([method,object,time,digest,size].join('\n')),key).toString('base64')}));
