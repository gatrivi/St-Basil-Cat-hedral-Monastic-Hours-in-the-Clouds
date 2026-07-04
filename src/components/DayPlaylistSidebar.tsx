import { DAY_SLOTS, getDayPosition, getSidebarWheel } from '../lib/liturgicalDay';
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

      <VerticalTicker
        className="flex-1 min-h-[10rem]"
        lines={tickerLines}
        position={pos.slotIndex + pos.slotProgress}
        aria-label="Tira de títulos de rezos"
      />
    </div>
  );
}
