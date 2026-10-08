const fs=require('node:fs'),path=require('node:path');
// Prepared verified exports. No scraping live endpoints or reliance on deployed production protection.
const base=path.resolve(__dirname,'../build/protected-delivery/objects');
const manifest=()=>JSON.parse(fs.readFileSync(path.join(base,'protected/v2/manifest.json'),'utf8'));
function fixtureFetch(url,options={}){
 const pathname=new URL(url).pathname;
 if(pathname.endsWith('/manifest')||pathname.endsWith('manifest.json'))return Promise.resolve(new Response(JSON.stringify(manifest())));
 if(pathname==='/v2/token'){
  const country=JSON.parse(options.body).country,entry=manifest().countries.find(e=>e.country_code===country);
  return Promise.resolve(new Response(JSON.stringify({country,version:entry.version,token:'local-fixture-only'})));
 }
 const country=pathname.match(/^\/v2\/download\/([A-Z]{2})$/)?.[1];
 if(country){const entry=manifest().countries.find(e=>e.country_code===country);return Promise.resolve(new Response(fs.readFileSync(path.join(base,`protected/v2/countries/${country}/${entry.version}.json`),'utf8')));}
 throw Error('Unexpected fixture network route '+pathname);
}
module.exports={fixtureFetch,manifest};
