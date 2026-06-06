import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, AlertCircle, Copy, Check, Menu, X, Mic, Waves, Eye, EyeOff } from 'lucide-react';
import { format, isAfter, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, LiturgicalHour, HourName } from './lib/hours';
import { LiturgicalFragment } from './lib/liturgicalFragments';
import { DAY_SLOTS, getDayPosition } from './lib/liturgicalDay';
import { APP_NAME, APP_TAGLINE } from './lib/brand';
import { DayPlaylistSidebar } from './components/DayPlaylistSidebar';
import { PrayerTimingBar } from './components/PrayerTimingBar';
import { useBackground } from './lib/backgrounds';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing } from './sacred/procedural-rose';
import { generatePrayerText, generateAudioOrFallback, SpeechController } from './services/gemini';
import { Recorder } from './components/Recorder';
import { AutoPager } from './components/AutoPager';
import { IncenseTrail } from './components/IncenseTrail';
import { UpdateBanner } from './components/UpdateBanner';
import { getPrayerRecordingMetadata } from './services/recordings';
import { useUpdateCheck } from './hooks/useUpdateCheck';
import { perfLog } from './lib/perfLog';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;
const VERSION = '1.3.8';

type FontScale = 'sm' | 'md' | 'lg';
const FONT_SCALE_KEY = 'cathedral-font-scale'; 

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

// ─── Temporal Color Mapping ───
const HOUR_COLORS: Record<HourName, string> = {
  'Maitines': '#4a4e69', // Deep Indigo
  'Laudes': '#f28482',   // Soft Rose
  'Tercia': '#f6bd60',   // Amber
  'Sexta': '#d4af37',    // Gold
  'Nona': '#b5838d',     // Muted Crimson
  'Vísperas': '#6d597a',  // Dusk Violet
  'Completas': '#22223b', // Midnight Blue
};

// ─── Hard Reset for Smart TVs ───
const rechargeChapel = () => {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) { /* ignore */ }
  window.location.reload();
};

function useParallax() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setOffset({ x, y });
    };
    window.addEventListener('mousemove', handleMouse);
    return () => window.removeEventListener('mousemove', handleMouse);
  }, []);

  return offset;
}

function LightShafts() {
  return (
    <div className="light-shafts">
      <div className="light-shaft" />
    </div>
  );
}

function DustMotes() {
  const motes = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    duration: `${15 + Math.random() * 20}s`,
    delay: `${Math.random() * -20}s`,
  }));

  return (
    <div className="dust-motes">
      {motes.map(m => (
        <div
          key={m.id}
          className="mote"
          style={{
            left: m.left,
            top: m.top,
            animationDuration: m.duration,
            animationDelay: m.delay,
          } as any}
        />
      ))}
    </div>
  );
}

function CelestialClockwork() {
  return (
    <div className="celestial-container">
      <div className="celestial-gear" style={{ animationDuration: '360s', opacity: 0.5 }}>
        <SacredDrawing symbolKey="luminoso_4" size={800} />
      </div>
      <div className="celestial-gear" style={{ animationDuration: '240s', animationDirection: 'reverse', opacity: 0.3 }}>
        <SacredDrawing symbolKey="glorioso_5" size={600} />
      </div>
      <div className="celestial-gear" style={{ animationDuration: '600s', opacity: 0.2 }}>
        <SacredDrawing symbolKey="luminoso_4" size={1200} />
      </div>
    </div>
  );
}

