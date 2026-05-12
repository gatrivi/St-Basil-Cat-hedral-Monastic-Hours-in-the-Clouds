import { HourName } from './hours';
import { format } from 'date-fns';

const CACHE_KEY = 'monastic-hours-cache';
const FALLBACK_PRAYER = `# Oración Universal

**V.** Dios mío, ven en mi auxilio.  
**R.** Señor, date prisa en socorrerme.

**Gloria al Padre, y al Hijo, y al Espíritu Santo.**  
*Como era en el principio, ahora y siempre, por los siglos de los siglos. Amén.*

## Lectura

*El Señor es mi pastor, nada me falta. En verdes praderas me hace descansar; hacia aguas tranquilas me conduce. Fortalece mi alma.*

## Responsorio

**V.** En medio de la vida estamos en la muerte.  
**R.** ¿A quién acudiremos sino a Ti, Señor?

## Oración

Señor Dios, Padre de toda misericordia,  
mira a tus siervos en su hora de necesidad.  
Cuando las palabras de los hombres fallan,  
que el silencio del corazón hable.  
Cuando el mundo se oscurece,  
se nuestra luz y nuestra consolación.  
Por Cristo nuestro Señor.  
**R.** Amén.

**V.** El Señor nos bendiga y nos guarde.  
**R.** Y haga brillar su rostro sobre nosotros, ahora y por siempre.  
**Amén.**
`;

interface CacheEntry {
  text: string;
  timestamp: number;
}

interface PrayerCache {
  entries: Record<string, CacheEntry>;
  lastSuccessful?: { text: string; timestamp: number; hour: HourName };
}

function readCache(): PrayerCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt cache
  }
  return { entries: {} };
}

function writeCache(cache: PrayerCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

export function getCacheKey(hour: HourName, date: Date): string {
  return `${format(date, 'yyyy-MM-dd')}-${hour}`;
}

export function getCachedPrayer(hour: HourName, date: Date): string | undefined {
  const cache = readCache();
  const key = getCacheKey(hour, date);
  return cache.entries[key]?.text ?? cache.lastSuccessful?.text;
}

export function getAnyCachedPrayer(): string | undefined {
  const cache = readCache();
  return cache.lastSuccessful?.text;
}

export function savePrayerToCache(hour: HourName, date: Date, text: string) {
  const cache = readCache();
  const key = getCacheKey(hour, date);
  cache.entries[key] = { text, timestamp: Date.now() };
  cache.lastSuccessful = { text, timestamp: Date.now(), hour };
  writeCache(cache);
}

export function getFallbackPrayer(): string {
  return FALLBACK_PRAYER;
}
