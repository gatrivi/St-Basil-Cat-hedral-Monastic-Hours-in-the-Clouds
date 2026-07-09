import { getDaySlots, getDayPosition } from '../lib/liturgicalDay';

interface DayPlaylistSidebarProps {
  currentTime: Date;
  playlistRev?: number;
  onPick?: () => void;
}

/** Minimal nearby titles — no split-flap ticker. */
export function DayPlaylistSidebar({ currentTime, playlistRev = 0, onPick }: DayPlaylistSidebarProps) {
  void playlistRev;
  const pos = getDayPosition(currentTime);
  const slots = getDaySlots();
  const n = slots.length;
  if (n === 0) return null;

  const nearby = [-1, 0, 1, 2].map(d => {
    const i = (pos.slotIndex + d + n) % n;
    return { slot: slots[i], i, current: d === 0 };
  });

  return (
    <nav className="sidebar-mini flex flex-col gap-1 px-3 py-3" aria-label="Rezos cercanos">
      {nearby.map(({ slot, i, current }) => (
        <div
          key={`${slot.id}-${i}`}
          className={`sidebar-mini-row ${current ? 'is-current' : ''}`}
          onClick={onPick}
        >
          <span className="sidebar-mini-title">{slot.title}</span>
          {slot.subtitle && <span className="sidebar-mini-hint">{slot.subtitle}</span>}
        </div>
      ))}
    </nav>
  );
}
