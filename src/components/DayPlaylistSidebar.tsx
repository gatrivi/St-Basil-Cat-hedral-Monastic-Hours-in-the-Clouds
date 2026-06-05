import { useEffect, useRef } from 'react';
import {
  DAY_SLOTS,
  getDayPosition,
  getUpcomingGroups,
  PrayerSlot,
} from '../lib/liturgicalDay';
import { LiturgicalHour } from '../lib/hours';

interface DayPlaylistSidebarProps {
  currentTime: Date;
  currentHour: LiturgicalHour | null;
}

function SlotRow({
  slot,
  isActive,
  isPast,
}: {
  slot: PrayerSlot;
  isActive: boolean;
  isPast: boolean;
}) {
  return (
    <div
      data-slot-id={slot.id}
      className={`schedule-item py-2 pr-2 ${isActive ? 'active' : ''} ${isPast ? 'past' : 'future'}`}
    >
      <div className="schedule-dot" />
      <div className="flex flex-col gap-0.5 min-w-0">
        {slot.groupKind === 'angelus' && (
          <span className="text-[9px] uppercase tracking-widest text-[var(--color-monastery-accent)]">
            Ángelus · {slot.anchorTime}
          </span>
        )}
        <span
          className={`font-serif text-sm leading-tight truncate ${
            isActive ? 'text-[var(--color-monastery-accent)]' : ''
          } ${slot.groupKind === 'angelus' ? 'font-semibold' : ''}`}
        >
          {slot.title}
        </span>
        {slot.subtitle && (
          <span className="text-[10px] opacity-50 truncate">{slot.subtitle}</span>
        )}
      </div>
    </div>
  );
}

export function DayPlaylistSidebar({ currentTime, currentHour }: DayPlaylistSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { slotIndex, slotProgress } = getDayPosition(currentTime);
  const upcomingGroups = getUpcomingGroups(currentTime, 5);

  // One full scroll through all titles per 24 h, advancing smoothly within each slot
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const fractional = (slotIndex + slotProgress) / Math.max(1, DAY_SLOTS.length - 1);
    el.scrollTop = fractional * maxScroll;
  }, [slotIndex, slotProgress]);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 py-3 border-b border-white/5 shrink-0">
        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">
          Grupos de oración
        </p>
        <div className="flex flex-wrap gap-1.5">
          {upcomingGroups.map((g, i) => (
            <span
              key={g.id}
              className={`text-[10px] px-2 py-1 rounded-full border ${
                i === 0
                  ? 'border-[var(--color-monastery-accent)]/60 text-[var(--color-monastery-accent)] bg-[var(--color-monastery-accent)]/10'
                  : 'border-white/10 opacity-60'
              }`}
            >
              {g.kind === 'angelus' ? 'Ángelus' : g.label}
              <span className="opacity-50 ml-1">{g.timeString}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3 pb-1 shrink-0">
        <p className="text-[10px] uppercase tracking-widest opacity-50">
          Rezos del día
        </p>
        <p className="text-[9px] opacity-40 mt-0.5 italic">
          La lista completa una vuelta en 24 h
        </p>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 min-h-[120px] playlist-rail-scroll"
        aria-label="Lista de rezos del día"
      >
        {DAY_SLOTS.map((slot, i) => (
          <SlotRow
            key={slot.id}
            slot={slot}
            isActive={i === slotIndex}
            isPast={i < slotIndex}
          />
        ))}
      </div>

      {currentHour && (
        <div className="px-4 py-2 border-t border-white/5 shrink-0 opacity-50 text-[9px]">
          Hora litúrgica activa: {currentHour.name}
        </div>
      )}
    </div>
  );
}
