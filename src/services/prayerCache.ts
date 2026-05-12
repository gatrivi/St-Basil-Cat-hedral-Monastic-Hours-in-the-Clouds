import { rtdbGet, rtdbSet } from './firebase';
import { HourName } from '../lib/hours';

const LS_KEY = 'cathedral-prayers-v1';

function localKey(hour: HourName, date: string): string {
  return `${hour}-${date}`;
}

export async function getCachedPrayer(hour: HourName, date: string): Promise<string | null> {
  // 1. Try RTDB first (shared across devices)
  try {
    const remote = await rtdbGet(`prayers/${date}/${hour}`);
    if (remote?.text) return remote.text as string;
  } catch (e) {
    // RTDB unreachable — fall through
  }

  // 2. Fallback to localStorage (offline)
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw);
    return cache[localKey(hour, date)] || null;
  } catch {
    return null;
  }
}

export async function setCachedPrayer(hour: HourName, date: string, text: string): Promise<void> {
  const payload = { text, createdAt: Date.now() };

  // 1. Write to RTDB
  try {
    await rtdbSet(`prayers/${date}/${hour}`, payload);
  } catch (e) {
    // RTDB unreachable — still write local
  }

  // 2. Always mirror to localStorage for offline use
  try {
    const raw = localStorage.getItem(LS_KEY);
    const cache = raw ? JSON.parse(raw) : {};
    cache[localKey(hour, date)] = text;
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      delete cache[keys[0]];
    }
    localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

// ─── Audio metadata (URLs to hosted files, not base64 blobs) ───

export async function getCachedAudio(hour: HourName, date: string): Promise<string | null> {
  try {
    const remote = await rtdbGet(`audio/${date}/${hour}`);
    return remote?.url || null;
  } catch {
    return null;
  }
}

export async function setCachedAudio(hour: HourName, date: string, url: string): Promise<void> {
  try {
    await rtdbSet(`audio/${date}/${hour}`, { url, createdAt: Date.now() });
  } catch {
    // ignore
  }
}
