import React from 'react';
import { View, Text, Pressable } from 'react-native';

export const uiCopy = language => ({
 ru: {all:'Все',unknown:'Не указан',normal:'В пределах лимита',over:'Превышение',noSpeed:'Нет данных скорости',noLimit:'Лимит неизвестен',details:'Подробнее',close:'Свернуть',legend:'Типы камер',advanced:'Расширенные настройки',history:'История предупреждений',catalog:'Каталог камер',auto:'Как в системе',start:'Начало',end:'Конец',inside:'Внутри участка',average:'Средняя',remaining:'Осталось',stop:'Сообщение можно заполнить после остановки',empty:'Нет камер с выбранными фильтрами',direction:'Направление',report:'Сообщение пользователя · не проверено'},
 uk: {all:'Усі',unknown:'Не вказано',normal:'У межах ліміту',over:'Перевищення',noSpeed:'Немає даних швидкості',noLimit:'Ліміт невідомий',details:'Докладніше',close:'Згорнути',legend:'Типи камер',advanced:'Розширені налаштування',history:'Історія попереджень',catalog:'Каталог камер',auto:'Як у системі',start:'Початок',end:'Кінець',inside:'Усередині ділянки',average:'Середня',remaining:'Залишилось',stop:'Повідомлення можна заповнити після зупинки',empty:'Немає камер за цими фільтрами',direction:'Напрямок',report:'Повідомлення користувача · не перевірено'},
 en: {all:'All',unknown:'Unknown',normal:'Within limit',over:'Over limit',noSpeed:'Speed unavailable',noLimit:'Limit unknown',details:'Details',close:'Collapse',legend:'Camera types',advanced:'Advanced settings',history:'Alert history',catalog:'Camera catalog',auto:'System',start:'Start',end:'End',inside:'Inside section',average:'Average',remaining:'Remaining',stop:'Complete your report after stopping',empty:'No cameras match these filters',direction:'Direction',report:'User report · unverified'},
 pl: {all:'Wszystkie',unknown:'Nieznany',normal:'W granicach limitu',over:'Przekroczenie',noSpeed:'Brak prędkości',noLimit:'Nieznany limit',details:'Szczegóły',close:'Zwiń',legend:'Typy kamer',advanced:'Ustawienia zaawansowane',history:'Historia ostrzeżeń',catalog:'Katalog kamer',auto:'System',start:'Początek',end:'Koniec',inside:'Wewnątrz odcinka',average:'Średnia',remaining:'Pozostało',stop:'Uzupełnij zgłoszenie po zatrzymaniu',empty:'Brak kamer dla tych filtrów',direction:'Kierunek',report:'Zgłoszenie użytkownika · niezweryfikowane'},
}[language] || uiCopy('en'));
export function cameraKind(camera={}) {
 const type=camera.camera_type || camera.type || 'speed_camera';
 if(type.startsWith('average_speed')) return 'average_speed';
 return ({fixed_speed:'speed_camera',other_enforcement:'checkpoint'})[type] || type;
}
export function cameraGlyph(camera) {
 return ({speed_camera:'📷',red_light:'🚦',speed_and_red_light:'📷🚦',average_speed:'↔',checkpoint:'◆'})[cameraKind(camera)] || '📷';
}
export function directionLabel(value, language='ru') {
 if(value == null || value === '' || !Number.isFinite(Number(value))) return value || '—';
 const labels=({ru:['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'],uk:['Пн','ПнСх','Сх','ПдСх','Пд','ПдЗх','Зх','ПнЗх'],en:['N','NE','E','SE','S','SW','W','NW'],pl:['N','NE','E','SE','S','SW','W','NW']})[language] || ['N','NE','E','SE','S','SW','W','NW'];
 return labels[Math.round(((Number(value)%360+360)%360)/45)%8];
}
export function SpeedState({speed,available,limit,language,night}) {
 const c=uiCopy(language); const known=limit!=null && Number.isFinite(Number(limit)) && Number(limit)>0;
 const hasSpeed=available && Number.isFinite(Number(speed)) && Number(speed)>=0;
 const over=hasSpeed && known && Number(speed)>Number(limit);
 return <Text accessibilityRole="text" style={{color:over?(night?'#FF9A88':'#A32116'):(night?'#CAD7E7':'#24445B'),fontSize:13,fontWeight:'700',paddingVertical:6}}>{!hasSpeed?c.noSpeed:!known?c.noLimit:`${over?'!':'✓'} ${over?c.over:c.normal}`}</Text>;
}
export function SectionState({section,language,night}) {
 if(!section) return null;
 const c=uiCopy(language); const state=section.state;
 const progress=Number.isFinite(section.progress)?Math.min(1,Math.max(0,section.progress)):null;
 const over=section.averageKmh!=null && section.speedLimit!=null && section.averageKmh>section.speedLimit;
 const ink=night?'#CAD7E7':'#24445B';
 const active=(i)=>(i===0&&['approaching','entering'].includes(state))||(i===1&&state==='inside')||(i===2&&state==='ending');
 return <View style={{paddingVertical:8,gap:6}}>
  <View style={{flexDirection:'row',justifyContent:'space-between',gap:8}}>{[c.start,c.inside,c.end].map((label,i)=><Text key={label} maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{flex:1,textAlign:i===1?'center':i===2?'right':'left',color:ink,fontWeight:active(i)?'900':'400'}}>{label}</Text>)}</View>
  {progress!=null && <View style={{height:8,borderRadius:4,overflow:'hidden',backgroundColor:night?'rgba(175,202,224,0.18)':'rgba(28,61,91,0.14)'}}>
    <View style={{width:`${Math.round(progress*100)}%`,height:8,borderRadius:4,backgroundColor:over?'#E9444E':'#23D3EF'}} />
  </View>}
  <Text maxFontSizeMultiplier={1.3} style={{color:ink}}>{section.name || ''}{progress!=null?` · ${Math.round(progress*100)}%`:''}{Number.isFinite(section.remaining)||Number.isFinite(section.distance)?` · ${progress!=null?c.remaining:state==='approaching'||state==='entering'?c.start:c.end}: ${Math.round(progress!=null?section.remaining:section.distance)} м`:''}</Text>
  {section.averageKmh!=null && <Text maxFontSizeMultiplier={1.3} style={{color:over?(night?'#FF9A88':'#A32116'):ink,fontWeight:'800'}}>{c.average} {section.averageKmh} {section.speedLimit!=null?`· ${section.speedLimit}`:''} км/ч</Text>}
 </View>;
}
export function FilterChip({selected,onPress,children,night}) {
 return <Pressable accessibilityRole="button" accessibilityState={{selected}} onPress={onPress} style={{minHeight:48,minWidth:48,paddingHorizontal:12,justifyContent:'center',borderRadius:16,borderWidth:1,borderColor:selected?'#23D3EF':'#708295',backgroundColor:selected?'#1260E8':night?'#172A40':'#EDF3F8',marginRight:8,marginBottom:8}}><Text style={{color:selected||night?'white':'#10263B'}}>{children}</Text></Pressable>;
}
