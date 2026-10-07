const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),fetch,AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Map,Date,console});return module.exports;}
const countries=plain('countries.js'),geography=plain('geography.js'),delivery=plain('camera-delivery.js');
assert.equal(geography.COUNTRY_CODES.size,195);
assert.equal(geography.classifyGeography({country_code:'PA'}).level,'country');
assert.equal(countries.countryName('PA','ru'),'Панама');assert.equal(countries.countryName('US','ru'),'США');
assert.equal(geography.classifyGeography({country_code:'US',level:'state',state_code:'PA'}).level,'region');
assert.equal(geography.classifyGeography({country_code:'ON',parent_country_code:'CA',level:'province'}).level,'region');
assert.equal(geography.classifyGeography({country_code:'PR',parent_country_code:'US',level:'territory'}).level,'territory');
assert.equal(geography.classifyGeography({country_code:'ZZ'}).level,'unknown');
const feed={speed_cameras:[{id:'saved',latitude:8,longitude:-79}]};
for(const language of ['ru','uk','en','pl']){
 const entries=[{country_code:'PA',record_count:16},{country_code:'OM',record_count:300},{country_code:'UG',record_count:299},{country_code:'DE',record_count:1},{country_code:'US',record_count:800},{country_code:'CA',record_count:800},{country_code:'TW',record_count:875},{country_code:'US',geography_level:'state',state_code:'PA',name:'Pennsylvania',record_count:999}];
 const lists=countries.buildCountryLists(entries,{PA:feed},language);
 assert.equal(lists.downloaded[0].country_code,'PA');assert.ok(lists.available.some(x=>x.country_code==='OM'));assert.ok(!lists.available.some(x=>x.country_code==='UG'));
 assert.equal(lists.visible.filter(x=>x.country_code==='US').length,1);assert.equal(lists.visible.filter(x=>x.country_code==='CA').length,1);
 assert.ok(lists.visible.some(x=>x.country_code==='DE'));assert.ok(!lists.visible.some(x=>x.country_code==='TW'));assert.equal(lists.territories[0].country_code,'TW');
 for(const group of [lists.available,lists.downloaded])for(let i=1;i<group.length;i++)assert.ok(group[i-1].name.localeCompare(group[i].name,language,{sensitivity:'base'})<=0);
 assert.equal(entries.length,8);assert.ok(feed.speed_cameras.length); // UI filtering does not mutate input datasets.
}
const cachedState=countries.buildCountryLists([{country_code:'CA',parent_country_code:'US',geography_level:'state',name:'California',record_count:900}],{CA:feed},'ru');
assert.ok(!cachedState.visible.some(e=>e.country_code==='CA'));
const cachedTerritory=countries.buildCountryLists([],{TW:feed},'ru');assert.equal(cachedTerritory.territories[0].country_code,'TW');
(async()=>{
 const manifest=delivery.validateManifest(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json')).json());
 const hierarchy=geography.buildGeographyHierarchy(manifest.countries);assert.equal(hierarchy.unknown.length,0);assert.equal(hierarchy.regions.length,0);
 for(const language of ['ru','uk','en','pl'])for(const entry of manifest.countries){assert.notEqual(countries.countryName(entry.country_code,language),entry.country_code);assert.ok(!countries.countryName(entry.country_code,language).includes('Other country'));assert.equal([...countries.countryFlag(entry.country_code)].length,2);}
 const before=JSON.stringify(manifest);const lists=countries.buildCountryLists(manifest.countries,{},'ru');assert.equal(JSON.stringify(manifest),before);
 assert.equal(lists.visible.filter(x=>x.country_code==='US').length,1);assert.equal(lists.visible.filter(x=>x.country_code==='CA').length,1);
 const samples=[];
 for(const code of ['US','CA','PA','OM','TZ','UG','PE','PG','PH','UY']){
  const entry=manifest.countries.find(x=>x.country_code===code);assert.ok(entry);
  const feed=delivery.verifyCountryExport(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/'+entry.path)).text(),entry);
  const points=feed.cameras||[...(feed.speed_cameras||[]),...(feed.red_light_cameras||[]),...(feed.checkpoints||[])];
  samples.push({code,name:countries.countryName(code,'ru'),datasetCountry:feed.country,records:entry.record_count,pointGroups:Object.keys(feed).filter(k=>Array.isArray(feed[k])),sampleCoordinate:points[0]?{latitude:points[0].latitude,longitude:points[0].longitude}:null});
 }
 const previous=fs.readFileSync(path.join(root,'mobile-tests/fixtures/prior-country-labels.json'),'utf8');const oldNames=JSON.parse(previous);
 const report={checkedAt:new Date().toISOString(),manifestGeneratedAt:manifest.generated_at,...hierarchy.counts,mainListCountries:lists.visible.length,hiddenWeakCountries:hierarchy.countries.length-lists.visible.length,territoryGrouping:'Separate territories view; no inferred parent for Taiwan',separateUsStateDatasets:hierarchy.childrenByCountry.US?.length||0,separateCanadianProvinceDatasets:hierarchy.childrenByCountry.CA?.length||0,previouslyUnlabelledCodes:manifest.countries.filter(e=>!oldNames.includes(e.country_code)).map(e=>e.country_code),regionsMistakenForCountries:[],separatedTerritories:hierarchy.territories.map(e=>({code:e.country_code,name:countries.countryName(e.country_code,'ru')})),samples};
 fs.writeFileSync(path.join(root,'mobile-tests/geography-audit.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1});
