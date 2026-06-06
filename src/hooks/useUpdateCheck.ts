import { useCallback, useEffect, useRef, useState } from 'react';
import { perfLog, perfWarn } from '../lib/perfLog';

const CHECK_MS = 5 * 60 * 1000;

interface RemoteVersion {
  version: string;
  builtAt?: string;
}

export function useUpdateCheck(localVersion: string) {
  const [updateAvailable, setUpdateAvailable] = useState<RemoteVersion | null>(null);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    perfLog('update-check:start', { localVersion });
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        perfWarn('update-check:http', res.status);
        return;
      }
      const remote = (await res.json()) as RemoteVersion;
      perfLog('update-check:remote', remote);
      if (remote.version && remote.version !== localVersion) {
        setUpdateAvailable(remote);
        perfLog('update-check:available', { from: localVersion, to: remote.version });
      }
    } catch (err) {
      perfWarn('update-check:fail', err);
    } finally {
      checkingRef.current = false;
    }
  }, [localVersion]);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  const reload = useCallback(() => {
    perfLog('update-check:reload');
    window.location.reload();
  }, []);

  return { updateAvailable, reload, check };
}
