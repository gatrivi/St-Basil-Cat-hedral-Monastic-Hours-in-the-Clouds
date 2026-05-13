import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Save, Trash2, AlertCircle, Check, RotateCcw, X } from 'lucide-react';
import { uploadPrayerRecording, getPrayerRecordingMetadata, RecordingMetadata } from '../services/recordings';

interface RecorderProps {
  hour: string;
  index: number;
  prayerText?: string;
  onFinished?: () => void;
  onClose?: () => void;
}

export function Recorder({ hour, index, prayerText, onFinished, onClose }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft' | 'final' | 'requires_rerecord'>('final');
  const [isUploading, setIsUploading] = useState(false);
  const [existingMetadata, setExistingMetadata] = useState<RecordingMetadata | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    async function checkExisting() {
      const metadata = await getPrayerRecordingMetadata(hour);
      if (metadata) {
        setExistingMetadata(metadata);
        setStatus(metadata.status);
      } else {
        setExistingMetadata(null);
      }
    }
    checkExisting();
    
    // Reset state when hour changes
    setAudioBlob(null);
    setPreviewUrl(null);
    setRecordingDuration(0);
  }, [hour]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();
      setRecordingDuration(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
          durationTimerRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('No se pudo acceder al micr├│fono.');
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
    const success = await uploadPrayerRecording(hour, audioBlob, status);
    setIsUploading(false);
    if (success) {
      setAudioBlob(null);
      setPreviewUrl(null);
      setRecordingDuration(0);
      onFinished?.();
      // Refresh metadata
      const metadata = await getPrayerRecordingMetadata(hour);
      setExistingMetadata(metadata);
    } else {
      alert('Error al guardar la grabaci├│n.');
    }
  };

  const toggleStatus = () => {
    setStatus(prev => prev === 'final' ? 'requires_rerecord' : 'final');
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-5 glass-panel border border-white/10 rounded-lg max-w-md w-[90vw]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-serif text-[var(--color-monastery-accent)]">Grabadora Lit├║rgica</h3>
        <div className="flex items-center gap-2">
          {existingMetadata && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              existingMetadata.status === 'requires_rerecord' 
                ? 'border-red-500/50 text-red-400 bg-red-500/10' 
                : 'border-green-500/50 text-green-400 bg-green-500/10'
            }`}>
              {existingMetadata.status === 'requires_rerecord' ? 'Re-grabar' : 'Grabado'}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
              title="Cerrar"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-[10px] opacity-50 uppercase tracking-wider">
        {hour} {index > 0 ? `┬╖ Fragmento ${index + 1}` : ''}
      </p>

      {prayerText && (
        <div className="max-h-24 overflow-y-auto text-[11px] opacity-60 leading-relaxed p-2 bg-black/20 rounded border border-white/5">
          {prayerText.length > 300 ? prayerText.slice(0, 300) + '...' : prayerText}
        </div>
      )}

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
          <span className="font-medium uppercase tracking-widest text-xs">Detener ({formatDuration(recordingDuration)})</span>
        </button>
      )}

      {audioBlob && !isRecording && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <audio src={previewUrl!} controls className="flex-1 h-8 opacity-70" />
            <button 
              onClick={() => { setAudioBlob(null); setPreviewUrl(null); setRecordingDuration(0); }}
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
        Esta grabaci├│n se reproducir├í autom├íticamente la pr├│xima vez que llegue {hour}
      </p>
    </div>
  );
}
