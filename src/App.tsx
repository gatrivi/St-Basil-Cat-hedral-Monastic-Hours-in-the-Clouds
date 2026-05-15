import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, Clock, AlertCircle, Copy, Check, Menu, X, Mic, Waves, Sun, Moon, Sunrise, Sunset } from 'lucide-react';
import { format, isAfter, parse } from 'date-fns';
import { es } from 'date-fns/locale';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { getFragmentForHour, LiturgicalFragment, FRAGMENTS_BY_HOUR } from './lib/liturgicalFragments';
import { useBackground } from './lib/backgrounds';
import { useCosmicResonator } from './sacred/useCosmicResonator';
import { SacredDrawing } from './sacred/procedural-rose';
import { generatePrayerText, generateAudioOrFallback, SpeechController } from './services/gemini';
import { Recorder } from './components/Recorder';
import { AutoPager } from './components/AutoPager';
import { getPrayerRecordingMetadata } from './services/recordings';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;
const VERSION = '1.2.8';

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

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
      <CelestialClockwork />
      <div className="parallax-layer" style={{ transform: `translate(${parallax.x * 0.8}px, ${parallax.y * 0.8}px)` }}>
        <LightShafts />
      </div>
      <DustMotes />
      <div className="breathing-aura" />
      <div className="stained-glass parallax-layer" style={{ transform: `scale(1.05) translate(${parallax.x * -0.3}px, ${parallax.y * -0.3}px)` }} />
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

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const speechRef = useRef<SpeechController | null>(null);
  const speechProgressTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);
  const lastPlayedHourRef = useRef<string | null>(null);

  // Refs for independent scrolling
  const sidepaneRef = useRef<HTMLDivElement>(null);
  const prayerTextRef = useRef<HTMLDivElement>(null);

  // Apply glacier scroll (extremely slow)
  useGlacierScroll(sidepaneRef, true, 1.2); // 1.2px/sec
  useGlacierScroll(prayerTextRef, isPlaying, 0.8); // Only scroll text when playing

  const [readingProgress, setReadingProgress] = useState(0);

  useEffect(() => {
    if (!isPlaying || !fragment) {
      setReadingProgress(0);
      return;
    }

    // Slow "viejita" reading speed: 70 words per minute
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
    const textToCopy = fragment ? `${fragment.title}\n\n${fragment.text}` : '';
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }, [fragment]);

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

  useEffect(() => {
    const now = new Date();
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
    setCurrentHour(curr);
    setNextHour(next);
    if (curr) {
      updateFragment(curr, 0);
      loadHourText(curr).then((text) => {
        if (text) syncAndPlay(curr, now);
      });
    }
    initResonator(true);
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'scroll', 'touchstart', 'keydown'];
    const markActive = () => { lastInteractionRef.current = Date.now(); };
    events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
    return () => events.forEach(e => window.removeEventListener(e, markActive));
  }, []);

  // Unified resonator state: active when playing or ambient is on, unless muted
  useEffect(() => {
    const shouldBeActive = (isPlaying || ambientEnabled) && !isMuted;
    if (shouldBeActive) startResonator();
    else stopResonator();
  }, [isPlaying, ambientEnabled, isMuted, startResonator, stopResonator]);

  // Check if a user recording exists for the current hour
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
    await playHour(hour, false, offsetSeconds);
  };

  const cleanupSpeech = useCallback(() => {
    if (speechProgressTimer.current) {
      clearInterval(speechProgressTimer.current);
      speechProgressTimer.current = null;
    }
    if (speechRef.current) {
      speechRef.current.stop();
      speechRef.current = null;
    }
  }, []);

  const loadHourText = async (hour: LiturgicalHour) => {
    if (isLoadingText) return;
    setIsLoadingText(true);
    setError(null);
    setUsingFallback(false);
    try {
      const text = await generatePrayerText(hour.name, new Date());
      setFullPrayerText(text);
      return text;
    } catch (err) {
      setUsingFallback(true);
      setError('Los monjes estan en contemplacion silenciosa. Mostrando la ultima oracion disponible.');
      return '';
    } finally {
      setIsLoadingText(false);
    }
  };

  const playHour = async (hour: LiturgicalHour, _fadeIn: boolean = false, startOffset: number = 0) => {
    if (isPlaying || isLoadingAudio) return;
    let text = fullPrayerText || (fragment ? `${fragment.title}. ${fragment.text}` : '');
    if (!text || (currentHour && hour.name !== currentHour.name)) {
      text = await loadHourText(hour) || '';
      if (!text) return;
    }
    setIsLoadingAudio(true);
    cleanupSpeech();
    try {
      const result = await generateAudioOrFallback(text, { hour: hour.name, index: fragmentIndex });
      if (result.mode === 'piper' || result.mode === 'manual') {
        const audioUrl = result.mode === 'piper' ? `data:audio/wav;base64,${result.base64}` : result.url!;
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.muted = isMuted;
          audioRef.current.onloadedmetadata = () => {
            if (!audioRef.current) return;
            const duration = audioRef.current.duration;
            if (startOffset > 0 && startOffset < duration) {
              audioRef.current.currentTime = startOffset;
            } else if (startOffset >= duration) {
              setIsLoadingAudio(false);
              return;
            }
            audioRef.current.play().then(() => {
              setIsPlaying(true);
              setIsLoadingAudio(false);
              setAutoplayBlocked(false);
            }).catch(() => {
              setIsLoadingAudio(false);
              setAutoplayBlocked(true);
            });
          };
        }
      } else if (result.mode === 'speech') {
        const ctrl = result.controller;
        speechRef.current = ctrl;
        ctrl.onPlay = () => { setIsPlaying(true); setIsLoadingAudio(false); setAutoplayBlocked(false); };
        ctrl.onPause = () => { setIsPlaying(false); };
        ctrl.onEnd = () => { setIsPlaying(false); if (speechProgressTimer.current) { clearInterval(speechProgressTimer.current); speechProgressTimer.current = null; } };
        ctrl.onTimeUpdate = () => { setAudioProgress(ctrl.getCurrentTime()); setAudioDuration(ctrl.getDuration()); };
        speechProgressTimer.current = setInterval(() => { ctrl.onTimeUpdate?.(); }, 250);
        ctrl.play();
      }
    } catch (err) {
      setIsLoadingAudio(false);
    }
  };

  const handleManualStart = () => {
    setAutoplayBlocked(false);
    playResonatorBell();
    if (currentHour) syncAndPlay(currentHour, new Date());
  };

  const toggleAmbient = useCallback(() => {
    setAmbientEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('cathedral-ambient', String(next)); } catch {}
      return next;
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    if (autoplayBlocked) { handleManualStart(); return; }
    if (speechRef.current) {
      if (isPlaying) { speechRef.current.pause(); setIsPlaying(false); }
      else { speechRef.current.play(); setIsPlaying(true); }
      return;
    }
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else if (audioRef.current.src) { audioRef.current.play(); setIsPlaying(true); }
    else if (currentHour) { playHour(currentHour); }
  }, [isPlaying, currentHour, fullPrayerText, autoplayBlocked]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      if (bellRef.current) bellRef.current.muted = next;
      if (speechRef.current) { if (next) speechRef.current.pause(); else if (isPlaying) speechRef.current.play(); }
      return next;
    });
  }, [isPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ': e.preventDefault(); togglePlayPause(); break;
        case 'm': case 'M': toggleMute(); break;
        case 'c': case 'C': if (!e.ctrlKey && !e.metaKey) handleCopy(); break;
        case 'ArrowRight': e.preventDefault(); goToNextFragment(); break;
        case 'ArrowLeft': e.preventDefault(); goToPrevFragment(); break;
        case 'r': case 'R': if (currentHour) loadHourText(currentHour); break;
        case 'v': case 'V': setShowRecorder(prev => !prev); break;
        case 'a': case 'A': toggleAmbient(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isLoadingAudio, isLoadingText, isMuted, currentHour, handleCopy, goToNextFragment, goToPrevFragment, toggleAmbient]);

  useEffect(() => {
    return () => { cleanupSpeech(); cleanupResonator(); };
  }, [cleanupResonator, cleanupSpeech]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex overflow-hidden relative cursor-default" onClick={() => { if (autoplayBlocked) handleManualStart(); }}>
      <BackgroundLayers currentHour={currentHour} />
      <audio ref={bellRef} src={BELL_SOUND_URL} preload="auto" />
      <audio ref={audioRef} onEnded={() => { setIsPlaying(false); }} onPause={() => setIsPlaying(false)} onPlay={() => setIsPlaying(true)} onTimeUpdate={(e) => { const audio = e.currentTarget; if (audio.duration) { setAudioProgress(audio.currentTime); setAudioDuration(audio.duration); } }} onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)} />

      <header className="md:hidden fixed top-0 left-0 right-0 z-40 glass-panel border-b border-[var(--color-monastery-accent)]/10 h-14 flex items-center justify-between px-4">
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
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 glass-panel border-r border-[var(--color-monastery-accent)]/10 flex flex-col transition-transform duration-500 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} pt-14 md:pt-0 giant-wheel-sidebar`}
        style={{ transform: `rotate(${readingProgress * -5}deg)` }}
      >
        <div className="hidden md:block p-6 text-center border-b border-white/5">
          <motion.h1 key={format(currentTime, 'HH:mm')} initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 1.5 }} className="font-serif text-4xl text-[var(--color-monastery-accent)]">{format(currentTime, 'HH:mm')}</motion.h1>
          <p className="text-xs uppercase tracking-[0.3em] opacity-60 mt-1">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</p>
        </div>
        <div 
          ref={sidepaneRef}
          className="flex-1 overflow-y-auto custom-scrollbar mask-fade-y"
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
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">Pr├│xima Hora</p>
            <AnimatePresence mode="wait">
              <motion.div key={nextHour?.name || 'empty'} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2 }}>
                <h2 className="font-serif text-xl">{nextHour?.name || '...'}</h2>
                <p className="font-mono text-xs opacity-50 mt-1">{nextHour?.timeString}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="p-5">
            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-4 flex justify-between">
              <span>Ritmo Diario</span>
              <span>{format(currentTime, 'yyyy')}</span>
            </p>
            <div className="space-y-0">
              {HOURS_SCHEDULE.map((h) => {
                const isActive = currentHour?.name === h.name;
                const hourDate = parse(h.timeString, 'HH:mm', currentTime);
                const isPast = !isActive && isAfter(currentTime, hourDate);
                
                let Icon = Sun;
                if (h.name === 'Maitines' || h.name === 'Completas') Icon = Moon;
                if (h.name === 'Laudes') Icon = Sunrise;
                if (h.name === 'Vísperas') Icon = Sunset;

                return (
                  <div 
                    key={h.name} 
                    className={`schedule-item group ${isActive ? 'active' : isPast ? 'past' : 'future'}`}
                  >
                    <div className="schedule-dot" />
                    <div className={`flex justify-between items-center px-3 py-3 rounded-lg transition-all ${isActive ? 'bg-[var(--color-monastery-accent)]/10 text-[var(--color-monastery-accent)]' : 'hover:bg-white/5'}`}>
                      <div className="flex items-center gap-3">
                        <Icon size={14} className={isActive ? 'opacity-100' : 'opacity-40'} />
                        <div>
                          <p className={`font-serif text-base leading-none ${isActive ? 'font-bold' : ''}`}>{h.name}</p>
                          <p className="text-[9px] uppercase tracking-wider opacity-50 mt-1">{h.description}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs opacity-60">{h.timeString}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Extra padding for glacier scroll */}
          <div className="h-64" />
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
          className="flex-1 overflow-y-auto custom-scrollbar mask-fade-y flex flex-col items-center justify-center p-6 md:p-12 lg:p-20 relative"
        >
          <div className="sacred-frame" />
          
          {/* Recorder Overlay */}
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
            {fragment && (
              <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="absolute -top-2 right-0 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-all p-2 z-10" title="Copiar Liturgia (C)">
                {isCopied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}

            <div className="absolute top-8 right-8 opacity-20 pointer-events-none rose-container">
              <SacredDrawing symbolKey="cross" progress={isPlaying ? 0.8 : 0.3} size={80} />
            </div>

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
          {/* Extra padding for glacier scroll */}
          <div className="h-96" />
        </div>

        <div className={`h-12 glass-panel border-t border-[var(--color-monastery-accent)]/10 flex items-center px-4 md:px-6 gap-3 md:gap-4 opacity-85 md:opacity-40 md:hover:opacity-90 transition-opacity duration-500 ${autoplayBlocked ? 'opacity-70' : ''}`} onClick={(e) => e.stopPropagation()}>
          <button onClick={togglePlayPause} disabled={isLoadingAudio || isLoadingText} className="flex items-center justify-center w-9 h-9 md:w-8 md:h-8 rounded-full border border-white/20 hover:border-[var(--color-monastery-accent)] hover:text-[var(--color-monastery-accent)] transition-all disabled:opacity-30 shrink-0" title="Reproducir / Pausar (Espacio)">
            {isLoadingAudio || (isLoadingText && !fragment) ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}><Bell size={14} className="md:size-3" /></motion.div> : isPlaying ? <Pause size={14} className="md:size-3" /> : <Play size={14} className="ml-0.5 md:size-3" />}
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
              } else if (speechRef.current && audioDuration > 0) {
                // Speech seeking not supported, but UI update
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
      </main>
    </div>
  );
}
