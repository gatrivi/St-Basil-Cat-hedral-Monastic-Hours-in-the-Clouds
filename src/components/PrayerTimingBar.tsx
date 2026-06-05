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
      <div className="prayer-timing-meta flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2 opacity-80">
        <span className="hidden sm:inline font-serif text-sm truncate">
          {slot.title}
          {slot.subtitle ? ` · ${slot.subtitle}` : ''}
        </span>
        {nextSlot && (
          <span className="text-xs sm:text-sm uppercase tracking-wider sm:normal-case sm:tracking-normal text-center sm:text-right">
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

    </div>
  );
}
