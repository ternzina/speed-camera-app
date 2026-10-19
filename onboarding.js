import React, { useEffect, useState } from 'react';
import { AppState, Image, View, Text, Pressable, ScrollView, SafeAreaView, StyleSheet, useWindowDimensions, Platform, StatusBar as NativeStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CAMERA_DELIVERY_URL, CAMERA_MANIFEST_PATH, validateManifest } from './camera-delivery';
import snapshot from './onboarding-stats.json';

const COPY = {
 ru: {back:'Назад',exit:'Закрыть приветствие',skip:'Пропустить',next:'Далее',continue:'Продолжить',page:'Страница',of:'из',sound:'Звук дороги',welcome:'Уверенность на каждом километре',intro:'Ваш помощник в дороге: предупреждения о камерах и контроль скорости.',camera:'Камеры впереди',cameraBody:'Знайте о камерах заранее',voice:'Звуковые сигналы',voiceBody:'Предупреждения во время поездки',world:'Камеры по всему миру',worldBody:'Данные о камерах разных стран — для ваших поездок рядом с домом и за границей.',countries:'Страны',cameras:'Камеры',international:'Международная база',published:'Опубликованные данные',updated:'База камер регулярно обновляется',updatedBody:'Мы добавляем новые камеры и уточняем существующие данные.',date:'Данные на',offline:'ОФЛАЙН',freedom:'Свобода в дороге',subtitle:'Предупреждения даже без интернета',offlineBody:'Загрузите базу нужной страны заранее и получайте предупреждения в поездке, даже если связь пропадёт.',works:'Работает офлайн',worksBody:'По заранее загруженной базе камер',gps:'GPS-позиция',gpsBody:'Определяется устройством',notice:'Для офлайн-предупреждений заранее загрузите базу камер нужной страны.'},
 uk: {back:'Назад',exit:'Закрити привітання',skip:'Пропустити',next:'Далі',continue:'Продовжити',page:'Сторінка',of:'з',sound:'Звук дороги',welcome:'Впевненість на кожному кілометрі',intro:'Ваш помічник у дорозі: попередження про камери та контроль швидкості.',camera:'Камери попереду',cameraBody:'Знайте про камери заздалегідь',voice:'Звукові сигнали',voiceBody:'Попередження під час поїздки',world:'Камери в усьому світі',worldBody:'Дані про камери різних країн — для ваших поїздок поруч із домом і за кордоном.',countries:'Країни',cameras:'Камери',international:'Міжнародна база',published:'Опубліковані дані',updated:'База камер регулярно оновлюється',updatedBody:'Ми додаємо нові камери й уточнюємо наявні дані.',date:'Дані станом на',offline:'ОФЛАЙН',freedom:'Свобода в дорозі',subtitle:'Попередження навіть без інтернету',offlineBody:'Завантажте базу потрібної країни заздалегідь і отримуйте попередження в поїздці, навіть якщо зв’язок зникне.',works:'Працює офлайн',worksBody:'За заздалегідь завантаженою базою камер',gps:'GPS-позиція',gpsBody:'Визначається пристроєм',notice:'Для офлайн-попереджень заздалегідь завантажте базу камер потрібної країни.'},
 en: {back:'Back',exit:'Close welcome',skip:'Skip',next:'Next',continue:'Continue',page:'Page',of:'of',sound:'Road sound',welcome:'Confidence on every kilometre',intro:'Your driving companion: camera alerts and speed awareness.',camera:'Cameras ahead',cameraBody:'Know about cameras in advance',voice:'Audio alerts',voiceBody:'Warnings during your trip',world:'Cameras around the world',worldBody:'Camera data for trips close to home and abroad.',countries:'Countries',cameras:'Cameras',international:'International database',published:'Published data',updated:'The camera database is regularly updated',updatedBody:'We add new cameras and refine existing data.',date:'Data as of',offline:'OFFLINE',freedom:'Freedom on the road',subtitle:'Alerts even without internet',offlineBody:'Download your country’s database ahead of time and receive alerts even when connectivity drops.',works:'Works offline',worksBody:'With a previously downloaded camera database',gps:'GPS position',gpsBody:'Determined by your device',notice:'Download the camera database for your country before using offline alerts.'},
 pl: {back:'Wstecz',exit:'Zamknij powitanie',skip:'Pomiń',next:'Dalej',continue:'Kontynuuj',page:'Strona',of:'z',sound:'Dźwięk drogi',welcome:'Pewność na każdym kilometrze',intro:'Twój pomocnik w drodze: ostrzeżenia o kamerach i kontrola prędkości.',camera:'Kamery przed Tobą',cameraBody:'Dowiedz się o kamerach wcześniej',voice:'Sygnały dźwiękowe',voiceBody:'Ostrzeżenia podczas podróży',world:'Kamery na całym świecie',worldBody:'Dane o kamerach na podróże blisko domu i za granicą.',countries:'Kraje',cameras:'Kamery',international:'Międzynarodowa baza',published:'Opublikowane dane',updated:'Baza kamer jest regularnie aktualizowana',updatedBody:'Dodajemy nowe kamery i uściślamy istniejące dane.',date:'Dane z',offline:'OFFLINE',freedom:'Wolność w drodze',subtitle:'Ostrzeżenia nawet bez internetu',offlineBody:'Pobierz wcześniej bazę wybranego kraju i otrzymuj ostrzeżenia także po utracie połączenia.',works:'Działa offline',worksBody:'Z wcześniej pobraną bazą kamer',gps:'Pozycja GPS',gpsBody:'Określana przez urządzenie',notice:'Aby otrzymywać ostrzeżenia offline, pobierz wcześniej bazę kamer wybranego kraju.'}
};
const CACHE_KEY='camalert_published_stats_v1';
const validStats = value => value && Number.isInteger(value.countries) && value.countries > 0 && Number.isInteger(value.cameras) && value.cameras > 0 && Number.isFinite(Date.parse(value.generated_at));
function usePublishedStats() {
 const [stats,setStats]=useState(snapshot);
 useEffect(()=>{
  let live=true; const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  (async()=>{
   try { const cached=JSON.parse(await AsyncStorage.getItem(CACHE_KEY)); if(live&&validStats(cached))setStats(cached); } catch {}
   try {
    const response=await fetch(CAMERA_DELIVERY_URL+CAMERA_MANIFEST_PATH,{signal:controller.signal});
    if(!response.ok)throw new Error('Catalog unavailable');
    const manifest=validateManifest(await response.json());
    const next={countries:manifest.countries.filter(c=>c.record_count>0).length,cameras:manifest.total_records,generated_at:manifest.generated_at};
    if(!validStats(next))throw new Error('Invalid statistics');
    if(live){setStats(next);await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(next));}
   } catch {} finally {clearTimeout(timer);}
  })();
  return()=>{live=false;clearTimeout(timer);controller.abort();};
 },[]);
 return stats;
}
export function WelcomeIcon({kind}) {
 if(kind==='camera')return <View style={s.icon}><View style={s.camera}><View style={s.lens}/><View style={s.cameraTop}/></View></View>;
 if(kind==='voice')return <View style={s.icon}><View style={s.speaker}/><View style={s.wave}/></View>;
 if(kind==='wifi')return <View style={s.icon}><View style={s.wifi}/><View style={s.wifiInner}/><View style={s.slash}/></View>;
 if(kind==='world')return <View style={s.icon}><View style={s.globe}><View style={s.meridian}/><View style={s.equator}/></View></View>;
 if(kind==='gps')return <View style={s.icon}><View style={s.pin}><View style={s.pinDot}/></View></View>;
 return <View style={s.icon}><Text allowFontScaling={false} style={s.glyph}>{kind==='voice'?'♪':kind==='world'?'◎':kind==='refresh'?'↻':'↓'}</Text></View>;
}
function Brand(){return <Text maxFontSizeMultiplier={1.15} style={s.brand}>Cam<Text maxFontSizeMultiplier={1.6} style={s.cyan}>Alert</Text></Text>;}
function Card({icon,title,body}){return <View style={s.card}><View style={s.cardHeading}><WelcomeIcon kind={icon}/><Text maxFontSizeMultiplier={1.6} style={s.cardTitle}>{title}</Text></View><Text maxFontSizeMultiplier={1.6} style={s.cardBody}>{body}</Text></View>;}
function IntroVideo() {
 const [frameReady,setFrameReady]=useState(false);
 const [failed,setFailed]=useState(false);
 const player=useVideoPlayer(require('./assets/onboarding-drive-loop.mp4'),p=>{p.loop=true;p.muted=true;p.play();});
 useEffect(()=>{
  const status=player.addListener('statusChange',({status})=>{if(status==='error'){setFailed(true);setFrameReady(false);}});
  const appState=AppState.addEventListener('change',state=>{if(state==='active')player.play();else player.pause();});
  return()=>{status.remove();appState.remove();};
 },[player]);
 return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
  <Image source={require('./assets/onboarding-first-frame.jpg')} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%"}]}/>
  {!failed&&<VideoView player={player} style={[StyleSheet.absoluteFill,{opacity:frameReady?1:0}]} onFirstFrameRender={()=>setFrameReady(true)} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} surfaceType="textureView"/>}
  <View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(3,13,27,0.10)'}]}/>
 </View>;
}
export default function WelcomeScreen({page,onNext,onBack,onSkip,language='ru'}) {
 const t=COPY[language]||COPY.ru;
 const {height,fontScale}=useWindowDimensions();
 const stats=usePublishedStats();
 const cardsStack=fontScale>1.3;
 const date=new Date(stats.generated_at).toLocaleDateString(language==='uk'?'uk-UA':language);
 const format=n=>n.toLocaleString(language==='uk'?'uk-UA':language);
 return <View style={s.screen}>
  {page===0&&<IntroVideo/>}
  <StatusBar style="light"/>
  <SafeAreaView style={s.safe}>
   <View style={s.topbar}>
    <Pressable accessibilityRole="button" accessibilityLabel={page===0?t.exit:t.back} onPress={onBack} style={s.iconButton}><View style={s.backArrow}/></Pressable>
    <View style={s.topActions}>
     <Pressable accessibilityRole="button" onPress={onSkip} style={s.skipButton}><Text maxFontSizeMultiplier={1.3} style={s.skip}>{t.skip}</Text></Pressable>
    </View>
   </View>
   <ScrollView key={page} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
    {page===0?<View style={{height:Math.max(105,height*0.23),flexGrow:1}}/>:
     <View style={[s.hero,{height:Math.min(240,Math.max(150,(height-180)*0.29))}]}>
      <Image source={page===1?require('./assets/onboarding-world.jpg'):require('./assets/onboarding-night.jpg')} resizeMode="cover" style={[StyleSheet.absoluteFill,{width:"100%",height:"100%"}]}/>
      {page===2&&<View style={s.offline}><WelcomeIcon kind="wifi"/><Text maxFontSizeMultiplier={1.2} style={s.offlineText}>{t.offline}</Text></View>}
     </View>}
    <Brand/>
    <Text maxFontSizeMultiplier={1.6} style={[s.title,page===0&&s.welcomeTitle]}>{page===0?t.welcome:page===1?t.world:t.freedom}</Text>
    {page===2&&<Text maxFontSizeMultiplier={1.6} style={s.subtitle}>{t.subtitle}</Text>}
    <Text maxFontSizeMultiplier={1.6} style={s.body}>{page===0?t.intro:page===1?t.worldBody:t.offlineBody}</Text>
    <View style={[s.cards,cardsStack&&{flexDirection:'column'}]}>
     {page===0?<><Card icon="camera" title={t.camera} body={t.cameraBody}/><Card icon="voice" title={t.voice} body={t.voiceBody}/></>:
      page===1?<><Card icon="world" title={`${format(stats.countries)}\n${t.countries}`} body={t.international}/><Card icon="camera" title={`${format(stats.cameras)}\n${t.cameras}`} body={t.published}/></>:
      <><Card icon="wifi" title={t.works} body={t.worksBody}/><Card icon="gps" title={t.gps} body={t.gpsBody}/></>}
    </View>
    {page>0&&<View style={s.notice}><WelcomeIcon kind={page===1?'refresh':'download'}/><View style={{flex:1}}>{page===1&&<Text maxFontSizeMultiplier={1.6} style={s.noticeTitle}>{t.updated}</Text>}<Text maxFontSizeMultiplier={1.6} style={s.noticeBody}>{page===1?t.updatedBody:t.notice}</Text></View></View>}
    {page===1&&<Text maxFontSizeMultiplier={1.6} style={s.date}>{t.date} {date} · CamAlert</Text>}
   </ScrollView>
   <View style={s.footer}>
    <View accessibilityRole="progressbar" accessibilityLabel={`${t.page} ${page+1} ${t.of} 3`} accessibilityValue={{min:1,max:3,now:page+1}} style={s.dots}>{[0,1,2].map(i=><View key={i} style={[s.dot,i===page&&s.activeDot]}/>)}</View>
    <Pressable accessibilityRole="button" onPress={onNext} style={({pressed})=>[s.button,pressed&&{opacity:0.8}]}><Text maxFontSizeMultiplier={1.5} style={s.buttonText}>{page===2?t.continue:t.next}  →</Text></Pressable>
   </View>
  </SafeAreaView>
 </View>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:'#071525'},safe:{flex:1,paddingTop:Platform.OS==='android'?NativeStatusBar.currentHeight||24:0,paddingBottom:Platform.OS==='android'?24:0},
 topbar:{height:44,marginHorizontal:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},topActions:{flexDirection:'row',alignItems:'center'},iconButton:{width:44,height:44,justifyContent:'center',alignItems:'center',borderRadius:22,backgroundColor:'rgba(7,21,37,0.65)'},backArrow:{width:12,height:12,borderLeftWidth:2,borderBottomWidth:2,borderColor:'#FFF',transform:[{rotate:'45deg'}]},sound:{fontSize:24,color:'#23D3EF'},skipButton:{minHeight:44,justifyContent:'center',paddingHorizontal:12},skip:{fontSize:13,color:'#B8C8DA'},scroll:{flex:1},content:{flexGrow:1,paddingHorizontal:22,paddingBottom:8},
 hero:{borderRadius:21,overflow:'hidden',marginTop:4,marginBottom:10,borderWidth:1,borderColor:'#1C394F'},brand:{color:'#FFF',fontSize:32,fontWeight:'900',letterSpacing:-1.3,marginBottom:6},cyan:{color:'#23D3EF'},title:{color:'#FFF',fontSize:24,lineHeight:29,fontWeight:'800'},welcomeTitle:{fontSize:24,lineHeight:29},subtitle:{color:'#FFF',fontSize:16,lineHeight:20,fontWeight:'700',marginTop:9},body:{color:'#B8C8DA',fontSize:14,lineHeight:19,marginTop:8,marginBottom:10},
 cards:{flexDirection:'row',gap:10},card:{flex:1,padding:10,borderRadius:19,backgroundColor:'#10263B',borderWidth:1,borderColor:'#183449'},cardHeading:{flexDirection:'row',gap:7,alignItems:'center'},cardTitle:{flex:1,color:'#FFF',fontSize:16,lineHeight:21,fontWeight:'700'},cardBody:{color:'#B8C8DA',fontSize:13,lineHeight:18,marginTop:6},notice:{marginTop:10,backgroundColor:'#10263B',borderRadius:19,padding:10,flexDirection:'row',alignItems:'center',gap:12},noticeTitle:{color:'#FFF',fontSize:16,lineHeight:21,fontWeight:'700',marginBottom:4},noticeBody:{color:'#B8C8DA',fontSize:13,lineHeight:18},date:{fontSize:11,color:'#B8C8DA',marginTop:7},
 footer:{paddingHorizontal:22,paddingTop:8,paddingBottom:10,backgroundColor:'#071525'},dots:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:10,marginBottom:12},dot:{width:7,height:7,borderRadius:4,backgroundColor:'#536F8C'},activeDot:{width:24,backgroundColor:'#23D3EF'},button:{height:56,borderRadius:21,backgroundColor:'#1260E8',justifyContent:'center',alignItems:'center'},buttonText:{color:'#FFF',fontSize:20,fontWeight:'700'},
 offline:{position:'absolute',left:12,top:12,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,paddingVertical:9,backgroundColor:'rgba(16,38,59,0.9)',borderRadius:22,borderWidth:1,borderColor:'#28566D'},offlineText:{fontSize:12,color:'#8EEAFF',fontWeight:'700'},icon:{width:25,height:27,alignItems:'center',justifyContent:'center',flexShrink:0},speaker:{width:11,height:17,borderWidth:2,borderColor:'#23D3EF',borderRadius:3,marginRight:7},wave:{position:'absolute',right:1,width:8,height:22,borderRightWidth:2,borderColor:'#23D3EF',borderRadius:8},glyph:{fontSize:27,lineHeight:30,color:'#23D3EF'},camera:{width:23,height:17,borderWidth:1.8,borderColor:'#23D3EF',borderRadius:4,alignItems:'center',justifyContent:'center'},lens:{width:8,height:8,borderRadius:5,borderWidth:1.8,borderColor:'#23D3EF'},cameraTop:{position:'absolute',top:-5,left:6,width:9,height:4,borderWidth:1.8,borderBottomWidth:0,borderColor:'#23D3EF',borderTopLeftRadius:2,borderTopRightRadius:2},wifi:{position:'absolute',top:4,left:3,width:19,height:19,borderTopWidth:2,borderLeftWidth:2,borderColor:'#23D3EF',borderTopLeftRadius:19,transform:[{rotate:'45deg'}]},wifiInner:{position:'absolute',top:11,left:7,width:11,height:11,borderTopWidth:2,borderLeftWidth:2,borderColor:'#23D3EF',borderTopLeftRadius:11,transform:[{rotate:'45deg'}]},slash:{position:'absolute',width:2,height:27,backgroundColor:'#23D3EF',transform:[{rotate:'-40deg'}]},globe:{width:23,height:23,borderWidth:1.8,borderColor:'#23D3EF',borderRadius:12,alignItems:'center',justifyContent:'center'},meridian:{position:'absolute',width:10,height:21,borderWidth:1.5,borderColor:'#23D3EF',borderRadius:9},equator:{width:20,height:1.5,backgroundColor:'#23D3EF'},pin:{width:20,height:24,borderWidth:2,borderColor:'#23D3EF',borderRadius:12,alignItems:'center',justifyContent:'center'},pinDot:{width:7,height:7,borderWidth:2,borderColor:'#23D3EF',borderRadius:5}
});
