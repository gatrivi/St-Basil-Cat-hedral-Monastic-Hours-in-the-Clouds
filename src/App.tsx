import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, Clock, BookOpen, AlertCircle, Copy, Check, Menu, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { getCachedPrayer, getAnyCachedPrayer, savePrayerToCache, getFallbackPrayer } from './lib/prayerCache';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

export default function App() {
  console.log('[DEBUG] App: Component Rendering');

  useEffect(() => {
    const bg = getComputedStyle(document.body).getPropertyValue('--color-monastery-bg');
    console.log('[DEBUG] App: CSS Variable --color-monastery-bg:', bg || 'NOT FOUND');
    const isTailwindLoaded = getComputedStyle(document.documentElement).getPropertyValue('--font-sans');
    console.log('[DEBUG] App: Tailwind Font Sans loaded:', !!isTailwindLoaded);
  }, []);

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  const lastPlayedHourRef = useRef<string | null>(null);

  const handleCopy = useCallback(() => {
    if (!prayerText) return;
    navigator.clipboard.writeText(prayerText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [prayerText]);

  // Auto-entry and Initial Load
  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);

    if (curr) {
      console.log(`[DEBUG] App: Initializing hands-free entry for ${curr.name}`);
      // Try cache first for instant display
      const cached = getCachedPrayer(curr.name, now);
      if (cached) {
        setPrayerText(cached);
        setUsingFallback(false);
      }
      loadHourText(curr).then((text) => {
        if (text) {
          syncAndPlay(curr, now);
        }
      });
    }
  }, []);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      setCurrentHour(curr);
      setNextHour(next);

      // Auto-play logic for hour transitions
      if (curr && !isPlaying && !isLoadingAudio && !isLoadingText) {
        const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
        if (lastPlayedHourRef.current !== hourId) {
          console.log(`[DEBUG] App: Transitioning to new hour ${curr.name}`);
          lastPlayedHourRef.current = hourId;
          bellRef.current?.play().catch(e => console.warn("Bell play failed", e));
          playHour(curr);
        }
      }
    }, 10000); // Check every 10s for tighter sync

    return () => clearInterval(timer);
  }, [isPlaying, isLoadingAudio, isLoadingText]);

  const syncAndPlay = async (hour: LiturgicalHour, now: Date) => {
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const offsetSeconds = (currentMinutes * 60) + currentSeconds;

    console.log(`[DEBUG] App: Syncing to offset ${offsetSeconds}s for ${hour.name}`);
    await playHour(hour, false, offsetSeconds);
  };

  const loadHourText = async (hour: LiturgicalHour) => {
    console.log(`[DEBUG] App: loadHourText started for ${hour.name}`);
    if (isLoadingText) return;
    setIsLoadingText(true);
    setError(null);
    setUsingFallback(false);
    try {
      const text = await generatePrayerText(hour.name, new Date());
      setPrayerText(text);
      savePrayerToCache(hour.name, new Date(), text);
      return text;
    } catch (err) {
      console.warn('[DEBUG] App: API failed, falling back to cache or default prayer');
      // Don't clear existing prayerText — keep whatever is on screen
      const cached = getCachedPrayer(hour.name, new Date()) ?? getAnyCachedPrayer();
      if (cached) {
        setPrayerText(cached);
        setUsingFallback(true);
        return cached;
      }
      // Ultimate fallback: built-in timeless prayer
      const fallback = getFallbackPrayer();
      setPrayerText(fallback);
      setUsingFallback(true);
      setError('Los monjes están en contemplación silenciosa. Mostrando la última oración disponible.');
      return fallback;
    } finally {
      setIsLoadingText(false);
    }
  };

  const playHour = async (hour: LiturgicalHour, fadeIn: boolean = false, startOffset: number = 0) => {
    console.log(`[DEBUG] App: playHour started for ${hour.name} at offset ${startOffset}s`);
    if (isPlaying || isLoadingAudio) return;

    let text = prayerText;
    if (!text || (currentHour && hour.name !== currentHour.name)) {
      text = await loadHourText(hour) || '';
      if (!text) return;
    }

    setIsLoadingAudio(true);
    try {
      const audioBase64 = await generatePrayerAudio(text);
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.muted = isMuted;

        audioRef.current.onloadedmetadata = () => {
          if (audioRef.current) {
            const duration = audioRef.current.duration;
            if (startOffset > 0 && startOffset < duration) {
              audioRef.current.currentTime = startOffset;
            } else if (startOffset >= duration) {
              console.log('[DEBUG] App: Offset exceeds audio duration, skipping playback');
              setIsLoadingAudio(false);
              return;
            }

            audioRef.current.play().then(() => {
              setIsPlaying(true);
              setIsLoadingAudio(false);
              setAutoplayBlocked(false);
            }).catch(err => {
              console.warn('[DEBUG] App: Autoplay blocked', err);
              setIsLoadingAudio(false);
              setAutoplayBlocked(true);
            });
          }
        };
      }

    } catch (err) {
      console.error('[DEBUG] App: playHour error:', err);
      setIsLoadingAudio(false);
    }
  };

  const handleManualStart = () => {
    setAutoplayBlocked(false);
    bellRef.current?.play().catch(e => console.warn("Bell play failed", e));
    if (currentHour) {
      const now = new Date();
      syncAndPlay(currentHour, now);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        case 'c':
        case 'C':
          if (e.ctrlKey || e.metaKey) break; // Allow standard copy
          handleCopy();
          break;
        case 'r':
        case 'R':
          if (currentHour) loadHourText(currentHour);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isLoadingAudio, isLoadingText, isMuted, currentHour, handleCopy]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (autoplayBlocked) {
      handleManualStart();
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (currentHour) {
      playHour(currentHour);
    }
  }, [isPlaying, currentHour, prayerText, autoplayBlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      if (bellRef.current) bellRef.current.muted = next;
      return next;
    });
  }, []);

  // Console Watermark
  useEffect(() => {
    console.log(
      "%c ✠ HORAS MONÁSTICAS %c por GATRIVI \n%cObra original en gatrivi.com | @gatrivi en redes",
      "color: #d4af37; font-size: 20px; font-weight: bold; font-family: serif;",
      "color: #888; font-size: 14px; font-family: serif;",
      "color: #666; font-size: 12px; font-style: italic;"
    );
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      className="h-screen flex overflow-hidden relative cursor-default"
      onClick={() => { if (autoplayBlocked) handleManualStart(); }}
    >
      <div className="atmosphere" />

      {/* Hidden Audio Elements */}
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) {
            setAudioProgress(audio.currentTime);
            setAudioDuration(audio.duration);
          }
          // TODO: Implementar resaltado de texto sincronizado con la reproducción de audio.
          // Esto requiere marcas de tiempo a nivel de palabra (o frase) de la API TTS
          // o una estrategia de alineación del lado del cliente (por ejemplo, velocidad de lectura estimada).
          // Una vez disponible, mapear audio.currentTime a la palabra/frase correspondiente
          // en prayerText y aplicar una clase de resaltado (por ejemplo, text-[var(--color-monastery-accent)]).
        }}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
      />

      {/* Mobile Sidebar Toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
        className="md:hidden fixed top-4 left-4 z-50 glass-panel p-2 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-72 glass-panel border-r border-[var(--color-monastery-accent)]/10
          flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Clock */}
        <div className="p-6 text-center border-b border-white/5">
          <motion.h1
            key={format(currentTime, 'HH:mm')}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            className="font-serif text-4xl text-[var(--color-monastery-accent)]"
          >
            {format(currentTime, 'HH:mm')}
          </motion.h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60 mt-1">
            {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
          </p>
        </div>

        {/* Current Hour */}
        <div className="p-5 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2 flex items-center gap-1.5">
            <Clock size={10} /> Hora Actual
          </p>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentHour?.name || 'empty'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-serif text-2xl text-[var(--color-monastery-accent)]">
                {currentHour?.name || '...'}
              </h2>
              <p className="text-xs opacity-70 mt-0.5">{currentHour?.description}</p>
              <p className="font-mono text-xs opacity-50 mt-1">{currentHour?.timeString}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Hour */}
        <div className="p-5 border-b border-white/5 opacity-70">
          <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Próxima Hora</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={nextHour?.name || 'empty'}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="font-serif text-xl">{nextHour?.name || '...'}</h2>
              <p className="font-mono text-xs opacity-50 mt-1">{nextHour?.timeString}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Schedule */}
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[10px] uppercase tracking-widest opacity-50 mb-3">Ritmo Diario</p>
          <div className="space-y-1">
            {HOURS_SCHEDULE.map((h) => (
              <div
                key={h.name}
                className={`
                  flex justify-between items-center px-3 py-2 rounded text-sm transition-colors
                  ${currentHour?.name === h.name
                    ? 'bg-[var(--color-monastery-accent)] text-black'
                    : 'hover:bg-white/5 opacity-70'
                  }
                `}
              >
                <span className="font-serif">{h.name}</span>
                <span className="font-mono text-xs opacity-70">{h.timeString}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 text-center opacity-40 hover:opacity-100 transition-opacity duration-500">
          <p className="text-[10px] uppercase tracking-widest">
            <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">
              Gatrivi
            </a>
            <span className="mx-2 opacity-50">|</span>
            <span className="opacity-50">v{__APP_VERSION__}</span>
          </p>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Prayer Text */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 md:p-12 lg:p-20">
          <div className="w-full max-w-3xl relative group">
            {/* Subtle copy button */}
            {prayerText && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="absolute -top-2 right-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-all p-2"
                title="Copiar Liturgia (C)"
              >
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}

            {/* Loading / Scribing indicator */}
            {isLoadingText && (
              <div className="flex items-center justify-center gap-3 opacity-50 mb-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
                >
                  <Bell size={16} />
                </motion.div>
                <span className="text-[10px] uppercase tracking-[0.3em]">Escribiendo...</span>
              </div>
            )}

            {/* Subtle fallback indicator */}
            <AnimatePresence>
              {usingFallback && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-monastery-accent)] opacity-70"
                >
                  <AlertCircle size={10} />
                  <span>{error || 'Mostrando la última oración disponible'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {prayerText ? (
                <motion.div
                  key="text"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2 }}
                  className="font-serif text-xl md:text-2xl leading-[1.8] md:leading-[1.9] text-center markdown-body"
                >
                  {/* TODO: Cuando se implemente el resaltado de audio, envolver cada palabra/frase
                      en un span y alternar una clase de resaltado basada en el progreso del audio. */}
                  <Markdown>{prayerText}</Markdown>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center opacity-30 font-serif italic gap-4 py-20"
                >
                  <Bell size={24} />
                  <p className="text-lg">Entrando a la Capilla...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Minimal Audio Bar */}
        <div
          className={`
            h-12 glass-panel border-t border-[var(--color-monastery-accent)]/10
            flex items-center px-4 md:px-6 gap-3 md:gap-4
            opacity-40 hover:opacity-90 transition-opacity duration-500
            ${autoplayBlocked ? 'opacity-70' : ''}
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Play / Pause */}
          <button
            onClick={togglePlayPause}
            disabled={isLoadingAudio || isLoadingText}
            className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 hover:border-[var(--color-monastery-accent)] hover:text-[var(--color-monastery-accent)] transition-all disabled:opacity-30 shrink-0"
            title="Reproducir / Pausar (Espacio)"
          >
            {isLoadingAudio || (isLoadingText && !prayerText) ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              >
                <Bell size={12} />
              </motion.div>
            ) : isPlaying ? (
              <Pause size={12} />
            ) : (
              <Play size={12} className="ml-0.5" />
            )}
          </button>

          {/* Mute */}
          <button
            onClick={toggleMute}
            className="hover:text-[var(--color-monastery-accent)] transition-colors shrink-0 opacity-70 hover:opacity-100"
            title="Silenciar (M)"
          >
            {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>

          {/* Progress */}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="text-[10px] font-mono opacity-50 w-8 text-right shrink-0 hidden sm:inline">
              {formatTime(audioProgress)}
            </span>
            <div className="flex-1 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[var(--color-monastery-accent)]"
                style={{ width: `${audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-mono opacity-50 w-8 shrink-0 hidden sm:inline">
              {formatTime(audioDuration)}
            </span>
          </div>

          {/* Autoplay blocked hint */}
          {autoplayBlocked && !isPlaying && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[10px] uppercase tracking-widest text-[var(--color-monastery-accent)] shrink-0"
            >
              Toca para comenzar
            </motion.span>
          )}
        </div>
      </main>
    </div>
  );
}
