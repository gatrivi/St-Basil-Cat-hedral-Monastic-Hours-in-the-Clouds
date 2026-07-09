/**
 * Update banner disabled — it trapped users in a permanent "Actualizar" loop
 * whenever local VERSION and /version.json drifted. Re-enable only with a
 * proven SW + hard cache-bust path.
 */
export function useUpdateCheck(_localVersion: string) {
  return {
    updateAvailable: null as null,
    reload: () => window.location.reload(),
    dismiss: (_version: string) => {},
    check: async () => {},
  };
}
