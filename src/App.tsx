import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, SkipForward, BookOpen, Clock, AlertCircle, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// Declare the version injected by Vite
declare const __APP_VERSION__: string;

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

function Notebook() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetch('/api/notebook')
      .then(res => res.json())
      .then(data => setContent(data.content))
      .catch(err => console.error("Failed to load notebook", err));
  }, []);

  const debouncedSave = useCallback((newContent: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch('/api/notebook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent })
        });
        setLastSaved(Date.now());
      } catch (err) {
        console.error("Failed to save notebook", err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    debouncedSave(val);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-64 md:h-full">
      <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 flex justify-between">
        <span>Personal Notebook</span>
        <span className="flex gap-2">
          {isSaving && <span className="text-[var(--color-monastery-accent)] animate-pulse">Saving...</span>}
          {!isSaving && lastSaved && <span className="text-green-500/50">Saved</span>}
        </span>
      </h3>
      <textarea
        value={content}
        onChange={handleChange}
        className="w-full h-full bg-transparent resize-none outline-none font-serif text-lg leading-relaxed text-[var(--color-monastery-text)] placeholder:opacity-30"
        placeholder="Write your chores and thoughts here..."
      />
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

  const [hasEntered, setHasEntered] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const notebookRef = useRef<HTMLTextAreaElement | null>(null);

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
    
    // If we are within the first 15 minutes of an hour, we sync to the offset
    if (currentMinutes < 15) {
      console.log(`[DEBUG] App: Syncing to offset ${offsetSeconds}s for ${hour.name}`);
      await playHour(hour, false, offsetSeconds);
    } else {
      console.log(`[DEBUG] App: Past 15m mark, chapel is in silent contemplation.`);
    }
  };

  const loadHourText = async (hour: LiturgicalHour) => {
    console.log(`[DEBUG] App: loadHourText started for ${hour.name}`);
    if (isLoadingText) return;
    setIsLoadingText(true);
    setPrayerText('');
    setError(null);
    try {
      const text = await generatePrayerText(hour.name, new Date());
      setPrayerText(text);
      return text;
    } catch (err) {
      setError('The monks are in silent contemplation. Please try again.');
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
        
        // Handle offset - if the audio is shorter than the offset, we don't play
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
            }).catch(err => {
              console.warn('[DEBUG] App: Autoplay blocked, waiting for interaction', err);
              setIsLoadingAudio(false);
              // Silent failure, UI remains active
            });
          }
        };
      }
      
    } catch (err) {
      console.error('[DEBUG] App: playHour error:', err);
      setIsLoadingAudio(false);
    }
  };

  const handleEnter = () => {
    setHasEntered(true);
    bellRef.current?.play().catch(e => console.warn("Bell play failed", e));
    if (currentHour) {
      const now = new Date();
      syncAndPlay(currentHour, now);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasEntered) return;
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
        case 'n':
        case 'N':
          e.preventDefault();
          notebookRef.current?.focus();
          break;
        case 'r':
        case 'R':
          if (currentHour) loadHourText(currentHour);
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasEntered, isPlaying, isLoadingAudio, isLoadingText, isMuted, currentHour, handleCopy]);

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else if (audioRef.current.src) {
      audioRef.current.play();
      setIsPlaying(true);
    } else if (currentHour) {
      playHour(currentHour);
    }
  }, [isPlaying, currentHour, prayerText]);

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
      "%c ✠ MONASTIC HOURS %c by GATRIVI \n%cOriginal work at gatrivi.com | @gatrivi on socials",
      "color: #d4af37; font-size: 20px; font-weight: bold; font-family: serif;",
      "color: #888; font-size: 14px; font-family: serif;",
      "color: #666; font-size: 12px; font-style: italic;"
    );
  }, []);

  if (!hasEntered) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 relative cursor-pointer" onClick={handleEnter}>
        <div className="atmosphere"></div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 2 }}
          className="text-center space-y-8 z-10"
        >
          <h1 className="font-serif text-5xl md:text-7xl font-light tracking-widest text-[var(--color-monastery-accent)]">
            Monastic Hours
          </h1>
          <p className="text-sm uppercase tracking-[0.3em] opacity-60">
            Enter the Chapel
          </p>
          <motion.div 
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="mt-12 opacity-50"
          >
            Click anywhere to join the liturgy
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative">
      <div className="atmosphere"></div>
      
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
        }}
        onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration || 0)}
      />

      <main className="w-full max-w-5xl flex flex-col gap-8 z-10">
        
        {/* Header / Clock */}
        <header className="text-center space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-5xl md:text-7xl font-light tracking-widest text-[var(--color-monastery-accent)]"
          >
            {format(currentTime, 'HH:mm')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] opacity-60"
          >
            {format(currentTime, 'EEEE, MMMM do')}
          </motion.p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          
          {/* Left Column: Schedule & Info */}
          <div className="flex flex-col gap-6">
            <div 
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden"
            >
              <div className="flex justify-between items-start z-10">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2">
                  <Clock size={14} /> Current Hour
                </p>
                <BookOpen size={14} className="opacity-50 text-[var(--color-monastery-accent)]" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentHour?.name || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 1 }}
                  className="flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="font-serif text-3xl text-[var(--color-monastery-accent)]">{currentHour?.name || '...'}</h2>
                    <p className="text-sm opacity-70 mt-1">{currentHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-sm opacity-50">{currentHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div 
              className="glass-panel p-6 rounded-2xl flex flex-col justify-between opacity-70 relative overflow-hidden"
            >
              <div className="flex justify-between items-start z-10">
                <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Next Hour</p>
                <BookOpen size={14} className="opacity-20" />
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={nextHour?.name || 'empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 1 }}
                  className="flex flex-col justify-between h-full"
                >
                  <div>
                    <h2 className="font-serif text-2xl">{nextHour?.name || '...'}</h2>
                    <p className="text-sm opacity-70 mt-1">{nextHour?.description}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-sm opacity-50">{nextHour?.timeString}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <button 
              onClick={() => setShowSchedule(!showSchedule)}
              className="glass-panel p-4 rounded-xl text-xs uppercase tracking-widest hover:text-[var(--color-monastery-accent)] transition-colors text-center"
            >
              {showSchedule ? 'Hide Schedule' : 'View Full Schedule'}
            </button>
          </div>

          {/* Middle Column: Player & Text */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Player Controls */}
            <div className="glass-panel p-4 rounded-3xl flex flex-col items-center gap-4 w-full">
              <div className="flex items-center justify-center gap-8">
                <button onClick={toggleMute} className="hover:text-[var(--color-monastery-accent)] transition-colors" title="Mute (M)">
                  {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  disabled={isLoadingAudio || isLoadingText}
                  className="w-16 h-16 rounded-full border border-[var(--color-monastery-accent)] flex items-center justify-center text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-all disabled:opacity-50"
                  title="Play / Pause (Space)"
                >
                  {isLoadingAudio || (isLoadingText && !prayerText) ? (
                    <motion.div 
                      animate={{ rotate: 360 }} 
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    >
                      <Bell size={24} />
                    </motion.div>
                  ) : isPlaying ? (
                    <Pause size={24} />
                  ) : (
                    <Play size={24} className="ml-1" />
                  )}
                </button>

                <div className="w-5" /> {/* Spacer instead of skip */}
              </div>

              {/* Audio Progress */}
              {audioDuration > 0 && (
                <div className="w-full flex items-center gap-3 px-4">
                  <span className="text-xs font-mono opacity-50 w-10 text-right">
                    {Math.floor(audioProgress / 60)}:{String(Math.floor(audioProgress % 60)).padStart(2, '0')}
                  </span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[var(--color-monastery-accent)]"
                      style={{ width: `${(audioProgress / audioDuration) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono opacity-50 w-10">
                    {Math.floor(audioDuration / 60)}:{String(Math.floor(audioDuration % 60)).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            {/* Prayer Text Display */}
            <div className="glass-panel p-8 rounded-2xl flex-grow flex flex-col min-h-[400px] relative">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs uppercase tracking-widest opacity-50 flex items-center gap-2">
                  <BookOpen size={14} /> Liturgy Text
                </h3>
                <div className="flex items-center gap-4">
                  {isLoadingText && <span className="text-[10px] text-[var(--color-monastery-accent)] animate-pulse uppercase tracking-widest">Scribing...</span>}
                  {prayerText && (
                    <button 
                      onClick={handleCopy}
                      className="opacity-50 hover:opacity-100 transition-opacity text-[var(--color-monastery-accent)]"
                      title="Copy Liturgy (C)"
                    >
                      {isCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-grow overflow-y-auto max-h-[50vh] pr-2">
                <AnimatePresence mode="wait">
                  {error ? (
                    <motion.div 
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center gap-3 text-center"
                    >
                      <AlertCircle size={32} className="text-red-400 opacity-70" />
                      <p className="font-serif italic opacity-60">{error}</p>
                    </motion.div>
                  ) : prayerText ? (
                    <motion.div 
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="font-serif text-lg leading-relaxed space-y-4 text-center markdown-body"
                    >
                      <Markdown>{prayerText}</Markdown>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full flex flex-col items-center justify-center opacity-30 font-serif italic gap-4"
                    >
                      <p>Entering the Chapel...</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Row: Notebook & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Notebook />
          
          <AnimatePresence>
            {showSchedule && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="glass-panel p-6 rounded-2xl overflow-hidden"
              >
                <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4">Daily Rhythm</h3>
                <div className="space-y-3">
                  {HOURS_SCHEDULE.map((h) => (
                    <div key={h.name} className={`flex justify-between items-center p-2 rounded ${currentHour?.name === h.name ? 'bg-[var(--color-monastery-accent)] text-black' : 'hover:bg-white/5'}`}>
                      <div>
                        <span className="font-serif font-bold mr-3">{h.name}</span>
                        <span className="text-xs opacity-70">{h.description}</span>
                      </div>
                      <span className="font-mono text-sm">{h.timeString}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Branding Watermark Footer */}
        <footer className="mt-8 pt-8 border-t border-white/5 flex flex-col items-center gap-4 opacity-30 hover:opacity-100 transition-opacity duration-500">
          <p className="text-xs uppercase tracking-[0.4em] font-serif">
            Built by <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="text-[var(--color-monastery-accent)] hover:underline">Gatrivi</a>
          </p>
          <div className="flex gap-6 text-[10px] uppercase tracking-widest items-center">
            <a href="https://x.com/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Twitter</a>
            <a href="https://reddit.com/u/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Reddit</a>
            <span className="cursor-default">✠</span>
            <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Portfolio</a>
            <span className="cursor-default opacity-50 ml-2">v{__APP_VERSION__}</span>
          </div>
        </footer>

      </main>
    </div>
  );
}
