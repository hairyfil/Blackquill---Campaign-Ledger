import { useEffect, useState } from 'react';

// Reads the running app version from the server (VERSION in server/lib/filesystem/paths.js),
// so the label always matches the server that is actually running.
let cached = null;

export function useAppVersion() {
  const [version, setVersion] = useState(cached || '');
  useEffect(() => {
    if (cached) return;
    fetch('/api/version').then((r) => (r.ok ? r.json() : {})).then((d) => {
      if (d?.version) { cached = d.version; setVersion(d.version); }
    }).catch(() => {});
  }, []);
  return version;
}
