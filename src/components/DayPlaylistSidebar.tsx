import { formatMinutesUntil, getSidebarWheel } from '../lib/liturgicalDay';

interface DayPlaylistSidebarProps {
  currentTime: Date;
}

export function DayPlaylistSidebar({ currentTime }: DayPlaylistSidebarProps) {
  const wheel = getSidebarWheel(currentTime);

  return (
    <div className="sidebar-wheel flex flex-col flex-1 min-h-0 px-3 py-2">
      <header className="shrink-0 text-center pb-2 border-b border-white/10">
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
            Siguiente rezo · {formatMinutesUntil(wheel.msUntilNext)}
          </p>
        )}
      </header>

      <ul
        className="sidebar-wheel-list flex-1 min-h-0 flex flex-col"
        aria-label="Rezos del grupo actual y siguiente"
        style={{ '--wheel-rows': wheel.items.length } as React.CSSProperties}
      >
        {wheel.items.map((item, i) => {
          const isActive = i === wheel.activeIndex;
          const showDivider = item.isNextGroup && i > 0 && !wheel.items[i - 1].isNextGroup;
          const title = item.slot.groupKind === 'angelus' ? 'Ángelus' : item.slot.title;
          return (
            <li
              key={item.slot.id}
              className={`sidebar-wheel-item flex-1 min-h-0 flex flex-col items-center justify-center ${isActive ? 'is-active' : ''} ${item.isNextGroup ? 'is-next-group' : ''}`}
            >
              {showDivider && <span className="sidebar-wheel-divider shrink-0" aria-hidden />}
              <span className="sidebar-wheel-title">{title}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
