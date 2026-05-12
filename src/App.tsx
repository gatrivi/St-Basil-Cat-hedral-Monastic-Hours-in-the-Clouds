import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, Clock, AlertCircle, Copy, Check, Menu, X, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { getFragmentForHour, LiturgicalFragment, FRAGMENTS_BY_HOUR } from './lib/liturgicalFragments';
import { useBackground } from './lib/backgrounds';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing } from './sacred/procedural-rose';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

function BackgroundLayers({ currentHour }: { currentHour: LiturgicalHour | null }) {
  const { currentSrc, previousSrc, isTransitioning } = useBackground(currentHour?.name ?? null);

  return (
    <div className="fixed inset-0 z-0">
      {/* Previous image (fades out) */}
      {previousSrc && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2500ms] ease-in-out"
          style={{
            backgroundImage: `url(${previousSrc})`,
            opacity: isTransitioning ? 0 : 1,
            transform: 'scale(1.05)',
          }}
        />
      )}
      {/* Current image (fades in) */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2500ms] ease-in-out"
        style={{
          backgroundImage: `url(${currentSrc})`,
          opacity: 1,
          transform: 'scale(1.05)',
        }}
      />
      {/* Dark atmospheric overlay ΓÇö always present for text legibility */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(42, 21, 16, 0.7) 0%, rgba(10, 5, 2, 0.92) 70%)',
        }}
      />
      {/* Subtle blur overlay */}
      <div className="absolute inset-0 backdrop-blur-[6px]" />
    </div>
  );
}

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
  const [fragment, setFragment] = useState<LiturgicalFragment | null>(null);
  const [fragmentIndex, setFragmentIndex] = useState(0);
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
  const touchStartX = useRef<number | null>(null);

  const lastPlayedHourRef = useRef<string | null>(null);

  const { init: initResonator, start: startResonator, stop: stopResonator, playBell: playResonatorBell, cleanup: cleanupResonator } = useCosmicResonator();
  const lastInteractionRef = useRef<number>(Date.now());
  const lastAutoRotationRef = useRef<number>(Date.now());

  // Keep a background-generated prayer for occasional use, but fragments are primary
  const [fullPrayerText, setFullPrayerText] = useState<string>('');

  const handleCopy = useCallback(() => {
    const textToCopy = fragment ? `${fragment.title}\n\n${fragment.text}` : '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [fragment]);

  // Update fragment based on current hour and manual index
  const updateFragment = useCallback((hour: LiturgicalHour | null, index: number) => {
    if (!hour) return;
    const fragments = FRAGMENTS_BY_HOUR[hour.name];
    if (!fragments || fragments.length === 0) {
      setFragment({ title: 'Oraci├│n', text: '**Am├⌐n.**' });
      return;
    }
    const safeIndex = ((index % fragments.length) + fragments.length) % fragments.length;
    setFragment(fragments[safeIndex]);
  }, []);

  const goToNextFragment = useCallback(() => {
    if (!currentHour) return;
    const fragments = FRAGMENTS_BY_HOUR[currentHour.name];
    if (!fragments) return;
    lastInteractionRef.current = Date.now();
    setFragmentIndex(prev => {
      const next = (prev + 1) % fragments.length;
      updateFragment(currentHour, next);
      return next;
    });
  }, [currentHour, updateFragment]);

  const goToPrevFragment = useCallback(() => {
    if (!currentHour) return;
    const fragments = FRAGMENTS_BY_HOUR[currentHour.name];
    if (!fragments) return;
    lastInteractionRef.current = Date.now();
    setFragmentIndex(prev => {
      const next = (prev - 1 + fragments.length) % fragments.length;
      updateFragment(currentHour, next);
      return next;
    });
  }, [currentHour, updateFragment]);

  // Auto-entry and Initial Load
  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);

    if (curr) {
      console.log(`[DEBUG] App: Initializing hands-free entry for ${curr.name}`);
      updateFragment(curr, 0);
      loadHourText(curr).then((text) => {
        if (text) {
          syncAndPlay(curr, now);
        }
      });
    }

    initResonator(!isMuted);
  }, []);

  // Detect user interaction to pause auto-rotation while reading
  useEffect(() => {
    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    const markActive = () => { lastInteractionRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, markActive));
  }, []);

  // Update clock, detect hour transitions, and auto-rotate fragments every 30s
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      const hourChanged = curr?.name !== currentHour?.name;
      setCurrentHour(curr);
      setNextHour(next);

      if (hourChanged && curr) {
        setFragmentIndex(0);
        updateFragment(curr, 0);
        lastAutoRotationRef.current = Date.now();
        // Auto-play logic for hour transitions
        if (!isPlaying && !isLoadingAudio && !isLoadingText) {
          const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
          if (lastPlayedHourRef.current !== hourId) {
            console.log(`[DEBUG] App: Transitioning to new hour ${curr.name}`);
            lastPlayedHourRef.current = hourId;
            playResonatorBell();
            playHour(curr);
          }
        }
        return;
      }

      // Auto-rotate fragment only if user seems idle (3+ min without interaction)
      // and 10+ min have passed since last auto-rotation
      const idleMs = Date.now() - lastInteractionRef.current;
      const sinceRotationMs = Date.now() - lastAutoRotationRef.current;
      if (curr && idleMs > 3 * 60 * 1000 && sinceRotationMs > 10 * 60 * 1000) {
        const fragments = FRAGMENTS_BY_HOUR[curr.name];
        if (fragments && fragments.length > 1) {
          setFragmentIndex(prev => {
            const nextIdx = (prev + 1) % fragments.length;
            updateFragment(curr, nextIdx);
            return nextIdx;
          });
          lastAutoRotationRef.current = Date.now();
        }
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [currentHour, isPlaying, isLoadingAudio, isLoadingText, updateFragment]);

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
      setFullPrayerText(text);
      return text;
    } catch (err) {
      console.warn('[DEBUG] App: generatePrayerText failed');
      setUsingFallback(true);
      setError('Los monjes estan en contemplacion silenciosa. Mostrando la ultima oracion disponible.');
      return '';
    } finally {
      setIsLoadingText(false);
    }
  };

  const playHour = async (hour: LiturgicalHour, fadeIn: boolean = false, startOffset: number = 0) => {
    console.log(`[DEBUG] App: playHour started for ${hour.name} at offset ${startOffset}s`);
    if (isPlaying || isLoadingAudio) return;

    let text = fullPrayerText || (fragment ? `${fragment.title}. ${fragment.text}` : '');
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
              startResonator();
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
    playResonatorBell();
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
          if (e.ctrlKey || e.metaKey) break;
          handleCopy();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextFragment();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevFragment();
          break;
        case 'r':
        case 'R':
          if (currentHour) loadHourText(currentHour);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isLoadingAudio, isLoadingText, isMuted, currentHour, handleCopy, goToNextFragment, goToPrevFragment]);

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
  }, [isPlaying, currentHour, fullPrayerText, autoplayBlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      if (bellRef.current) bellRef.current.muted = next;
      if (next) {
        stopResonator();
      } else if (isPlaying) {
        startResonator();
      }
      return next;
    });
  }, [isPlaying, startResonator, stopResonator]);

  // Console Watermark
  useEffect(() => {
    console.log(
      "%c Γ£á HORAS MON├üSTICAS %c por GATRIVI \n%cObra original en gatrivi.com | @gatrivi en redes",
      "color: #d4af37; font-size: 20px; font-weight: bold; font-family: serif;",
      "color: #888; font-size: 14px; font-family: serif;",
      "color: #666; font-size: 12px; font-style: italic;"
    );
  }, []);

  // Cleanup resonator on unmount
  useEffect(() => {
    return () => cleanupResonator();
  }, [cleanupResonator]);

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
      {/* Dynamic Background with crossfade */}
      <BackgroundLayers currentHour={currentHour} />

      {/* Hidden Audio Elements */}
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio
        ref={audioRef}
        onEnded={() => { setIsPlaying(false); stopResonator(); }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          if (audio.duration) {
            setAudioProgress(audio.currentTime);
            setAudioDuration(audio.duration);
          }
        }}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
      />

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--color-monastery-accent)]/10 h-14 flex items-center justify-between px-4">
        <button
          onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }}
          className="p-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="text-center">
          <p className="font-serif text-lg text-[var(--color-monastery-accent)] leading-none">
            {currentHour?.name || '...'}
          </p>
          <p className="text-[10px] uppercase tracking-widest opacity-50">
            {format(currentTime, 'HH:mm')}
          </p>
        </div>
        <div className="w-8" /> {/* spacer */}
      </header>

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40 w-72 glass-panel border-r border-[var(--color-monastery-accent)]/10
          flex flex-col transition-transform duration-500 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          pt-14 md:pt-0
        `}
      >
        {/* Clock - hidden on mobile since it's in header */}
        <div className="hidden md:block p-6 text-center border-b border-white/5">
          <motion.h1
            key={format(currentTime, 'HH:mm')}
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5 }}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
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
          <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Pr├│xima Hora</p>
          <AnimatePresence mode="wait">
            <motion.div
              key={nextHour?.name || 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
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
      <main
        className="flex-1 flex flex-col relative min-w-0 pt-14 md:pt-0"
        onTouchStart={(e) => { touchStartX.current = e.changedTouches[0].screenX; }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const diff = touchStartX.current - e.changedTouches[0].screenX;
          if (Math.abs(diff) > 50) {
            if (diff > 0) goToNextFragment();
            else goToPrevFragment();
          }
          touchStartX.current = null;
        }}
      >
        {/* Prayer Text */}
        <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 md:p-12 lg:p-20">
          <div className="w-full max-w-3xl relative group">
            {/* Subtle copy button */}
            {fragment && (
              <button
                onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                className="absolute -top-2 right-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-all p-2 z-10"
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
                  <span>{error || 'Mostrando la ├║ltima oraci├│n disponible'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Fragment navigation ΓÇö subtle, hover-only */}
            {currentHour && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevFragment(); }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-6 opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-all p-3"
                  title="Fragmento anterior (ΓåÉ)"
                >
                  <span className="text-2xl font-serif">ΓÇ╣</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextFragment(); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-6 opacity-0 group-hover:opacity-30 hover:!opacity-100 transition-all p-3"
                  title="Siguiente fragmento (ΓåÆ)"
                >
                  <span className="text-2xl font-serif">ΓÇ║</span>
                </button>
                {/* Fragment counter */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-40 transition-opacity">
                  {FRAGMENTS_BY_HOUR[currentHour.name]?.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-300 ${i === fragmentIndex ? 'w-4 bg-[var(--color-monastery-accent)]' : 'w-1 bg-white/30'}`}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Fragment display with gentle crossfade */}
            <AnimatePresence mode="sync">
              {fragment ? (
                <motion.div
                  key={`${currentHour?.name}-${fragment.title}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <h2 className="font-serif text-3xl md:text-4xl text-[var(--color-monastery-accent)] text-center">
                      {fragment.title}
                    </h2>
                    {fragment.subtitle && (
                      <p className="text-[10px] md:text-xs uppercase tracking-[0.3em] opacity-50 text-center">
                        {fragment.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="font-serif text-lg md:text-xl leading-[1.8] md:leading-[1.9] text-center markdown-body">
                    <Markdown>{fragment.text}</Markdown>
                  </div>
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
            {isLoadingAudio || (isLoadingText && !fragment) ? (
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

          {/* Sacred symbol — subtle, in the audio bar */}
          <div className="hidden md:block opacity-30 hover:opacity-70 transition-opacity shrink-0">
            <SacredDrawing symbolKey="cross" progress={isPlaying ? 0.8 : 0.3} size={20} />
          </div>

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
