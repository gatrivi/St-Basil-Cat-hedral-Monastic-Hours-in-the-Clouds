import { DAY_SLOTS, formatMinutesUntil, getDayPosition, getSidebarWheel } from '../lib/liturgicalDay';
import { VerticalTicker } from './VerticalTicker';

interface DayPlaylistSidebarProps {
  currentTime: Date;
}

export function DayPlaylistSidebar({ currentTime }: DayPlaylistSidebarProps) {
  const pos = getDayPosition(currentTime);
  const wheel = getSidebarWheel(currentTime);

  const tickerLines = DAY_SLOTS.map(slot => ({
    id: slot.id,
    label: slot.groupKind === 'angelus' ? 'Ángelus' : slot.title,
    hint: slot.groupKind === 'angelus' ? slot.anchorTime : slot.subtitle,
  }));

  return (
    <div className="sidebar-ticker-panel flex flex-col flex-1 min-h-0 px-2 py-2">
      <header className="shrink-0 text-center pb-2 border-b border-white/10 px-1">
        <p className="sidebar-wheel-group-label">
          {wheel.currentGroup.kind === 'angelus' ? 'Ángelus' : wheel.currentGroup.label}
          <span className="opacity-50"> · {wheel.currentGroup.timeString}</span>
        </p>
        <p className="sidebar-wheel-group-next opacity-70">
          Después: {wheel.nextGroup.kind === 'angelus' ? 'Ángelus' : wheel.nextGroup.label}
          <span className="opacity-50"> · {wheel.nextGroup.timeString}</span>
        </p>
        {wheel.nextTitle && (
          <p className="sidebar-wheel-eta">
            Siguiente · {formatMinutesUntil(wheel.msUntilNext)}
          </p>
        )}
      </header>

      <VerticalTicker
        className="flex-1 min-h-[10rem]"
        lines={tickerLines}
        position={pos.slotIndex + pos.slotProgress}
        aria-label="Tira de títulos de rezos"
      />
      <p className="shrink-0 text-center text-[10px] opacity-40 pt-1 uppercase tracking-widest">
        Una vuelta en 24 h
      </p>
    </div>
  );
}
