import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, Clock, AlertCircle, Copy, Check, Menu, X, Mic, Waves, Sun, Moon, Sunrise, Sunset, Eye, EyeOff } from 'lucide-react';
import { format, isAfter, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour, HourName } from './lib/hours';
import { getFragmentForHour, LiturgicalFragment, FRAGMENTS_BY_HOUR } from './lib/liturgicalFragments';
import { useBackground } from './lib/backgrounds';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing } from './sacred/procedural-rose';
import { generatePrayerText, generateAudioOrFallback, SpeechController } from './services/gemini';
import { Recorder } from './components/Recorder';
import { AutoPager } from './components/AutoPager';
import { IncenseTrail } from './components/IncenseTrail';
import { getPrayerRecordingMetadata } from './services/recordings';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;
const VERSION = '1.3.0'; 

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

// ─── Glacier Scroll Hook ───
function useGlacierScroll(ref: React.RefObject<HTMLDivElement | null>, active: boolean, speed = 0.05) {
  useEffect(() => {
    if (!active || !ref.current) return;
    
    let lastTime = performance.now();
    let scrollPos = ref.current.scrollTop;
    let frame: number;

    const step = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;
      
      if (ref.current) {
        scrollPos += (speed * dt) / 1000;
        ref.current.scrollTop = scrollPos;
        if (scrollPos >= ref.current.scrollHeight - ref.current.clientHeight) {
          scrollPos = 0;
        }
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [active, ref, speed]);
}

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

function Chronogram({ currentTime, currentHour }: { currentTime: Date, currentHour: LiturgicalHour | null }) {
  const radius = 2200; // Giant wheel radius
  const [offsetAngle, setOffsetAngle] = useState(0);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes() + currentTime.getSeconds() / 60;
  const dayProgress = totalMinutes / (24 * 60);
  
  const baseAngle = dayProgress * 360;

  const handleWheel = (e: React.WheelEvent) => {
    setOffsetAngle(prev => prev + e.deltaY * 0.05);
    
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => {
      setOffsetAngle(0);
    }, 2000);
  };

  return (
    <div 
      className="flex-1 relative overflow-hidden mt-4 mb-4 cursor-ns-resize"
      onWheel={handleWheel}
    >
      <div 
        className="absolute left-0 top-1/2 w-full transition-transform duration-500 ease-out"
        style={{ 
          transform: `rotate(${-(baseAngle + offsetAngle)}deg)`, 
          transformOrigin: `${radius}px 0px`,
          height: '0px'
        }}
      >
        {Array.from({ length: 24 }).map((_, h) => {
          const angle = (h / 24) * 360;
          const isLiturgical = HOURS_SCHEDULE.find(sh => parseInt(sh.timeString.split(':')[0]) === h);
          const isCurrent = currentHour && parseInt(currentHour.timeString.split(':')[0]) === h;
          
          return (
            <div 
              key={h}
              className="absolute whitespace-nowrap"
              style={{
                transform: `rotate(${-angle}deg) translateX(-${radius - 40}px) rotate(${angle}deg)`,
                transformOrigin: '0 0',
                left: '0',
                top: '0',
                opacity: Math.abs(((angle - (baseAngle + offsetAngle) + 360) % 360) - 180) > 160 ? 1 : 0.15,
                transition: 'opacity 0.5s'
              }}
            >
              <div className={`flex items-center gap-4 px-6 py-2 transition-all ${isCurrent ? 'scale-110' : 'scale-100'}`}>
                <div className={`w-8 h-[1px] ${isLiturgical ? 'bg-[var(--color-monastery-accent)]' : 'bg-white/20'}`} />
                <span className={`font-mono text-[10px] ${isLiturgical ? 'text-[var(--color-monastery-accent)] font-bold' : 'opacity-50'}`}>
                  {h.toString().padStart(2, '0')}:00
                </span>
                {isLiturgical && (
                  <span className={`font-serif text-sm transition-colors ${isCurrent ? 'text-[var(--color-monastery-accent)]' : 'opacity-80'}`}>
                    {isLiturgical.name}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[1px] bg-[var(--color-monastery-accent)]/20 pointer-events-none" />
      {Math.abs(offsetAngle) > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-widest opacity-40 animate-pulse">Explorando...</div>
      )}
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechController | null>(null);
  const touchStartX = useRef<number | null>(null);
  const lastPlayedHourRef = useRef<string | null>(null);
  const prayerTextRef = useRef<HTMLDivElement | null>(null);
  const sidepaneRef = useRef<HTMLDivElement | null>(null);

  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    if (currentHour) {
      const color = HOUR_COLORS[currentHour.name] || '#d4af37';
      document.documentElement.style.setProperty('--color-monastery-accent', color);
    }
  }, [currentHour]);

  useGlacierScroll(sidepaneRef, !sidebarOpen, 8);

  useEffect(() => {
    if (!isPlaying || !fragment) {
      setReadingProgress(0);
      return;
    }

    const wordCount = fragment.text.trim().split(/\s+/).length;
    const estimatedSeconds = (wordCount / 70) * 60;
    const duration = Math.max(20000, estimatedSeconds * 1000);

    let start: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const progress = Math.min(1.05, elapsed / duration);
      setReadingProgress(progress);
      if (progress < 1.05) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, fragment]);

  const { init: initResonator, start: startResonator, stop: stopResonator, playBell: playResonatorBell, cleanup: cleanupResonator } = useCosmicResonator();
  const lastInteractionRef = useRef<number>(Date.now());
  const lastAutoRotationRef = useRef<number>(Date.now());
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
    
    setIsLoadingText(true);
    setError(null);
    setUsingFallback(false);
    setFragment(null);
    setAudioProgress(0);
    
    try {
      const text = await generatePrayerText(hour.name);
      setFullPrayerText(text);
      setFragment({ title: hour.name, text });
      setIsLoadingText(false);
      
      setIsLoadingAudio(true);
      const audioUrl = await generateAudioOrFallback(hour.name, text);
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
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
  }, [isLoadingAudio, isLoadingText]);

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
    initResonator(true);
    if (audioRef.current) audioRef.current.play();
    if (bellRef.current) bellRef.current.play();
  };

  const updateFragment = useCallback((hour: LiturgicalHour | null, index: number) => {
    if (!hour) return;
    const fragments = FRAGMENTS_BY_HOUR[hour.name];
    if (!fragments || fragments.length === 0) {
      setFragment({ title: 'Oración', text: '**Amén.**' });
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

  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);
    if (curr) {
      updateFragment(curr, 0);
    }
    initResonator(true);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    const markActive = () => { lastInteractionRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, markActive));
  }, []);

  useEffect(() => {
    const shouldBeActive = (isPlaying || ambientEnabled) && !isMuted;
    if (shouldBeActive) startResonator();
    else stopResonator();
  }, [isPlaying, ambientEnabled, isMuted, startResonator, stopResonator]);

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
      setCurrentHour(curr);
      setNextHour(next);

      if (hourChanged && curr) {
        setFragmentIndex(0);
        updateFragment(curr, 0);
        lastAutoRotationRef.current = Date.now();
        if (!isPlaying && !isLoadingAudio && !isLoadingText) {
          const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
          if (lastPlayedHourRef.current !== hourId) {
            lastPlayedHourRef.current = hourId;
            playResonatorBell();
            playHour(curr);
          }
        }
        return;
      }

      const idleMs = Date.now() - lastInteractionRef.current;
      const sinceRotationMs = Date.now() - lastAutoRotationRef.current;
      if (curr && idleMs > 3 * 60 * 1000 && sinceRotationMs > 10 * 60 * 1000) {
        goToNextFragment();
        lastAutoRotationRef.current = Date.now();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [currentHour, isPlaying, isLoadingAudio, isLoadingText, playHour, playResonatorBell, goToNextFragment, updateFragment]);

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
      if (e.key === 'ArrowRight') { e.preventDefault(); goToNextFragment(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrevFragment(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, toggleMute, toggleAmbient, toggleFocusMode, handleCopy, goToNextFragment, goToPrevFragment, showRecorder]);

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

      <header className={`md:hidden fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--color-monastery-accent)]/10 h-14 flex items-center justify-between px-4 transition-all duration-700 ${focusMode ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100'}`}>
        <button onClick={(e) => { e.stopPropagation(); setSidebarOpen(!sidebarOpen); }} className="p-2 opacity-60 hover:opacity-100 transition-opacity">
          {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <div className="text-center">
          <p className="font-serif text-lg text-[var(--color-monastery-accent)] leading-none">{currentHour?.name || '...'}</p>
          <p className="text-[10px] uppercase tracking-widest opacity-50">{format(currentTime, 'HH:mm')}</p>
        </div>
        <div className="w-8" />
      </header>

      <aside 
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 glass-panel border-r border-[var(--color-monastery-accent)]/10 flex flex-col transition-all duration-700 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${focusMode ? 'md:-translate-x-full md:opacity-0 pointer-events-none' : 'opacity-100'} pt-14 md:pt-0 giant-wheel-sidebar`}
      >
        <div className="hidden md:block p-6 text-center border-b border-white/5">
          <motion.h1 key={format(currentTime, 'HH:mm')} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }} className="font-serif text-4xl text-[var(--color-monastery-accent)]">{format(currentTime, 'HH:mm')}</motion.h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60 mt-1">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</p>
        </div>
        
        <div 
          ref={sidepaneRef}
          className="flex-1 overflow-y-auto custom-scrollbar mask-fade-y flex flex-col min-h-0"
        >
          <div className="p-5 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2 flex items-center gap-1.5"><Clock size={10} /> Hora Actual</p>
            <AnimatePresence mode="wait">
              <motion.div key={currentHour?.name || 'empty'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
                <h2 className="font-serif text-2xl text-[var(--color-monastery-accent)]">{currentHour?.name || '...'}</h2>
                <p className="text-xs opacity-70 mt-0.5">{currentHour?.description}</p>
                <p className="font-mono text-xs opacity-50 mt-1">{currentHour?.timeString}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="p-5 border-b border-white/5 opacity-70">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Próxima Hora</p>
            <AnimatePresence mode="wait">
              <motion.div key={nextHour?.name || 'empty'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
                <h2 className="font-serif text-xl">{nextHour?.name || '...'}</h2>
                <p className="font-mono text-xs opacity-50 mt-1">{nextHour?.timeString}</p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex-1 flex flex-col min-h-[400px]">
            <p className="text-[10px] uppercase tracking-widest opacity-50 px-5 mt-5">Ritmo Diario</p>
            <Chronogram currentTime={currentTime} currentHour={currentHour} />
          </div>
          
          <div className="h-32" />
        </div>

        <div className="p-4 border-t border-white/5 flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity duration-500">
          <p className="text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
            <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Gatrivi</a>
            <span className="opacity-50">|</span>
            <span className="opacity-50">v{VERSION}</span>
          </p>
          <button 
            onClick={rechargeChapel}
            className="text-[9px] uppercase tracking-[0.2em] border border-white/10 px-2 py-1 rounded hover:bg-white/5 hover:border-white/30 transition-all cursor-pointer"
          >
            Recargar Capilla
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />}

      <main className="flex-1 flex flex-col relative min-w-0 pt-14 md:pt-0" onTouchStart={(e) => { touchStartX.current = e.changedTouches[0].screenX; }} onTouchEnd={(e) => { if (touchStartX.current == null) return; const diff = touchStartX.current - e.changedTouches[0].screenX; if (Math.abs(diff) > 50) { if (diff > 0) goToNextFragment(); else goToPrevFragment(); } touchStartX.current = null; }}>
        <div 
          ref={prayerTextRef}
          className="flex-1 overflow-hidden flex flex-col items-center p-6 md:p-12 lg:p-20 relative"
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

          <div className="w-full max-w-3xl h-full relative group">
            <div className="absolute top-8 right-8 opacity-20 pointer-events-none rose-container">
              <SacredDrawing symbolKey="cross" progress={isPlaying ? 0.8 : 0.3} size={80} />
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
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity">
                  {FRAGMENTS_BY_HOUR[currentHour.name]?.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${i === fragmentIndex ? 'w-6 bg-[var(--color-monastery-accent)]' : 'w-2 bg-white/30'}`}
                    />
                  ))}
                </div>
              </>
            )}

            <AnimatePresence mode="wait">
              {fragment ? (
                <motion.div
                  key={`${currentHour?.name}-${fragment.title}-${fragmentIndex}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  className="h-full w-full"
                >
                  <AutoPager progress={readingProgress}>
                    {fragment.text}
                  </AutoPager>
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center opacity-30 font-serif italic gap-4 py-20"><Bell size={24} /><p className="text-lg">Entrando a la Capilla...</p></motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className={`h-12 glass-panel border-t border-[var(--color-monastery-accent)]/10 flex items-center px-4 md:px-6 gap-3 md:gap-4 transition-all duration-700 ${focusMode ? 'opacity-0 pointer-events-none translate-y-full' : 'opacity-85 md:opacity-40 md:hover:opacity-90'} ${autoplayBlocked ? 'opacity-70' : ''}`} onClick={(e) => e.stopPropagation()}>
          <button onClick={togglePlayPause} disabled={isLoadingAudio || isLoadingText} className="flex items-center justify-center w-9 h-9 md:w-8 md:h-8 rounded-full border border-white/20 hover:border-[var(--color-monastery-accent)] hover:text-[var(--color-monastery-accent)] transition-all disabled:opacity-30 shrink-0" title="Reproducir / Pausar (Espacio)">
            {isLoadingAudio || (isLoadingText && !fragment) ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Bell size={14} className="md:size-3" /></motion.div> : isPlaying ? <Pause size={14} className="md:size-3" /> : <Play size={14} className="ml-0.5 md:size-3" />}
          </button>
          
          <button onClick={toggleFocusMode} className="hover:text-[var(--color-monastery-accent)] transition-colors shrink-0 opacity-70 hover:opacity-100" title="Modo Zen (Z)">
            {focusMode ? <EyeOff size={16} className="md:size-3.5" /> : <Eye size={16} className="md:size-3.5" />}
          </button>

          <button onClick={toggleMute} className="hover:text-[var(--color-monastery-accent)] transition-colors shrink-0 opacity-70 hover:opacity-100" title="Silenciar (M)">
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
        </div>

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
