const fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..');
let networkBlocked=false,networkRequests=0;
const guardedFetch=(...args)=>{if(networkBlocked){networkRequests++;throw Error('Airplane mode: no network')}return fetch(...args)};
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),fetch:guardedFetch,AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set,Map,Date,console});return module.exports;}
const delivery=plain('camera-delivery.js'),cache=plain('camera-data.js'),engine=plain('poland-engine.js');
function diskStorage(dir){
 let reads=0;
 const file=key=>path.join(dir,crypto.createHash('sha256').update(key).digest('hex'));
 return {get reads(){return reads},getItem:async key=>{reads++;try{return await fsp.readFile(file(key),'utf8')}catch(e){if(e.code==='ENOENT')return null;throw e}},setItem:(key,value)=>fsp.writeFile(file(key),value),removeItem:async key=>{try{await fsp.unlink(file(key))}catch(e){if(e.code!=='ENOENT')throw e}}};
}
function loadBackgroundTask(storage,notifications){
 let task;
 const noop=()=>{};
 const stubs={'react':{},'react-native':{StyleSheet:{create:v=>v}},'expo-location':{},'expo-speech':{},'expo-task-manager':{defineTask:(name,callback)=>{task=callback}},'expo-notifications':{setNotificationHandler:noop,scheduleNotificationAsync:async item=>notifications.push(item)},'expo-haptics':{},'@react-native-async-storage/async-storage':storage,'react-native-maps':{},'expo-status-bar':{}};
 const module={exports:{}};const code=babel.transformSync(fs.readFileSync(path.join(root,'App.js'),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name in stubs?stubs[name]:name.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,name),'utf8')):plain(name.slice(2)+'.js'),Set,Map,Date,console,setInterval,clearInterval,fetch:guardedFetch});
 assert.equal(typeof task,'function');return {task,get networkRequests(){return networkRequests}};
}
(async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'camalert-offline-warning-'));
 try{
  const storage=diskStorage(dir),feeds={},versions={};
  const manifest=delivery.validateManifest(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/production/v1/manifest.json')).json());
  for(const code of ['UA','PL','DE','FR','US','CA']){
   const entry=manifest.countries.find(e=>e.country_code===code);assert.ok(entry);
   feeds[code]=delivery.verifyCountryExport(await (await fetch(delivery.CAMERA_DELIVERY_URL+'/'+entry.path)).text(),entry);versions[code]=entry.version;
  }
  await cache.saveCameraCache(storage,'camera_remote_cache_v081',{feeds,countries:manifest.countries,countryVersions:versions,stamp:'offline-test'});
  networkBlocked=true;
  const restarted=diskStorage(dir);const loaded=await cache.loadCameraCache(restarted,'camera_remote_cache_v081');
  assert.equal(Object.keys(loaded.feeds).length,6);assert.ok(restarted.reads>6);
  const results=[];
  for(const code of Object.keys(loaded.feeds)){
   await restarted.setItem('camera_settings_v060',JSON.stringify({country:code.toLowerCase(),language:'ru',voice:true,smartDistance:true,cityDistance:500,roadDistance:800,highwayDistance:1000,fastDistance:1500}));
   await restarted.setItem('camera_hidden_v060','[]');
   const point=cache.cameraPoints(loaded.feeds[code]).find(p=>!p._example_only);assert.ok(point);
   const heading=point.direction!=null&&/^\d+(\.\d+)?$/.test(String(point.direction))?Number(point.direction):0;
   const radians=heading*Math.PI/180;
   const latitude=point.latitude-(80/111320)*Math.cos(radians),longitude=point.longitude-(80/(111320*Math.cos(point.latitude*Math.PI/180)))*Math.sin(radians);
   if(code!=='UA'){const foreground=engine.nearestPolandPoint(loaded.feeds[code],latitude,longitude,heading);assert.ok(foreground&&foreground.distance<=500,code+' foreground warning selection');}
   const notifications=[],running=loadBackgroundTask(restarted,notifications);
   await running.task({data:{locations:[{coords:{latitude,longitude,speed:15,heading}}]}});
   assert.equal(running.networkRequests,0);assert.equal(notifications.length,1,code+' must warn from persisted dataset');assert.ok(notifications[0].content.title.includes('Камера'));
   results.push({country:code,backgroundWarningFromDiskCache:true,foregroundSelection:code==='UA'?'shared nearest-ahead engine verified':'passed',networkRequests:running.networkRequests});
  }
  const section=loaded.feeds.PL.average_speed_sections.find(s=>!s._example_only);assert.ok(section);assert.equal(engine.detectAverageSpeedSection(loaded.feeds.PL,section.end.latitude,section.end.longitude,0,section.id).state,'ending');
  const report={checkedAt:new Date().toISOString(),datasetsStoredOnDisk:6,newStorageInstanceAfterRestart:true,cacheChunksChecksumVerified:true,networkDisabled:true,results,polishAverageSpeedFromCache:true,physicalDeviceAirplaneTest:false};
  fs.writeFileSync(path.join(root,'mobile-tests/offline-warning-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{await fsp.rm(dir,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
