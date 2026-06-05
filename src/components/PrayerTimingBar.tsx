import { motion } from 'motion/react';
import { DAY_SLOTS, formatMinutesUntil, getDayPosition } from '../lib/liturgicalDay';

interface PrayerTimingBarProps {
  currentTime: Date;
  slotIndexOverride?: number | null;
}

export function PrayerTimingBar({ currentTime, slotIndexOverride }: PrayerTimingBarProps) {
  const pos = getDayPosition(currentTime);
  const activeIndex = slotIndexOverride ?? pos.slotIndex;
  const slot = DAY_SLOTS[activeIndex] ?? pos.slot;
  const nextSlot = DAY_SLOTS[(activeIndex + 1) % DAY_SLOTS.length] ?? pos.nextSlot;
  const { slotProgress, msUntilNext } = pos;

  return (
    <div className="prayer-timing-bar w-full max-w-3xl mx-auto px-2">
      <div className="flex items-center justify-between gap-3 mb-2 text-[10px] uppercase tracking-widest opacity-60">
        <span className="truncate font-serif text-sm normal-case tracking-normal opacity-90">
          {slot.title}
          {slot.subtitle ? ` · ${slot.subtitle}` : ''}
        </span>
        {nextSlot && (
          <span className="shrink-0 text-right">
            Siguiente: <span className="text-[var(--color-monastery-accent)]">{nextSlot.title}</span>
            {' · '}
            {formatMinutesUntil(msUntilNext)}
          </span>
        )}
      </div>

      <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-2" aria-hidden>
        <motion.div
          className="h-full bg-[var(--color-monastery-accent)]/80"
          style={{ width: `${slotProgress * 100}%` }}
          layout
        />
      </div>

      <p className="text-[9px] text-center opacity-35 italic">
        Ritmo: {DAY_SLOTS.length} rezos repartidos en 24 h (~
        {Math.round((24 * 60) / DAY_SLOTS.length)} min cada uno)
      </p>
    </div>
  );
}
