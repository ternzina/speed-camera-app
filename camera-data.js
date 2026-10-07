import { sha256 } from './sha256';
// Verified R2 country feeds with the retained Supabase endpoint as fallback.
// Bundled UA/PL data are retained only as offline fallbacks.
export function cameraPoints(feed) {
  if (!feed) return [];
  if (Array.isArray(feed.cameras)) return feed.cameras;
  return [
    ...(feed.speed_cameras || []),
    ...(feed.red_light_cameras || []),
    ...(feed.checkpoints || []),
  ].filter(camera => !camera._example_only);
}

export function countryFeed(feeds, country, fallbackUA, fallbackPL) {
  const code = String(country || "ua").toUpperCase();
  return feeds[code] || (code === "UA" ? fallbackUA : code === "PL" ? fallbackPL : {
    country: code, speed_cameras: [], red_light_cameras: [], checkpoints: [], average_speed_sections: [],
  });
}

const CACHE_CHUNK_CHARS = 200000;
const CACHE_FIELDS = ["id","base_id","type","camera_type","latitude","longitude","speed_limit","direction","direction_code","location","road","road_index","region","name","start","end","_example_only"];
function compactPoint(point) {
  const result = {};
  for (const field of CACHE_FIELDS) if (point[field] !== undefined) result[field] = point[field];
  return result;
}
export function compactFeed(feed) {
  const result = {...feed};
  for (const group of ["cameras","speed_cameras","red_light_cameras","checkpoints","average_speed_sections"])
    if (Array.isArray(feed[group])) result[group] = feed[group].map(compactPoint);
  return result;
}

// Immutable cache generations: commit the pointer only after all chunks succeed.
// Interrupted writes preserve the previous successful offline cache.
export async function loadCameraCache(storage, key) {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  let manifest;
  try { manifest=JSON.parse(raw); } catch { return null; }
  if (manifest.version !== 3 && manifest.version !== 4) return manifest;
  const feeds = {}, versions = {...(manifest.countryVersions || {})};
  for (const [code, entry] of Object.entries(manifest.feedChunks || {})) {
    try {
      const count = manifest.version===3 ? entry : entry.count;
      const prefix = manifest.version===3 ? `${key}:v3:${code}` : entry.prefix;
      if (!Number.isInteger(count) || count<1 || count>1000) throw new Error("Invalid chunks");
      const parts = await Promise.all(Array.from({length:count}, (_,i)=>storage.getItem(`${prefix}:${i}`)));
      if (parts.some(part=>part == null)) throw new Error("Incomplete camera cache");
      const text=parts.join("");
      if (manifest.version===4 && sha256(text)!==entry.checksum) throw new Error("Corrupt camera cache");
      feeds[code] = JSON.parse(text);
    } catch { delete versions[code]; }
  }
  return {...manifest,feeds,countryVersions:versions};
}
let cacheWrite = Promise.resolve(), cacheGeneration = 0;
export function saveCameraCache(storage, key, {feeds,countries,cov,stamp,countryVersions={}}, selectedCountry) {
  cacheWrite = cacheWrite.catch(()=>{}).then(async () => {
    const previousRaw = await storage.getItem(key);
    let previous;
    try { previous=previousRaw?JSON.parse(previousRaw):null; } catch { previous=null; }
    const generation = `${Date.now()}-${++cacheGeneration}`;
    const feedChunks = {}, writes = [];
    // Keep all previously downloaded countries for offline travel; each value remains bounded.
    for (const [code,feed] of Object.entries(feeds)) {
      if (!feed || !/^[A-Z]{2}$/.test(code)) continue;
      const value = JSON.stringify(compactFeed(feed));
      const count = Math.ceil(value.length/CACHE_CHUNK_CHARS), prefix=`${key}:v4:${generation}:${code}`;
      feedChunks[code] = {count,prefix,checksum:sha256(value)};
      for (let i=0;i<count;i++) writes.push([`${prefix}:${i}`,value.slice(i*CACHE_CHUNK_CHARS,(i+1)*CACHE_CHUNK_CHARS)]);
    }
    const results=await Promise.allSettled(writes.map(([chunkKey,value])=>storage.setItem(chunkKey,value)));
    if(results.some(result=>result.status==='rejected')){
      await Promise.allSettled(writes.map(([chunkKey])=>storage.removeItem(chunkKey)));
      throw new Error("Camera cache write failed; previous cache retained");
    }
    try {
      await storage.setItem(key,JSON.stringify({version:4,feedChunks,countries,cov,stamp,countryVersions}));
    } catch (error) {
      await Promise.allSettled(writes.map(([chunkKey])=>storage.removeItem(chunkKey)));
      throw error;
    }
    if (previous?.version===3 || previous?.version===4) {
      const obsolete=[];
      for(const [code,entry] of Object.entries(previous.feedChunks)){
        const count=previous.version===3?entry:entry.count;
        const prefix=previous.version===3?`${key}:v3:${code}`:entry.prefix;
        for(let i=0;i<count;i++)obsolete.push(`${prefix}:${i}`);
      }
      await Promise.allSettled(obsolete.map(chunkKey=>storage.removeItem(chunkKey)));
    }
  });
  return cacheWrite;
}
