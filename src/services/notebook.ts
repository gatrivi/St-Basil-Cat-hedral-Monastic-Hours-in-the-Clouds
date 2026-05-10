import { rtdbGet, rtdbSet } from './firebase';

const LS_NOTEBOOK_KEY = 'cathedral-notebook-v1';

function getDeviceId(): string {
  let id = localStorage.getItem('cathedral-device-id');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('cathedral-device-id', id);
  }
  return id;
}

export async function loadNotebook(): Promise<string> {
  const deviceId = getDeviceId();

  // 1. Try RTDB
  try {
    const remote = await rtdbGet(`notebook/${deviceId}`);
    if (remote?.content !== undefined) {
      // Sync to localStorage as backup
      localStorage.setItem(LS_NOTEBOOK_KEY, remote.content);
      return remote.content;
    }
  } catch {
    // RTDB unreachable
  }

  // 2. Fallback to localStorage
  const local = localStorage.getItem(LS_NOTEBOOK_KEY);
  if (local !== null) return local;

  // 3. Default
  return "Write your thoughts here...\n\n- [ ] Morning prayer\n- [ ] Read the Gospel";
}

export async function saveNotebook(content: string): Promise<void> {
  const deviceId = getDeviceId();

  // 1. Write to RTDB
  try {
    await rtdbSet(`notebook/${deviceId}`, { content, updatedAt: Date.now() });
  } catch {
    // RTDB unreachable — still write local
  }

  // 2. Always mirror to localStorage
  localStorage.setItem(LS_NOTEBOOK_KEY, content);
}
