// Decode publisher's compressed public payloads in a context without IO bindings.
// The downloaded LZString codec stays in ignored cache and is checksum pinned.
const fs=require('fs'),crypto=require('crypto'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..'),raw=path.join(root,'master-db/raw/ua-pl');
const code=fs.readFileSync(path.join(root,'master-db/cache/ua-pl/lz-string.js'));
if(crypto.createHash('sha256').update(code).digest('hex')!=='3bd8685ba939395aa62bb5e14872591312a4948e65047eae612372fc70666509')throw new Error('Publisher codec changed; review before executing');
const ctx={};vm.runInNewContext(code.toString(),ctx,{timeout:1000});
function decoded(text){try{return JSON.parse(text)}catch{return JSON.parse(text.replaceAll('\\"','"'))}}
for(const name of ['fotoradaryPP','fotoradaryOPP','fotoradaryRL']){
 const text=ctx.LZString.decompressFromBase64(fs.readFileSync(path.join(raw,name+'.base64'),'utf8'));fs.writeFileSync(path.join(raw,name+'.json'),JSON.stringify(decoded(text)));
}
for(const directory of ['device-details','opp-details']){
 const base=path.join(raw,directory);if(!fs.existsSync(base))continue;
 for(const file of fs.readdirSync(base).filter(x=>x.endsWith('.utf16'))){const text=ctx.LZString.decompressFromUTF16(fs.readFileSync(path.join(base,file),'utf8'));fs.writeFileSync(path.join(base,file.replace('.utf16','.json')),JSON.stringify(decoded(text)));}
}
