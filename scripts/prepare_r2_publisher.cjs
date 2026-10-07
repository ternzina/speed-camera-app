// Prepare the temporary publisher without exposing the private signing key.
const fs=require('fs'),path=require('path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),file=path.join(root,'.env.r2-publisher'),out=path.join(root,'master-db/cache/r2-migration');fs.mkdirSync(out,{recursive:true});
if(!fs.existsSync(file)){const pair=crypto.generateKeyPairSync('ed25519');fs.writeFileSync(file,JSON.stringify({private_key:pair.privateKey.export({type:'pkcs8',format:'pem'}),public_key:pair.publicKey.export({format:'jwk'}).x}),{mode:0o600});}
const key=JSON.parse(fs.readFileSync(file)),publicKey=Buffer.from(key.public_key,'base64url').toString('base64');
const metadata={main_module:'worker.mjs',compatibility_date:'2026-10-07',compatibility_flags:['nodejs_compat'],bindings:[{type:'r2_bucket',name:'CAMERA_DATA',bucket_name:'speed-camera-data'},{type:'plain_text',name:'PUBLISH_PUBLIC_KEY',text:publicKey}],observability:{enabled:true,head_sampling_rate:0.1}};
fs.writeFileSync(path.join(out,'publisher-metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Prepared ignored publisher metadata with public verification key. Private key remains in .env.r2-publisher.');
