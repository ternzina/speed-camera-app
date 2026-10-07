import { COUNTRY_NAMES_BY_LANGUAGE } from './country-locales';
import { buildGeographyHierarchy, classifyGeography } from './geography';

export const COUNTRY_NAMES = COUNTRY_NAMES_BY_LANGUAGE.en;
export const CORE_COUNTRIES = ['UA', 'PL', 'DE', 'FR', 'US', 'CA'];
export const MIN_PUBLISHED_CAMERAS = 300;
const unknownNames = {ru:'Другая страна',uk:'Інша країна',en:'Other country',pl:'Inny kraj'};

export function countryName(code, language='en') {
  const normalized = String(code).toUpperCase();
  return COUNTRY_NAMES_BY_LANGUAGE[language]?.[normalized]
    || COUNTRY_NAMES[normalized] || unknownNames[language] || unknownNames.en;
}

export function countryFlag(code) {
  const normalized = String(code).toUpperCase();
  return /^[A-Z]{2}$/.test(normalized)
    ? String.fromCodePoint(...[...normalized].map(letter=>127397+letter.charCodeAt(0)))
    : '🏳️';
}

export function countryLabel(code, language='en') {
  return `${countryFlag(code)} ${countryName(code,language)}`;
}

function storedCount(feed) {
  if (Array.isArray(feed?.cameras)) return feed.cameras.length;
  return ['speed_cameras','red_light_cameras','checkpoints','average_speed_sections']
    .reduce((total,group)=>total+(feed?.[group]?.length||0),0);
}

// Presentation only. Never filter the delivery manifest or delete cached datasets.
export function buildCountryLists(countries=[], feeds={}, language='en') {
  const hierarchy=buildGeographyHierarchy(countries);
  const entries = new Map(hierarchy.countries.map(entry=>[entry.country_code,{...entry}]));
  const nonCountryCodes=new Set([...hierarchy.regions,...hierarchy.territories,...hierarchy.unknown].map(entry=>entry.country_code));
  for (const code of ['UA','PL']) {
    if (!entries.has(code)) entries.set(code,{country_code:code,record_count:storedCount(feeds[code])});
  }
  for (const [code,feed] of Object.entries(feeds)) {
    if (feed && !nonCountryCodes.has(code) && classifyGeography({country_code:code}).level==='country' && !entries.has(code))
      entries.set(code,{country_code:code,record_count:storedCount(feed)});
  }
  const downloaded=[], available=[];
  for (const entry of entries.values()) {
    const code=entry.country_code;
    const saved=!!feeds[code];
    const count=entry.record_count??entry.total??0;
    const item={...entry,publishedCount:count,name:countryName(code,language),label:countryLabel(code,language)};
    if (saved) downloaded.push(item);
    else if (CORE_COUNTRIES.includes(code)||count>=MIN_PUBLISHED_CAMERAS) available.push(item);
  }
  const compare=(a,b)=>a.name.localeCompare(b.name,language,{sensitivity:'base'});
  downloaded.sort(compare);available.sort(compare);
  const territoryEntries=new Map(hierarchy.territories.map(entry=>[entry.country_code,entry]));
  for(const [code,feed] of Object.entries(feeds)){
    if(feed&&classifyGeography({country_code:code}).level==='territory'&&!territoryEntries.has(code))
      territoryEntries.set(code,{country_code:code,record_count:storedCount(feed)});
  }
  const territories=[...territoryEntries.values()].filter(entry=>!!feeds[entry.country_code]||(entry.record_count??entry.total??0)>=MIN_PUBLISHED_CAMERAS)
    .map(entry=>({...entry,publishedCount:entry.record_count??entry.total??storedCount(feeds[entry.country_code]),name:countryName(entry.country_code,language),label:countryLabel(entry.country_code,language)})).sort(compare);
  return {downloaded,available,visible:[...downloaded,...available],coverage:[...downloaded,...available].sort(compare),territories,hierarchy};
}
