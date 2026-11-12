import { useEffect, useState } from 'react';

// v0.86.4: the demo account is read-only. The server refuses every change it tries with
// 403 { demo: true, error }. This wraps fetch once so any such answer, from any screen,
// raises the "blocked in demo mode" popup (DemoBlockedPopup in App.jsx).
export const DEMO_BLOCKED_EVENT = 'blackquill:demo-blocked';
export const DEMO_FALLBACK_MESSAGE = 'This is blocked in demo mode.';

export function installDemoGuard() {
  if (typeof window === 'undefined' || window.__bqDemoGuard) return;
  window.__bqDemoGuard = true;
  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await original(...args);
    if (res.status === 403) {
      try {
        const data = await res.clone().json();
        if (data?.demo) window.dispatchEvent(new CustomEvent(DEMO_BLOCKED_EVENT, { detail: data.error || DEMO_FALLBACK_MESSAGE }));
      } catch {}
    }
    return res;
  };
}

// The message to show, or '' when there is nothing to show.
export function useDemoBlocked() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const onBlocked = (e) => setMessage(e.detail || DEMO_FALLBACK_MESSAGE);
    window.addEventListener(DEMO_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(DEMO_BLOCKED_EVENT, onBlocked);
  }, []);
  return [message, () => setMessage('')];
}
