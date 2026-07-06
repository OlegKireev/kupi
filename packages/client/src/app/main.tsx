import { MantineProvider } from '@mantine/core';
import { Notifications, notifications } from '@mantine/notifications';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import { App } from './App';
import './styles/globals.css';
import { theme } from './theme/theme';

// Ponytail: dev-only self-heal — a service worker registered by an earlier
// Production preview on this same origin/port silently breaks every fetch
// Under `vite dev` (which doesn't serve /sw.js itself). Unregister on every
// Dev load instead of relying on someone remembering to clear it by hand.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    if (registrations.length === 0) {
      return;
    }
    Promise.all(registrations.map((reg) => reg.unregister())).then(() => {
      if (navigator.serviceWorker.controller) {
        location.reload();
      }
    });
  });
}

// Общий страховочный экран для действий-обработчиков, которые не await'ятся
// (onClick-хендлеры меню/сабмиты): любой необработанный reject показывает
// тост вместо молчаливого провала. Точечные хендлеры сами гасят ожидаемые
// ошибки (например, invalid-code) — сюда долетает только неожиданное.
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  notifications.show({ color: 'red', message: 'Что-то пошло не так' });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('#root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>,
);
