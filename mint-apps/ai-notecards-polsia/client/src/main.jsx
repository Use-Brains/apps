import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.jsx';
import './index.css';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError(error) {
    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { level: 'fatal' });
    }
    console.error('Uncaught React error:', error);
  },
  onRecoverableError(error) {
    console.warn('Recoverable React error:', error);
  },
}).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
