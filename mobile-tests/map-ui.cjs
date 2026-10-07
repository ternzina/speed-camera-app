const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),babel=require('@babel/core');
let index=0,states={},locationCalls=0,animated=[];
const React={createElement:(type,props,...children)=>({type,props,children}),useState:initial=>{const i=index++;return[i in states?states[i]:initial,value=>states[i]=value]},useMemo:fn=>fn(),useRef:()=>({current:{animateToRegion:point=>animated.push(point)}})};
const native={View:'View',Text:'Text',Pressable:'Pressable',StyleSheet:{create:x=>x,absoluteFill:{}}};
const m={exports:{}};
const stubs={react:React,'react-native':native,'./map-surface':{__esModule:true,default:'MapView',Marker:'Marker'},'@expo/vector-icons/Feather':'Feather','./driver-engine':{distanceBetween:()=>10},'./premium-presentation':{displayDistance:x=>x,displaySpeed:x=>x},'./driver-copy':{drivingLabel:()=> 'Camera'},'./product-presentation':{CONTROL_ICONS:{},mapClusters:()=>[]}};
vm.runInNewContext(babel.transformSync(fs.readFileSync('product-ui.js','utf8'),{configFile:false,babelrc:false,plugins:['@babel/plugin-transform-modules-commonjs','@babel/plugin-transform-react-jsx']}).code,{module:m,exports:m.exports,require:n=>stubs[n]});
function nodes(n,out=[]){if(!n||typeof n!=='object')return out;out.push(n);for(const child of n.children||[])for(const c of [child].flat(Infinity))nodes(c,out);return out;}
const copy={locate:'Locate',nearby:'Nearby',close:'Close',enableGPS:'Where?',mapHint:'Cameras'};
const props={points:[],copy,driverCopy:{},onLocate:async()=>{locationCalls++;return{latitude:50,longitude:30}}};
function render(extra={}){index=0;return nodes(m.exports.CameraMap({...props,...extra}));}
(async()=>{
 let tree=render();const locate=tree.filter(n=>n.props?.accessibilityLabel==='Locate');assert.equal(locate.length,2);
 await locate[1].props.onPress();assert.equal(locationCalls,1);assert.equal(animated[0].latitude,50);
 tree=render();tree.find(n=>n.props?.accessibilityLabel==='Close').props.onPress();assert(!render().some(n=>n.props?.accessibilityLabel==='Close'));assert.equal(render().filter(n=>n.props?.accessibilityLabel==='Locate').length,1);
 assert(render({coords:{latitude:50,longitude:30}}).some(n=>n.props?.accessibilityLabel==='Nearby'));
 console.log('Map UI passed: location card action obtains and centres GPS, dismiss removes card, location control stays available, nearby action returns with coordinates.');
})().catch(e=>{console.error(e);process.exitCode=1});
