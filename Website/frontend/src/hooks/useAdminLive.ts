"use client";

import { useEffect, useRef, useState } from 'react';

// Refresh on DB changes; reconnect catches missed events
export function useAdminLive(refresh: () => void | Promise<void>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
    const source = new EventSource(`${url}/api/admin/events`, { withCredentials: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false, pending = false, stopped = false;
    const run = async () => {
      if (running) { pending = true; return; }
      running = true;
      try { await latest.current(); } finally {
        running = false;
        if (pending && !stopped) { pending = false; timer = setTimeout(run, 300); }
      }
    };
    const update = () => {
      // coalesce bursts
      if (!timer) timer = setTimeout(() => { timer = undefined; void run(); }, 300);
    };
    source.addEventListener('ready', () => { setConnected(true); update(); });
    source.addEventListener('update', update);
    source.onerror = () => setConnected(false);
    return () => { stopped = true; source.close(); clearTimeout(timer); };
  }, []);
  return connected;
}
