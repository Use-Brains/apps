import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root'), {
  onUncaughtError(error) {
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
