import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { App } from '@/app/App';
import '@/app/styles/globals.css';

// ponytail: dev-only self-heal — a service worker registered by an earlier
// production preview on this same origin/port silently breaks every fetch
// under `vite dev` (which doesn't serve /sw.js itself). Unregister on every
// dev load instead of relying on someone remembering to clear it by hand.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length === 0) {
      return;
    }
    void Promise.all(registrations.map((r) => r.unregister())).then(() => {
      if (navigator.serviceWorker.controller) {
        location.reload();
      }
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>,
);
