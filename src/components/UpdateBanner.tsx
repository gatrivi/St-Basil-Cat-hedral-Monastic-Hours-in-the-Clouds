interface UpdateBannerProps {
  version: string;
  onReload: () => void;
}

export function UpdateBanner({ version, onReload }: UpdateBannerProps) {
  return (
    <div
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] glass-panel border border-[var(--color-monastery-accent)]/40 px-4 py-3 flex flex-col sm:flex-row items-center gap-3 shadow-lg"
      role="dialog"
      aria-live="polite"
      aria-label="Actualización disponible"
    >
      <p className="text-sm text-center sm:text-left flex-1">
        Hay una versión nueva <strong className="text-[var(--color-monastery-accent)]">v{version}</strong>.
        Pulsa para recargar la capilla.
      </p>
      <button
        type="button"
        onClick={onReload}
        className="sidebar-footer-btn shrink-0 !w-auto px-5"
      >
        Actualizar
      </button>
    </div>
  );
}
