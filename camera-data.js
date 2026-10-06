// Country feeds come from the existing Supabase camera-export endpoint.
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

// Country data can exceed Android's SQLite cursor window when provenance is included.
// Keep full provenance on the production export; persist compact trip data in small chunks.
export async function loadCameraCache(storage, key) {
  const raw = await storage.getItem(key);
  if (!raw) return null;
  const manifest = JSON.parse(raw);
  if (manifest.version !== 3) return manifest;
  const feeds = {};
  for (const [code, count] of Object.entries(manifest.feedChunks)) {
    const parts = await Promise.all(Array.from({length:count}, (_,i)=>storage.getItem(`${key}:v3:${code}:${i}`)));
    if (parts.some(part=>part == null)) throw new Error("Incomplete camera cache");
    feeds[code] = JSON.parse(parts.join(""));
  }
  return {...manifest,feeds};
}
let cacheWrite = Promise.resolve();
export function saveCameraCache(storage, key, {feeds,countries,cov,stamp}, selectedCountry) {
  cacheWrite = cacheWrite.catch(()=>{}).then(async () => {
    const previousRaw = await storage.getItem(key);
    const previous = previousRaw ? JSON.parse(previousRaw) : null;
    // Retain UA/PL fallback caches plus the selected trip country, within Android storage limits.
    const selected = [...new Set(["UA","PL",selectedCountry])].filter(code=>feeds[code]);
    const feedChunks = {};
    const writes = [];
    for (const code of selected) {
      const value = JSON.stringify(compactFeed(feeds[code]));
      const count = Math.ceil(value.length/CACHE_CHUNK_CHARS);
      feedChunks[code] = count;
      for (let i=0;i<count;i++) writes.push([`${key}:v3:${code}:${i}`,value.slice(i*CACHE_CHUNK_CHARS,(i+1)*CACHE_CHUNK_CHARS)]);
    }
    await Promise.all(writes.map(([chunkKey,value])=>storage.setItem(chunkKey,value)));
    await storage.setItem(key,JSON.stringify({version:3,feedChunks,countries,cov,stamp}));
    if (previous?.version===3) {
      const obsolete=[];
      for(const [code,count] of Object.entries(previous.feedChunks))
        for(let i=feedChunks[code]||0;i<count;i++)obsolete.push(`${key}:v3:${code}:${i}`);
      await Promise.all(obsolete.map(chunkKey=>storage.removeItem(chunkKey)));
    }
  });
  return cacheWrite;
}
