import { HourName } from './hours';
import { format } from 'date-fns';

const CACHE_KEY = 'monastic-hours-cache';
const FALLBACK_PRAYER = `# Universal Prayer

**V.** O God, come to my assistance.  
**R.** Lord, make haste to help me.

**Glory be to the Father, and to the Son, and to the Holy Spirit.**  
*As it was in the beginning, is now, and ever shall be, world without end. Amen.*

## Reading

*The Lord is my shepherd, I shall not want. He makes me lie down in green pastures; He leads me beside still waters. He restores my soul.*

## Responsory

**V.** In the midst of life we are in death.  
**R.** To whom shall we turn but to You, O Lord?

## Prayer

Lord God, Father of all mercy,  
look upon Your servants in their hour of need.  
When the words of men fail,  
let the silence of the heart speak.  
When the world grows dark,  
be our light and our consolation.  
Through Christ our Lord.  
**R.** Amen.

**V.** May the Lord bless us and keep us.  
**R.** And may His face shine upon us, now and forever.  
**Amen.**
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