function BackgroundLayers({ currentHour }: { currentHour: LiturgicalHour | null }) {
  const { currentSrc, previousSrc, isTransitioning } = useBackground(currentHour?.name ?? null);
  const parallax = useParallax();

  return (
    <div className="fixed inset-0 z-0">
      {previousSrc && (
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2500ms] ease-in-out"
          style={{
            backgroundImage: `url(${previousSrc})`,
            opacity: isTransitioning ? 0 : 1,
            transform: `scale(1.1) translate(${parallax.x * 0.5}px, ${parallax.y * 0.5}px)`,
          }}
        />
      )}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-[2500ms] ease-in-out"
        style={{
          backgroundImage: `url(${currentSrc})`,
          opacity: 1,
          transform: `scale(1.1) translate(${parallax.x * 0.5}px, ${parallax.y * 0.5}px)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle at 50% 30%, rgba(42, 21, 16, 0.7) 0%, rgba(10, 5, 2, 0.92) 70%)',
        }}
      />
      <div className="absolute inset-0 backdrop-blur-[6px]" />
    </div>
  );
}

export default function App() {
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
  const [showRecorder, setShowRecorder] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(() => {
    try { return localStorage.getItem('cathedral-ambient') === 'true'; } catch { return false; }
  });
  const [hasRecording, setHasRecording] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [transportOpen, setTransportOpen] = useState(false);
  const [fontScale, setFontScale] = useState<FontScale>(() => {
    try {
      const v = localStorage.getItem(FONT_SCALE_KEY);
      if (v === 'sm' || v === 'md' || v === 'lg') return v;
    } catch { /* ignore */ }
    return 'md';
  });
  const [manualSlotIndex, setManualSlotIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechController | null>(null);
  const touchStartX = useRef<number | null>(null);
  const lastPlayedHourRef = useRef<string | null>(null);
  const prayerTextRef = useRef<HTMLDivElement | null>(null);
  const manualSlotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSlotIndexRef = useRef<number | null>(null);
  const tickCountRef = useRef(0);

  const [readingProgress, setReadingProgress] = useState(0);
  const { updateAvailable, reload: reloadApp } = useUpdateCheck(VERSION);

  useEffect(() => {
    perfLog('boot', { version: VERSION, href: window.location.href });
  }, []);

  useEffect(() => {
    if (currentHour) {
      const color = HOUR_COLORS[currentHour.name] || '#d4af37';
      document.documentElement.style.setProperty('--color-monastery-accent', color);
    }
  }, [currentHour]);

  useEffect(() => {
    document.documentElement.dataset.fontScale = fontScale;
    try {
      localStorage.setItem(FONT_SCALE_KEY, fontScale);
    } catch { /* ignore */ }
  }, [fontScale]);

  const cycleFontScale = useCallback(() => {
    setFontScale(prev => (prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'));
  }, []);

  const syncSlotToView = useCallback((slotIndex: number) => {
    if (lastSlotIndexRef.current === slotIndex) return;
    lastSlotIndexRef.current = slotIndex;
    const slot = DAY_SLOTS[slotIndex];
    if (!slot) return;
    perfLog('slot-sync:apply', { slotIndex, title: slot.title });
    setFragment(slot.fragment);
    setFragmentIndex(slot.fragmentIndex);
  }, []);

  const bumpManualSlot = useCallback((delta: number) => {
    const base = manualSlotIndex ?? getDayPosition(currentTime).slotIndex;
    const next = (base + delta + DAY_SLOTS.length) % DAY_SLOTS.length;
    perfLog('manual-nav', { delta, next });
    setManualSlotIndex(next);
    syncSlotToView(next);
    lastInteractionRef.current = Date.now();
    if (manualSlotTimerRef.current) clearTimeout(manualSlotTimerRef.current);
    manualSlotTimerRef.current = setTimeout(() => setManualSlotIndex(null), 5 * 60 * 1000);
  }, [currentTime, manualSlotIndex, syncSlotToView]);

  const { init: initResonator, start: startResonator, stop: stopResonator, playBell: playResonatorBell, cleanup: cleanupResonator } = useCosmicResonator();
  const lastInteractionRef = useRef<number>(Date.now());
  const [fullPrayerText, setFullPrayerText] = useState<string>('');

  const handleCopy = useCallback(() => {
    if (!fragment) return;
    navigator.clipboard.writeText(fragment.text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [fragment]);

  const playHour = useCallback(async (hour: LiturgicalHour) => {
    if (isLoadingAudio || isLoadingText) return;
    perfLog('playHour', hour.name);
    setIsLoadingText(true);
    setError(null);
    setUsingFallback(false);
    setAudioProgress(0);
    
    try {
      const now = new Date();
      const text = await generatePrayerText(hour.name, now);
      setFullPrayerText(text);
      // Display stays on liturgical slot (ticker); audio uses generated prayer only
      setIsLoadingText(false);
      
      setIsLoadingAudio(true);
      const audioResult = await generateAudioOrFallback(text, { hour: hour.name, index: fragmentIndex });
      if (audioRef.current) {
        if (audioResult.mode === 'manual' && audioResult.url) {
          audioRef.current.src = audioResult.url;
        } else if (audioResult.mode === 'piper' && audioResult.base64) {
          audioRef.current.src = `data:audio/wav;base64,${audioResult.base64}`;
        }
        audioRef.current.play().catch(e => {
          console.warn("Autoplay blocked", e);
          setAutoplayBlocked(true);
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setUsingFallback(true);
    } finally {
      setIsLoadingAudio(false);
      setIsLoadingText(false);
    }
  }, [isLoadingAudio, isLoadingText, fragmentIndex]);

  const togglePlayPause = useCallback(() => {
    if (autoplayBlocked) {
      handleManualStart();
      return;
    }
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  }, [isPlaying, autoplayBlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
    if (audioRef.current) audioRef.current.muted = !isMuted;
  }, [isMuted]);

  const toggleAmbient = useCallback(() => {
    setAmbientEnabled(prev => {
      const next = !prev;
      localStorage.setItem('cathedral-ambient', String(next));
      return next;
    });
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode(prev => !prev);
  }, []);

  const handleManualStart = () => {
    setAutoplayBlocked(false);
    if (audioRef.current) audioRef.current.play();
    if (bellRef.current) bellRef.current.play();
  };

  const goToNextFragment = useCallback(() => {
    bumpManualSlot(1);
  }, [bumpManualSlot]);

  const goToPrevFragment = useCallback(() => {
    bumpManualSlot(-1);
  }, [bumpManualSlot]);

  const activeSlotIndex = manualSlotIndex ?? getDayPosition(currentTime).slotIndex;

  useEffect(() => {
    const pos = getDayPosition(currentTime);
    setReadingProgress(prev => {
      if (Math.abs(prev - pos.slotProgress) < 0.0005) return prev;
      return pos.slotProgress;
    });
    if (manualSlotIndex === null) {
      syncSlotToView(pos.slotIndex);
    }
  }, [currentTime, manualSlotIndex, syncSlotToView]);

  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);
    syncSlotToView(getDayPosition(now).slotIndex);
  }, [syncSlotToView]);

  useEffect(() => {
    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    const markActive = () => { lastInteractionRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, markActive));
  }, []);

  useEffect(() => {
    if (ambientEnabled && !isMuted) {
      initResonator(true);
      startResonator();
    } else {
      stopResonator();
    }
  }, [ambientEnabled, isMuted, initResonator, startResonator, stopResonator]);

  useEffect(() => {
    if (!currentHour) {
      setHasRecording(false);
      return;
    }
    getPrayerRecordingMetadata(currentHour.name).then(meta => {
      setHasRecording(meta?.status === 'final');
    });
  }, [currentHour]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      const hourChanged = curr?.name !== currentHour?.name;

      setCurrentHour(prev => (prev?.name === curr?.name ? prev : curr));
      setNextHour(prev => (prev?.name === next?.name ? prev : next));

      if (manualSlotIndex === null) {
        syncSlotToView(getDayPosition(now).slotIndex);
      }

      tickCountRef.current += 1;
      if (tickCountRef.current % 60 === 0) {
        perfLog('tick:60s', { hour: curr?.name, slot: getDayPosition(now).slotIndex });
      }

      if (hourChanged && curr) {
        perfLog('hour-change', { from: currentHour?.name, to: curr.name });
        setManualSlotIndex(null);
        lastSlotIndexRef.current = null;
        if (!isPlaying && !isLoadingAudio && !isLoadingText) {
          const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
          if (lastPlayedHourRef.current !== hourId) {
            lastPlayedHourRef.current = hourId;
            playResonatorBell();
            playHour(curr);
          }
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentHour, isPlaying, isLoadingAudio, isLoadingText, playHour, playResonatorBell, manualSlotIndex, syncSlotToView]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showRecorder) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlayPause(); }
      if (e.key.toLowerCase() === 'm') { e.preventDefault(); toggleMute(); }
      if (e.key.toLowerCase() === 'a') { e.preventDefault(); toggleAmbient(); }
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); toggleFocusMode(); }
      if (e.key.toLowerCase() === 'v') { e.preventDefault(); setShowRecorder(prev => !prev); }
      if (e.key.toLowerCase() === 'c') { e.preventDefault(); handleCopy(); }
      if (e.key.toLowerCase() === 'f') { e.preventDefault(); cycleFontScale(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNextFragment(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrevFragment(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, toggleMute, toggleAmbient, toggleFocusMode, handleCopy, cycleFontScale, goToNextFragment, goToPrevFragment, showRecorder]);

  useEffect(() => {
    return () => { cleanupResonator(); };
  }, [cleanupResonator]);

  return (
    <div className={`h-screen flex overflow-hidden relative cursor-default ${focusMode ? 'focus-mode' : ''}`} onClick={() => { if (autoplayBlocked) handleManualStart(); }}>
      <BackgroundLayers currentHour={currentHour} />
      <IncenseTrail />
      <LightShafts />
      <DustMotes />
      <CelestialClockwork />
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); }} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onTimeUpdate={(e) => { const audio = e.currentTarget; if (audio.duration) { setAudioProgress(audio.currentTime); setAudioDuration(audio.duration); } }} onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)} />

      {updateAvailable && (
        <UpdateBanner version={updateAvailable.version} onReload={reloadApp} />
      )}

      <header className={`md:hidden fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--color-monastery-accent)]/10 min-h-14 flex items-center justify-between px-3 gap-2 transition-all duration-700 ${focusMode ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'}`}>
        <button onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }} className="p-2 opacity-80 hover:opacity-100 transition-opacity shrink-0" aria-label="Menú">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          <img src="/icons/icon.svg" alt="" className="w-7 h-7 shrink-0 rounded-md" width={28} height={28} />
          <div className="text-center min-w-0">
            <p className="font-serif text-sm text-[var(--color-monastery-accent)] leading-tight truncate sidebar-app-title">
              {APP_NAME}
              <span className="sidebar-version-on-hover">v{VERSION}</span>
            </p>
            <p className="text-[10px] uppercase tracking-wider opacity-60 truncate">
              {currentHour?.name || APP_TAGLINE} · {format(currentTime, 'HH:mm')}
            </p>
          </div>
        </div>
        <div className="w-10 shrink-0" aria-hidden />
      </header>

      <aside 
        className={`sidebar-panel fixed md:static inset-y-0 left-0 z-40 w-[min(100vw,22rem)] md:w-[min(28vw,22rem)] glass-panel border-r border-[var(--color-monastery-accent)]/10 flex flex-col transition-all duration-700 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${focusMode ? 'md:-translate-x-full md:opacity-0 pointer-events-none' : 'opacity-100'} pt-14 md:pt-0`}
      >
        <div className="hidden md:block p-5 text-center border-b border-white/10 shrink-0 sidebar-clock">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/icons/icon.svg" alt="" className="w-8 h-8 rounded-lg" width={32} height={32} />
            <div className="text-left">
              <p className="font-serif text-xl text-[var(--color-monastery-accent)] leading-none sidebar-app-title">
                {APP_NAME}
                <span className="sidebar-version-on-hover">v{VERSION}</span>
              </p>
              <p className="text-xs uppercase tracking-widest opacity-60">{APP_TAGLINE}</p>
            </div>
          </div>
          <motion.h1 key={format(currentTime, 'HH:mm')} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }} className="font-serif text-5xl text-[var(--color-monastery-accent)] leading-none">{format(currentTime, 'HH:mm')}</motion.h1>
          <p className="text-sm uppercase tracking-[0.2em] opacity-80 mt-2">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</p>
          {currentHour && (
            <p className="font-serif text-xl mt-3 text-[var(--color-monastery-accent)]">
              {currentHour.name}
              <span className="block text-sm opacity-70 font-sans mt-1">Próxima: {nextHour?.name} · {nextHour?.timeString}</span>
            </p>
          )}
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <DayPlaylistSidebar currentTime={currentTime} />
        </div>

        {/* Sidebar footer intentionally removed for TV readability */}
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col relative min-w-0 pt-14 md:pt-0 prayer-main-view" onTouchStart={(e) => { touchStartX.current = e.changedTouches[0].screenX; }} onTouchEnd={(e) => { if (touchStartX.current == null) return; const diff = touchStartX.current - e.changedTouches[0].screenX; if (Math.abs(diff) > 50) { if (diff > 0) goToNextFragment(); else goToPrevFragment(); } touchStartX.current = null; }}>
        <div 
          ref={prayerTextRef}
          className="flex-1 overflow-hidden flex flex-col items-center px-4 py-4 md:px-8 md:py-6 relative min-h-0"
        >
          <div className="sacred-frame" />
          
          <AnimatePresence>
            {showRecorder && currentHour && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                onClick={() => setShowRecorder(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Recorder hour={currentHour.name} index={fragmentIndex} prayerText={fullPrayerText} onFinished={() => setShowRecorder(false)} onClose={() => setShowRecorder(false)} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full max-w-4xl h-full relative group flex flex-col min-h-0">
            {!focusMode && (
              <div className="shrink-0 mb-2 z-10">
                <PrayerTimingBar currentTime={currentTime} slotIndexOverride={manualSlotIndex} />
              </div>
            )}
            <div className="absolute top-2 right-2 opacity-15 pointer-events-none rose-container hidden md:block">
              <SacredDrawing symbolKey="cross" progress={isPlaying ? 0.8 : 0.3} size={56} />
            </div>

            {fragment && (
              <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="absolute -top-2 right-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-all p-2 z-10" title="Copiar Liturgia (C)">
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}

            {isLoadingText && (
              <div className="flex items-center justify-center gap-3 opacity-50 mb-8">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }}><Bell size={16} /></motion.div>
                <span className="text-[10px] uppercase tracking-[0.3em]">Escribiendo...</span>
              </div>
            )}

            <AnimatePresence>
              {usingFallback && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--color-monastery-accent)] opacity-70">
                  <AlertCircle size={10} />
                  <span>{error || 'Mostrando la última oración disponible'}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {currentHour && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrevFragment(); }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-12 opacity-20 md:opacity-0 group-hover:opacity-40 hover:!opacity-100 focus:opacity-100 focus:outline-none focus:scale-110 transition-all p-4 z-20"
                  title="Fragmento anterior (←)"
                >
                  <span className="text-3xl font-serif">‹</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNextFragment(); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-12 opacity-20 md:opacity-0 group-hover:opacity-40 hover:!opacity-100 focus:opacity-100 focus:outline-none focus:scale-110 transition-all p-4 z-20"
                  title="Siguiente fragmento (→)"
                >
                  <span className="text-3xl font-serif">›</span>
                </button>
              </>
            )}

            <AnimatePresence mode="wait">
            {fragment ? (
                <motion.div
                  key={`${activeSlotIndex}-${fragment.title}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  className="flex-1 min-h-0 w-full"
                >
                  <AutoPager
                    progress={readingProgress}
                  >
                    {fragment.text}
                  </AutoPager>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center opacity-30 font-serif italic gap-4 py-20"><Bell size={24} /><p className="text-lg">Entrando a la Capilla...</p></motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {!focusMode && !transportOpen && (
          <button
            type="button"
            className="transport-toggle glass-panel border border-[var(--color-monastery-accent)]/20 px-4 py-2 rounded-full flex items-center gap-2 opacity-85"
            onClick={(e) => {
              e.stopPropagation();
              setTransportOpen(true);
            }}
            aria-label="Mostrar controles"
            title="Mostrar controles"
          >
            <span className="text-[12px] uppercase tracking-wider" style={{ color: 'var(--color-monastery-accent)' }}>
              Controles
            </span>
          </button>
        )}

        {!focusMode && transportOpen && (
          <div className={`h-12 glass-panel border-t border-[var(--color-monastery-accent)]/10 flex items-center px-4 md:px-6 gap-3 md:gap-4 transition-all duration-300`} onClick={(e) => e.stopPropagation()}>
            <button onClick={togglePlayPause} disabled={isLoadingAudio || isLoadingText} className="flex items-center justify-center w-9 h-9 md:w-8 md:h-8 rounded-full border border-white/20 hover:border-[var(--color-monastery-accent)] hover:text-[var(--color-monastery-accent)] transition-all disabled:opacity-30 shrink-0" title="Reproducir / Pausar (Espacio)">
              {isLoadingAudio || (isLoadingText && !fragment) ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Bell size={14} className="md:size-3" /></motion.div> : isPlaying ? <Pause size={14} className="md:size-3" /> : <Play size={14} className="ml-0.5 md:size-3" />}
            </button>
            <button onClick={toggleFocusMode} className="hover:text-[var(--color-monastery-accent)] transition-colors shrink-0 opacity-80 hover:opacity-100" title="Modo Zen (Z)">
              {focusMode ? <EyeOff size={16} className="md:size-3.5" /> : <Eye size={16} className="md:size-3.5" />}
            </button>
            <button onClick={toggleMute} className="hover:text-[var(--color-monastery-accent)] transition-colors shrink-0 opacity-80 hover:opacity-100" title="Silenciar (M)">
              {isMuted ? <VolumeX size={16} className="md:size-3.5" /> : <Volume2 size={16} className="md:size-3.5" />}
            </button>
            <button onClick={toggleAmbient} className={`flex items-center gap-1 p-1.5 rounded-full hover:bg-white/10 hover:text-[var(--color-monastery-accent)] transition-all shrink-0 ${ambientEnabled ? 'text-[var(--color-monastery-accent)] opacity-100' : 'opacity-70 hover:opacity-100'}`} title="Sonido Ambiente (A)">
              <Waves size={16} />
              <span className="text-[10px] uppercase tracking-wider">Ambiente</span>
            </button>
            <button onClick={() => setShowRecorder(!showRecorder)} className={`flex items-center gap-1 p-1.5 rounded-full hover:bg-white/10 hover:text-[var(--color-monastery-accent)] transition-all shrink-0 ${showRecorder ? 'text-[var(--color-monastery-accent)] opacity-100' : 'opacity-70 hover:opacity-100'} ${hasRecording ? 'relative' : ''}`} title="Grabar Voz (V)">
              <Mic size={16} />
              <span className="text-[10px] uppercase tracking-wider">Voz</span>
              {hasRecording && !showRecorder && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500" />
              )}
            </button>
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="text-[10px] font-mono opacity-50 w-8 text-right shrink-0 hidden sm:inline">{formatTime(audioProgress)}</span>
              <div className="flex-1 scrubber-bar cursor-pointer" onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                if (audioRef.current && audioDuration > 0) {
                  audioRef.current.currentTime = pct * audioDuration;
                }
              }}>
                <motion.div
                  className="scrubber-progress"
                  style={{ width: `${audioDuration > 0 ? (audioProgress / audioDuration) * 100 : 0}%` }}
                >
                  <div className="scrubber-glow" />
                </motion.div>
              </div>
              <span className="text-[10px] font-mono opacity-50 w-8 shrink-0 hidden sm:inline">{formatTime(audioDuration)}</span>
            </div>
            {autoplayBlocked && !isPlaying && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] uppercase tracking-widest text-[var(--color-monastery-accent)] shrink-0">Toca para comenzar</motion.span>}
            <button
              type="button"
              className="shrink-0 opacity-70 hover:opacity-100"
              onClick={() => setTransportOpen(false)}
              aria-label="Ocultar controles"
              title="Ocultar controles"
            >
              <span style={{ color: 'var(--color-monastery-accent)' }}>✕</span>
            </button>
          </div>
        )}

        {focusMode && (
          <div 
            className="fixed bottom-0 left-0 right-0 h-4 z-50 cursor-pointer opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-t from-[var(--color-monastery-accent)]/20 to-transparent flex items-center justify-center"
            onClick={toggleFocusMode}
            title="Salir del Modo Zen (Z)"
          >
            <div className="w-12 h-1 bg-[var(--color-monastery-accent)]/40 rounded-full" />
          </div>
        )}
      </main>
    </div>
  );
}
