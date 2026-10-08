export const MAX_OFFLINE_COUNTRIES = 2;
export const INSTALLATION_KEY = 'camera_installation_v1';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function savedCountryCodes(feeds = {}) {return Object.keys(feeds).filter(code => /^[A-Z]{2}$/.test(code) && feeds[code]);}
export function canSaveCountry(feeds, code) {return !!feeds[code] || savedCountryCodes(feeds).length < MAX_OFFLINE_COUNTRIES;}
// Serialize first-run identity creation per storage instance. Never use a hardware/ad ID.
const pending = new WeakMap();
export function installationId(storage, randomUUID) {
 if (pending.has(storage)) return pending.get(storage);
 const work = (async () => {
  const saved = await storage.getItem(INSTALLATION_KEY);
  if (uuid.test(saved || '')) return saved;
  const id = randomUUID();
  if (!uuid.test(id)) throw new Error('Secure installation identity unavailable');
  await storage.setItem(INSTALLATION_KEY, id);
  return id;
 })();
 pending.set(storage, work);
 work.catch(() => pending.delete(storage));
 return work;
}
