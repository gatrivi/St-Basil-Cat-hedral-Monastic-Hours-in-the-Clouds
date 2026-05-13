import { rtdbGet, rtdbSet, uploadAudio } from './firebase';

export interface RecordingMetadata {
  hour: string;
  index: number;
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

export async function uploadRecording(
  hour: string,
  index: number,
  blob: Blob,
  status: 'draft' | 'final' | 'requires_rerecord' = 'final'
): Promise<boolean> {
  try {
    const filename = `${hour}_${index}.wav`;
    const path = `recordings/${filename}`;
    
    // 1. Upload to Firebase Storage
    const url = await uploadAudio(path, blob);
    
    // 2. Update RTDB Metadata
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
  return metadata[filename]?.url || null;
}
