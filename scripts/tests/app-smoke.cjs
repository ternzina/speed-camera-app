const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),babel=require('@babel/core');
const root=path.resolve(__dirname,'../..');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports});return module.exports;}
const engine=plain('poland-engine.js'),feeds=plain('camera-data.js');
const feed={speed_cameras:[{id:'opposite',latitude:50.001,longitude:4,direction:180},{id:'ahead',latitude:50.002,longitude:4,direction:0}],red_light_cameras:[],checkpoints:[],average_speed_sections:[]};
assert.equal(engine.nearestPolandPoint(feed,50,4,0).id,'ahead');
assert.equal(engine.nearestPolandPoint(feed,50,4,null),null);
assert.equal(feeds.countryFeed({FR:feed},'fr',{},{}),feed);assert.equal(feeds.cameraPoints(feed).length,2);
assert.equal(feeds.cameraPoints(feeds.countryFeed({},'fr',{},{})).length,0);
const realPL=JSON.parse(fs.readFileSync(path.join(root,'cameras-pl.json')));const section=realPL.average_speed_sections.find(x=>!x._example_only);
assert.ok(section);assert.equal(engine.detectAverageSpeedSection(realPL,section.end.latitude,section.end.longitude,0,section.id).state,'ending');
let stateOverrides={},stateIndex=0;const React={createElement:(type,props,...children)=>({type,props,children}),useState:value=>{const i=stateIndex++;return [i in stateOverrides?stateOverrides[i]:value,()=>{}]},useRef:value=>({current:value}),useMemo:fn=>fn(),useEffect:()=>{}};
const noop=()=>{};const native={StyleSheet:{create:v=>v},Alert:{alert:noop},Vibration:{vibrate:noop},Linking:{openURL:noop}};
for(const x of ['SafeAreaView','View','Text','Pressable','ScrollView','Modal','TextInput','Switch'])native[x]=x;
const stubs={'react':React,'react-native':native,'expo-location':{},'expo-speech':{stop:noop},'expo-task-manager':{defineTask:noop},'expo-notifications':{setNotificationHandler:noop},'expo-haptics':{},'@react-native-async-storage/async-storage':{},'react-native-maps':{default:'MapView',Marker:'Marker',Circle:'Circle'},'expo-status-bar':{StatusBar:'StatusBar'}};
const moduleApp={exports:{}};const code=babel.transformSync(fs.readFileSync(path.join(root,'App.js'),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
vm.runInNewContext(code,{module:moduleApp,exports:moduleApp.exports,require:name=>name in stubs?stubs[name]:name.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,name))):plain(name.slice(2)+'.js'),Set,Date,console,setInterval,clearInterval});
for(const country of ['ua','pl','fr','us','ca']){stateIndex=0;stateOverrides={0:{country,language:'en',smartDistance:true,cityDistance:500,roadDistance:800,highwayDistance:1000,fastDistance:1500}};assert.ok(moduleApp.exports.default());}
console.log('App smoke passed: 5 country renders, remote feed precedence, opposing direction and real Polish section ending.');
(async()=>{
 const values=new Map();const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{assert.ok(Buffer.byteLength(v)<1000000,'chunk must fit Android cursor window');values.set(k,v)},removeItem:async k=>values.delete(k)};
 const large={...feed,speed_cameras:Array.from({length:10000},(_,i)=>({...feed.speed_cameras[1],id:String(i),location:'Камера на дороге',provenance:[{source_url:'https://example.org/'+('x'.repeat(500))}]}))};
 await feeds.saveCameraCache(storage,'cache',{feeds:{UA:{cameras:[]},PL:feed,FR:large,US:feed},countries:[],stamp:'test'},'FR');
 const loaded=await feeds.loadCameraCache(storage,'cache');assert.equal(loaded.feeds.FR.speed_cameras.length,10000);assert.equal(loaded.feeds.FR.speed_cameras[0].provenance,undefined);assert.equal(loaded.feeds.US,undefined);
 await feeds.saveCameraCache(storage,'cache',{feeds:{UA:{cameras:[]},PL:feed,US:feed},countries:[],stamp:'next'},'US');assert.equal((await feeds.loadCameraCache(storage,'cache')).feeds.FR,undefined);
 assert.equal([...values.keys()].filter(k=>k.includes(':FR:')).length,0);
 await storage.setItem('legacy',JSON.stringify({feeds:{PL:feed},stamp:'old'}));assert.equal((await feeds.loadCameraCache(storage,'legacy')).stamp,'old');
 console.log('Cache smoke passed: 10000 cameras in bounded chunks, country eviction, legacy cache compatibility.');
})().catch(error=>{console.error(error);process.exitCode=1});
