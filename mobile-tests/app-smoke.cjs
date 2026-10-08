const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),babel=require('@babel/core');
const root=path.resolve(__dirname,'..');
function plain(file){const module={exports:{}};vm.runInNewContext(babel.transformSync(fs.readFileSync(path.join(root,file),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs']}).code,{module,exports:module.exports,require:name=>plain(name.replace(/^\.\//,'')+'.js'),AbortController,setTimeout,clearTimeout,Uint8Array,Uint32Array,DataView,Set});return module.exports;}
const engine=plain('poland-engine.js'),feeds=plain('camera-data.js');
const feed={speed_cameras:[{id:'opposite',latitude:50.001,longitude:4,direction:180},{id:'ahead',latitude:50.002,longitude:4,direction:0}],red_light_cameras:[],checkpoints:[],average_speed_sections:[]};
assert.equal(engine.nearestPolandPoint(feed,50,4,0).id,'ahead');
assert.equal(engine.nearestPolandPoint(feed,50,4,null),null);
assert.equal(feeds.countryFeed({FR:feed},'fr',{},{}),feed);assert.equal(feeds.cameraPoints(feed).length,2);
assert.equal(feeds.cameraPoints(feeds.countryFeed({},'fr',{},{})).length,0);
const realPL=JSON.parse(fs.readFileSync(path.join(root,'cameras-pl.json')));const section=realPL.average_speed_sections.find(x=>!x._example_only);
assert.ok(section);assert.equal(engine.detectAverageSpeedSection(realPL,section.end.latitude,section.end.longitude,0,section.id).state,'ending');
let stateOverrides={},stateIndex=0;const stateInitials=[];const React={createElement:(type,props,...children)=>({type,props,children}),useState:value=>{const i=stateIndex++;stateInitials[i]=value;return [i in stateOverrides?stateOverrides[i]:value,next=>{const previous=i in stateOverrides?stateOverrides[i]:value;stateOverrides[i]=typeof next==='function'?next(previous):next}]},useRef:value=>({current:value}),useMemo:fn=>fn(),useEffect:()=>{}};
let gpsPermission,gpsPosition;let timerImplementation=setTimeout;const noop=()=>{};const native={StyleSheet:{create:v=>v},Alert:{alert:noop},Vibration:{vibrate:noop},Linking:{openURL:noop}};
for(const x of ['SafeAreaView','View','Text','Pressable','ScrollView','Modal','TextInput','Switch'])native[x]=x;
const stubs={"expo-crypto":{randomUUID:()=>"11111111-1111-4111-8111-111111111111"},'./premium-ui':{HeroLanding:'HeroLanding',FullWarning:'FullWarning',PremiumTrip:'PremiumTrip',CountryDetails:'CountryDetails',Filters:'Filters',TypeIcon:'TypeIcon'},'./product-ui':{Icon:'Icon',CameraMap:'CameraMap'},'react':React,'react-native':native,'expo-location':{Accuracy:{High:4},requestForegroundPermissionsAsync:()=>gpsPermission(),getCurrentPositionAsync:()=>gpsPosition()},'expo-speech':{stop:noop},'expo-task-manager':{defineTask:noop},'expo-notifications':{setNotificationHandler:noop},'expo-haptics':{},'@react-native-async-storage/async-storage':{},'react-native-maps':{default:'MapView',Marker:'Marker',Circle:'Circle'},'expo-status-bar':{StatusBar:'StatusBar'}};
const moduleApp={exports:{}};const code=babel.transformSync(fs.readFileSync(path.join(root,'App.js'),'utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-react-jsx','@babel/plugin-transform-modules-commonjs']}).code;
vm.runInNewContext(code,{module:moduleApp,exports:moduleApp.exports,require:name=>name in stubs?stubs[name]:name.endsWith('.json')?JSON.parse(fs.readFileSync(path.join(root,name))):plain(name.slice(2)+'.js'),Set,Date,console,setInterval,clearInterval,setTimeout:(fn,ms)=>timerImplementation(fn,ms),clearTimeout});
for(const country of ['ua','pl','de','fr','us','ca','ru','by','ge','am','az']){stateIndex=0;stateOverrides={0:{country,language:'en',smartDistance:true,cityDistance:500,roadDistance:800,highwayDistance:1000,fastDistance:1500}};assert.ok(moduleApp.exports.default());}
stateIndex=0;stateOverrides={0:{country:'de',language:'ru'},12:{PL:feed},13:[{country_code:'DE',record_count:5794},{country_code:'PL',record_count:897},{country_code:'OM',record_count:459},{country_code:'PA',record_count:16},{country_code:'TW',record_count:875},{country_code:'CA',geography_level:'province',province_code:'ON',name:'Ontario',record_count:500}],20:'offline'};
const settingsTree=moduleApp.exports.default();
function nodes(tree,out=[]){if(tree&&typeof tree==='object'){if(tree.type==='Modal'&&tree.props?.visible===false)return out;out.push(tree);for(const child of tree.children||[])for(const item of Array.isArray(child)?child:[child])nodes(item,out);}return out;}
const checkboxes=nodes(settingsTree).filter(n=>n.props?.accessibilityRole==='checkbox');
assert.equal(checkboxes.length,0,'multi-select removed');
const radios=nodes(settingsTree).filter(n=>n.props?.accessibilityRole==='radio');
assert.equal(radios.length,4);
assert.ok(radios.some(n=>n.props.accessibilityLabel.includes('Оман')));
assert.ok(!radios.some(n=>/Панама|Тайвань|Ontario/.test(n.props.accessibilityLabel)));
assert.ok(nodes(settingsTree).some(n=>n.type==='Text'&&n.children.includes('Скачанные страны')));
assert.ok(!nodes(settingsTree).some(n=>n.type==='Text'&&n.children.some(x=>typeof x==='string'&&x.includes('Скачать выбранные'))), 'no bulk download action');
const omanRadio=nodes(settingsTree).find(n=>n.props?.accessibilityRole==='radio'&&n.props.accessibilityLabel.includes('Оман'));
omanRadio.props.onPress();assert.equal(stateOverrides[0].country,'om');

for(const [type,label] of [['speed_camera','Камера скорости'],['mobile_control','Мобильный контроль'],['red_light_camera','Камера красного света'],['average_speed_start','Контроль средней скорости']]){
 stateIndex=0;stateOverrides={0:{country:'ua',language:'ru',voice:true},21:'add'};const sheet=moduleApp.exports.default();
 const choice=nodes(sheet).find(n=>n.props?.accessibilityRole==='button'&&n.children?.some(c=>c?.children?.includes(label)));
 assert.ok(choice,'report option '+type);choice.props.onPress();assert.equal(stateOverrides[23],type);assert.equal(stateOverrides[21],'new');
}
stateIndex=0;stateOverrides={0:{country:'ua',language:'ru',voice:true}};const idle=nodes(moduleApp.exports.default());assert.equal(idle.filter(n=>n.type==='Text'&&n.children.includes('Готовы к поездке')).length,1);assert.ok(idle.some(n=>n.children?.includes('Страны')));

// Exercise actual dark-mode render styles on every main screen, including empty history.
const premiumSlot=stateInitials.findIndex(x=>x && x.theme==='system' && 'started' in x);
assert.ok(premiumSlot>=0);
for(const tab of ['drive','map','offline','history','settings']){
 stateIndex=0;stateOverrides={0:{country:'ua',language:'ru',voice:true},20:tab,[premiumSlot]:{started:true,theme:'dark',units:'metric',filters:{},showLimits:true}};
 const tree=nodes(moduleApp.exports.default());
 const flatten=x=>Object.assign({},...([x].flat(Infinity).filter(Boolean)));
 for(const node of tree.filter(n=>n.type==='Text')){
  const style=flatten(node.props.style);
  assert.notEqual(style.color,'#101828',`dark text on ${tab}: ${node.children}`);
  assert.ok(node.props.maxFontSizeMultiplier<=1.35, 'compact UI limits destructive text scaling');
 }
 if(tab==='history'){
  const labels=tree.filter(n=>n.type==='Text' && flatten(n.props.style).height===48);
  assert.equal(labels.length,3);assert(labels.every(n=>n.props.numberOfLines===2));
 }
}
console.log('App smoke passed: 11 country renders, remote feed precedence, opposing direction and real Polish section ending.');
(async()=>{
 // Map GPS: success, denied permission, and hung permission request all resolve cleanly.
 stateIndex=0;stateOverrides={0:{country:'ua',language:'ru'},20:'map'};
 const gps=nodes(moduleApp.exports.default()).find(n=>n.type==='CameraMap').props.onLocate;
 gpsPermission=async()=>({status:'granted'});
 gpsPosition=async()=>({coords:{latitude:50,longitude:30}});
 const position=await gps();assert.equal(position.latitude,50);
 let alerts=0;native.Alert.alert=()=>alerts++;
 gpsPermission=async()=>({status:'denied'});
 assert.equal(await gps(),null);assert.equal(alerts,1);
 gpsPermission=()=>new Promise(()=>{});
 timerImplementation=fn=>setTimeout(fn,0);
 assert.equal(await gps(),null);assert.equal(alerts,2);
 timerImplementation=setTimeout;
 const values=new Map();const storage={getItem:async k=>values.get(k)||null,setItem:async(k,v)=>{assert.ok(Buffer.byteLength(v)<1000000,'chunk must fit Android cursor window');values.set(k,v)},removeItem:async k=>values.delete(k)};
 const large={...feed,speed_cameras:Array.from({length:16000},(_,i)=>({...feed.speed_cameras[1],id:String(i),location:'Камера на дороге',provenance:[{source_url:'https://example.org/'+('x'.repeat(500))}]}))};
 await feeds.saveCameraCache(storage,'cache',{feeds:{UA:{cameras:[]},PL:feed,FR:large,US:feed},countries:[],stamp:'test'},'FR');
 const loaded=await feeds.loadCameraCache(storage,'cache');assert.equal(loaded.feeds.FR.speed_cameras.length,16000);assert.equal(loaded.feeds.FR.speed_cameras[0].provenance,undefined);assert.equal(loaded.feeds.US.speed_cameras.length,2);
 await feeds.saveCameraCache(storage,'cache',{feeds:{...loaded.feeds,US:feed},countries:[],stamp:'next'},'US');assert.equal((await feeds.loadCameraCache(storage,'cache')).feeds.FR.speed_cameras.length,16000);
 assert.ok([...values.keys()].some(k=>k.includes(':FR:')));
 await storage.setItem('legacy',JSON.stringify({feeds:{PL:feed},stamp:'old'}));assert.equal((await feeds.loadCameraCache(storage,'legacy')).stamp,'old');
 console.log('Cache smoke passed: 16000 cameras without truncation in bounded chunks, offline country retention, legacy cache compatibility.');
})().catch(error=>{console.error(error);process.exitCode=1});
