import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, SkipForward, BookOpen, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

function Notebook() {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch('/api/notebook')
      .then(res => res.json())
      .then(data => setContent(data.content))
      .catch(err => console.error("Failed to load notebook", err));
  }, []);

  const handleSave = async (newContent: string) => {
    setContent(newContent);
    setIsSaving(true);
    try {
      await fetch('/api/notebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      });
    } catch (err) {
      console.error("Failed to save notebook", err);
    }
    setIsSaving(false);
  };

  return (
    <div className="glass-panel p-6 rounded-2xl flex flex-col h-64 md:h-full">
      <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 flex justify-between">
        <span>Personal Notebook</span>
        {isSaving && <span className="text-[var(--color-monastery-accent)]">Saving...</span>}
      </h3>
      <textarea
        value={content}
        onChange={(e) => handleSave(e.target.value)}
        className="w-full h-full bg-transparent resize-none outline-none font-serif text-lg leading-relaxed text-[var(--color-monastery-text)] placeholder:opacity-30"
        placeholder="Write your chores and thoughts here..."
      />
    </div>
  );
}

export default function App() {
  const [hasEntered, setHasEntered] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);
  const notebookRef = useRef<HTMLTextAreaElement | null>(null);

  const lastPlayedHourRef = useRef<string | null>(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      setCurrentHour(curr);
      setNextHour(next);
      
      // Auto-play logic (always on, simulating live monastery)
      if (hasEntered && curr && !isPlaying && !isLoading) {
        const hourId = `${format(now, 'yyyy-MM-dd')}-${curr.name}`;
        if (lastPlayedHourRef.current !== hourId) {
          // Check if we are within the first 5 minutes of the hour
          const currentMinutes = now.getMinutes();
          if (currentMinutes < 5) {
            lastPlayedHourRef.current = hourId;
            playHour(curr);
          }
        }
      }
    }, 60000);

    // Initial setup
    const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(new Date());
    setCurrentHour(curr);
    setNextHour(next);

    return () => clearInterval(timer);
  }, [hasEntered, isPlaying, isLoading]);

  const handleEnter = () => {
    setHasEntered(true);
    if (currentHour) {
      const now = new Date();
      const hourId = `${format(now, 'yyyy-MM-dd')}-${currentHour.name}`;
      lastPlayedHourRef.current = hourId;
      playHour(currentHour, true);
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
        case 'n':
        case 'N':
          e.preventDefault();
          notebookRef.current?.focus();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasEntered, isPlaying, isLoading, isMuted]);

  const playHour = async (hour: LiturgicalHour, fadeIn: boolean = false) => {
    if (isPlaying) return;
    setIsLoading(true);
    setPrayerText('');
    setError(null);
    
    try {
      // 1. Generate Text
      const text = await generatePrayerText(hour.name, new Date());
      setPrayerText(text);

      // 2. Generate Audio
      const audioBase64 = await generatePrayerAudio(text);
      const audioUrl = `data:audio/wav;base64,${audioBase64}`;
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.muted = isMuted;
        if (fadeIn) {
          audioRef.current.volume = 0;
        } else {
          audioRef.current.volume = 1;
        }
      }

      // 3. Play Bell
      if (bellRef.current && !isMuted) {
        bellRef.current.currentTime = 0;
        bellRef.current.volume = fadeIn ? 0.5 : 1;
        await bellRef.current.play();
      }
      
      // 4. Play Audio after a short delay for the bell
      setTimeout(async () => {
        if (audioRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
          await audioRef.current.play();
          
          if (fadeIn) {
            // Fade in over 5 seconds
            let vol = 0;
            const fadeInterval = setInterval(() => {
              vol += 0.05;
              if (vol >= 1) {
                if (audioRef.current) audioRef.current.volume = 1;
                clearInterval(fadeInterval);
              } else {
                if (audioRef.current) audioRef.current.volume = vol;
              }
            }, 250);
          }
        }
      }, 4000); // 4 seconds for the bell to ring out
      
    } catch (err) {
      console.error('Failed to play hour:', err);
      setError('The monks are in silent contemplation. Please try again.');
      setIsLoading(false);
    }
  };

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
  }, [isPlaying, currentHour]);

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
            Click anywhere to begin
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
            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2 flex items-center gap-2 z-10">
                <Clock size={14} /> Current Hour
              </p>
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

            <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between opacity-70 relative overflow-hidden">
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2 z-10">Next Hour</p>
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
                  disabled={isLoading}
                  className="w-16 h-16 rounded-full border border-[var(--color-monastery-accent)] flex items-center justify-center text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-monastery-accent)]"
                  title="Play / Pause (Space)"
                >
                  {isLoading ? (
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

                <button 
                  onClick={() => nextHour && playHour(nextHour)}
                  disabled={isLoading || isPlaying}
                  className="hover:text-[var(--color-monastery-accent)] transition-colors disabled:opacity-50"
                  title="Skip to next hour"
                >
                  <SkipForward size={20} />
                </button>
              </div>

              {/* Audio Progress */}
              {audioDuration > 0 && (
                <div className="w-full flex items-center gap-3 px-4">
                  <span className="text-xs font-mono opacity-50 w-10 text-right">
                    {Math.floor(audioProgress / 60)}:{String(Math.floor(audioProgress % 60)).padStart(2, '0')}
                  </span>
                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = (e.clientX - rect.left) / rect.width;
                      if (audioRef.current) {
                        audioRef.current.currentTime = pct * audioDuration;
                      }
                    }}
                  >
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
            <div className="glass-panel p-8 rounded-2xl flex-grow flex flex-col">
              <h3 className="text-xs uppercase tracking-widest opacity-50 mb-4 flex items-center gap-2">
                <BookOpen size={14} /> Liturgy Text
              </h3>
              <div className="flex-grow overflow-y-auto max-h-[40vh] pr-2">
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
                      <button 
                        onClick={() => currentHour && playHour(currentHour)}
                        className="mt-2 text-xs uppercase tracking-widest hover:text-[var(--color-monastery-accent)] transition-colors"
                      >
                        Try Again
                      </button>
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
                      className="h-full flex items-center justify-center opacity-30 font-serif italic"
                    >
                      The chapel is quiet.
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
          <div className="flex gap-6 text-[10px] uppercase tracking-widest">
            <a href="https://x.com/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Twitter</a>
            <a href="https://reddit.com/u/gatrivi" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Reddit</a>
            <span className="cursor-default">✠</span>
            <a href="https://gatrivi.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--color-monastery-accent)] transition-colors">Portfolio</a>
          </div>
        </footer>

      </main>
    </div>
  );
}
