import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Check, RotateCcw, Save, Trash2, AlertCircle } from 'lucide-react';
import { uploadRecording, RecordingMetadata, fetchRecordingsMetadata } from '../services/recordings';

interface RecorderProps {
  hour: string;
  index: number;
  onFinished?: () => void;
}

export function Recorder({ hour, index, onFinished }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'final' | 'requires_rerecord'>('final');
  const [isUploading, setIsUploading] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<RecordingMetadata | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    async function checkExisting() {
      const metadata = await fetchRecordingsMetadata();
      const filename = `${hour}_${index}.wav`;
      if (metadata[filename]) {
        setExistingMetadata(metadata[filename]);
        setStatus(metadata[filename].status);
      } else {
        setExistingMetadata(null);
      }
    }
    checkExisting();
    
    // Reset state when hour/index changes
    setAudioBlob(null);
    setPreviewUrl(null);
  }, [hour, index]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    if (!audioBlob) return;
    setIsUploading(true);
    const success = await uploadRecording(hour, index, audioBlob, status);
    setIsUploading(false);
    if (success) {
      setAudioBlob(null);
      setPreviewUrl(null);
      onFinished?.();
      // Refresh metadata
      const metadata = await fetchRecordingsMetadata();
      setExistingMetadata(metadata[`${hour}_${index}.wav`]);
    } else {
      alert('Failed to save recording.');
    }
  };

  const toggleStatus = () => {
    setStatus(prev => prev === 'final' ? 'requires_rerecord' : 'final');
  };

  return (
    <div className="flex flex-col gap-4 p-4 glass-panel border border-white/10 rounded-lg max-w-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-serif text-[var(--color-monastery-accent)]">Grabadora Lit├║rgica</h3>
        <div className="flex items-center gap-2">
          {existingMetadata && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              existingMetadata.status === 'requires_rerecord' 
                ? 'border-red-500/50 text-red-400 bg-red-500/10' 
                : 'border-green-500/50 text-green-400 bg-green-500/10'
            }`}>
              {existingMetadata.status === 'requires_rerecord' ? 'Re-grabar' : 'Listo'}
            </span>
          )}
        </div>
      </div>

      {!audioBlob && !isRecording && (
        <button
          onClick={startRecording}
          className="flex items-center justify-center gap-3 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors border border-red-500/30"
        >
          <Mic size={20} />
          <span className="font-medium uppercase tracking-widest text-xs">Comenzar Grabaci├│n</span>
        </button>
      )}

      {isRecording && (
        <button
          onClick={stopRecording}
          className="flex items-center justify-center gap-3 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors animate-pulse border border-white/30"
        >
          <Square size={20} fill="currentColor" />
          <span className="font-medium uppercase tracking-widest text-xs">Detener</span>
        </button>
      )}

      {audioBlob && !isRecording && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <audio src={previewUrl!} controls className="flex-1 h-8 opacity-70" />
            <button 
              onClick={() => { setAudioBlob(null); setPreviewUrl(null); }}
              className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
              title="Descartar"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={toggleStatus}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded border text-[10px] uppercase tracking-wider transition-colors ${
                status === 'requires_rerecord'
                  ? 'border-red-500/50 text-red-400 bg-red-500/10'
                  : 'border-white/20 text-white/70 hover:border-white/40'
              }`}
            >
              {status === 'requires_rerecord' ? <AlertCircle size={12} /> : <Check size={12} />}
              {status === 'requires_rerecord' ? 'Marcar para re-grabar' : 'Marcar como final'}
            </button>

            <button
              onClick={handleSave}
              disabled={isUploading}
              className="flex items-center justify-center gap-2 py-3 bg-[var(--color-monastery-accent)] text-black rounded font-bold text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {isUploading ? <RotateCcw size={16} className="animate-spin" /> : <Save size={16} />}
              {isUploading ? 'Guardando...' : 'Guardar Grabaci├│n'}
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] opacity-40 italic text-center">
        {hour} - Fragmento {index + 1}
      </p>
    </div>
  );
}
