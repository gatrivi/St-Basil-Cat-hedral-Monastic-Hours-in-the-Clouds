import { formatMinutesUntil, getGroupProgress } from '../lib/liturgicalDay';

interface PrayerTimingBarProps {
  currentTime: Date;
  slotIndexOverride?: number | null;
}

export function PrayerTimingBar({ currentTime, slotIndexOverride }: PrayerTimingBarProps) {
  const gp = getGroupProgress(currentTime, slotIndexOverride);
  const { slots, indexInGroup, slotProgress, weights, nextSlot, msUntilNext, browsing } = gp;
  const slot = slots[indexInGroup] ?? slots[0];

  return (
    <div className="prayer-timing-bar w-full max-w-3xl mx-auto px-2">
      <div className="prayer-timing-meta flex items-center justify-between gap-2 mb-2 opacity-80">
        <span className="font-serif text-xs truncate whitespace-nowrap">
          {slot?.title}
          {slot?.subtitle ? ` · ${slot.subtitle}` : ''}
        </span>
        {nextSlot && (
          <span className="text-sm uppercase tracking-wider whitespace-nowrap text-center sm:text-right truncate">
            Siguiente:{' '}
            <span className="text-[var(--color-monastery-accent)]">{nextSlot.title}</span>
            {!browsing && msUntilNext != null ? (
              <> · {formatMinutesUntil(msUntilNext)}</>
            ) : null}
          </span>
        )}
      </div>

      <div
        className="prayer-progress-dots flex items-stretch gap-1 h-2 mb-2"
        role="progressbar"
        aria-valuenow={Math.round(((indexInGroup + slotProgress) / Math.max(1, slots.length)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso del grupo ${gp.group.label}`}
      >
        {slots.map((s, i) => {
          const fill =
            i < indexInGroup ? 1 : i === indexInGroup ? slotProgress : 0;
          return (
            <div
              key={s.id}
              className="prayer-progress-dot rounded-full overflow-hidden bg-white/10 min-w-[4px]"
              style={{ flex: `${weights[i]} 0 0` }}
              title={s.title}
            >
              <div
                className="h-full bg-[var(--color-monastery-accent)]/70 transition-[width] duration-1000 ease-linear rounded-full"
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
