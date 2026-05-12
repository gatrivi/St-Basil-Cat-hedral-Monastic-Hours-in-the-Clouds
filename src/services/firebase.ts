import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, child } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBjU2aqXQF2k5Hd83KtZvCHW7gC6N1Sp8I",
  authDomain: "cathedral-devtrivi.firebaseapp.com",
  projectId: "cathedral-devtrivi",
  storageBucket: "cathedral-devtrivi.firebasestorage.app",
  messagingSenderId: "530490415634",
  appId: "1:530490415634:web:9cadab12e84064b51196cb",
  databaseURL: "https://cathedral-devtrivi-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);

// ─── RTDB Helpers ───

export async function rtdbGet(path: string): Promise<any | null> {
  const snap = await get(child(ref(db), path));
  return snap.exists() ? snap.val() : null;
}

export async function rtdbSet(path: string, value: any): Promise<void> {
  await set(ref(db, path), value);
}

// ─── Storage Helpers ───

export async function uploadAudio(path: string, blob: Blob): Promise<string> {
  const ref = storageRef(storage, path);
  await uploadBytes(ref, blob);
  return getDownloadURL(ref);
}
