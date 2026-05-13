import { rtdbGet, rtdbSet, uploadAudio } from './firebase';

export interface RecordingMetadata {
  hour: string;
  index?: number;
  status: 'draft' | 'final' | 'requires_rerecord';
  updatedAt: string;
  url: string;
}

export type MetadataMap = Record<string, RecordingMetadata>;

export async function fetchRecordingsMetadata(): Promise<MetadataMap> {
  try {
    const data = await rtdbGet('recordings_metadata');
    return data || {};
  } catch (err) {
    console.error('[Cathedral] Failed to fetch recordings metadata:', err);
    return {};
  }
}

// ─── Legacy fragment-level recordings ───

export async function uploadRecording(
  hour: string,
  index: number,
  blob: Blob,
  status: 'draft' | 'final' | 'requires_rerecord' = 'final'
): Promise<boolean> {
  try {
    const filename = `${hour}_${index}.wav`;
    const path = `recordings/${filename}`;
    
    const url = await uploadAudio(path, blob);
    
    const metadata = await fetchRecordingsMetadata();
    metadata[filename] = {
      hour,
      index,
      status,
      updatedAt: new Date().toISOString(),
      url
    };
    
    await rtdbSet('recordings_metadata', metadata);
    return true;
  } catch (err) {
    console.error('[Cathedral] Failed to upload recording to Firebase:', err);
    return false;
  }
}

export async function getRecordingUrl(hour: string, index: number): Promise<string | null> {
  const metadata = await fetchRecordingsMetadata();
  const filename = `${hour}_${index}.wav`;
  const entry = metadata[filename];
  return entry?.status === 'final' ? entry.url : null;
}

// ─── Prayer-level recordings (hour only) ───

export async function uploadPrayerRecording(
  hour: string,
  blob: Blob,
  status: 'draft' | 'final' | 'requires_rerecord' = 'final'
): Promise<boolean> {
  try {
    const filename = `${hour}.wav`;
    const path = `recordings/${filename}`;
    
    const url = await uploadAudio(path, blob);
    
    const metadata = await fetchRecordingsMetadata();
    metadata[filename] = {
      hour,
      status,
      updatedAt: new Date().toISOString(),
      url
    };
    
    await rtdbSet('recordings_metadata', metadata);
    return true;
  } catch (err) {
    console.error('[Cathedral] Failed to upload prayer recording to Firebase:', err);
    return false;
  }
}

export async function getPrayerRecordingUrl(hour: string): Promise<string | null> {
  const metadata = await fetchRecordingsMetadata();
  const filename = `${hour}.wav`;
  const entry = metadata[filename];
  return entry?.status === 'final' ? entry.url : null;
}

export async function getPrayerRecordingMetadata(hour: string): Promise<RecordingMetadata | null> {
  const metadata = await fetchRecordingsMetadata();
  const filename = `${hour}.wav`;
  return metadata[filename] || null;
}
