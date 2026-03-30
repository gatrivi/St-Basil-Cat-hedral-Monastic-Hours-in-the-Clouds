import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Play, Pause, Volume2, VolumeX, SkipForward } from 'lucide-react';
import { format } from 'date-fns';
import Markdown from 'react-markdown';
import { getCurrentAndNextHour, HOURS_SCHEDULE, LiturgicalHour } from './lib/hours';
import { generatePrayerText, generatePrayerAudio } from './services/gemini';

// A simple bell sound (public domain/CC0)
const BELL_SOUND_URL = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Bell-sound.ogg';

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentHour, setCurrentHour] = useState<LiturgicalHour | null>(null);
  const [nextHour, setNextHour] = useState<LiturgicalHour | null>(null);
  const [prayerText, setPrayerText] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const bellRef = useRef<HTMLAudioElement | null>(null);

  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const lastPlayedHourRef = useRef<string | null>(null);

  // Update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const { currentHour: curr, nextHour: next } = getCurrentAndNextHour(now);
      setCurrentHour(curr);
      setNextHour(next);
      
      // Auto-play logic
      if (isAutoPlay && curr && !isPlaying && !isLoading) {
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
  }, [isAutoPlay, isPlaying, isLoading]);

  const playHour = async (hour: LiturgicalHour) => {
    if (isPlaying) return;
    setIsLoading(true);
    setPrayerText('');
    
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
      }

      // 3. Play Bell
      if (bellRef.current && !isMuted) {
        bellRef.current.currentTime = 0;
        await bellRef.current.play();
      }
      
      // 4. Play Audio after a short delay for the bell
      setTimeout(async () => {
        if (audioRef.current) {
          setIsPlaying(true);
          setIsLoading(false);
          await audioRef.current.play();
        }
      }, 4000); // 4 seconds for the bell to ring out
      
    } catch (error) {
      console.error('Failed to play hour:', error);
      setPrayerText('Failed to load prayer. Please try again.');
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
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
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (audioRef.current) audioRef.current.muted = !isMuted;
    if (bellRef.current) bellRef.current.muted = !isMuted;
  };

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
      />

      <main className="w-full max-w-3xl flex flex-col gap-12 z-10">
        
        {/* Header / Clock */}
        <header className="text-center space-y-4">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-serif text-6xl md:text-8xl font-light tracking-widest text-monastery-accent"
            style={{ color: 'var(--color-monastery-accent)' }}
          >
            {format(currentTime, 'HH:mm')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm uppercase tracking-[0.3em] opacity-60"
          >
            {format(currentTime, 'EEEE, MMMM do')}
          </motion.p>
        </header>

        {/* Current / Next Hour Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Current Hour</p>
              <h2 className="font-serif text-3xl">{currentHour?.name || '...'}</h2>
              <p className="text-sm opacity-70 mt-1">{currentHour?.description}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="font-mono text-sm opacity-50">{currentHour?.timeString}</span>
              <button 
                onClick={() => currentHour && playHour(currentHour)}
                disabled={isLoading || isPlaying}
                className="flex items-center gap-2 text-sm uppercase tracking-wider hover:text-[var(--color-monastery-accent)] transition-colors disabled:opacity-50"
              >
                <Play size={16} /> Play Now
              </button>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between opacity-70">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-50 mb-2">Next Hour</p>
              <h2 className="font-serif text-3xl">{nextHour?.name || '...'}</h2>
              <p className="text-sm opacity-70 mt-1">{nextHour?.description}</p>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <span className="font-mono text-sm opacity-50">{nextHour?.timeString}</span>
            </div>
          </div>
        </div>

        {/* Player Controls */}
        <div className="glass-panel p-6 rounded-3xl flex flex-col items-center justify-center gap-6 mx-auto w-fit px-12">
          <div className="flex items-center justify-center gap-8">
            <button onClick={toggleMute} className="hover:text-[var(--color-monastery-accent)] transition-colors">
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            
            <button 
              onClick={togglePlayPause}
              disabled={isLoading}
              className="w-16 h-16 rounded-full border border-[var(--color-monastery-accent)] flex items-center justify-center text-[var(--color-monastery-accent)] hover:bg-[var(--color-monastery-accent)] hover:text-black transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-[var(--color-monastery-accent)]"
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
            >
              <SkipForward size={20} />
            </button>
          </div>
          
          <label className="flex items-center gap-2 text-xs uppercase tracking-widest opacity-70 cursor-pointer hover:opacity-100 transition-opacity">
            <input 
              type="checkbox" 
              checked={isAutoPlay} 
              onChange={(e) => setIsAutoPlay(e.target.checked)}
              className="accent-[var(--color-monastery-accent)]"
            />
            Auto-play at hour
          </label>
        </div>

        {/* Prayer Text Display */}
        <AnimatePresence>
          {prayerText && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-panel p-8 rounded-2xl max-h-[40vh] overflow-y-auto w-full"
            >
              <div className="font-serif text-lg leading-relaxed space-y-4 text-center markdown-body">
                <Markdown>{prayerText}</Markdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
