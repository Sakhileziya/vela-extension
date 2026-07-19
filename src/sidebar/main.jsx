/**
 * @file main.jsx
 * @description React entry point. Mounts App into the DOM.
 * Global CSS animation keyframes injected here.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Inject global animation keyframes that components reference
const globalStyles = document.createElement('style');
globalStyles.textContent = `
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Focus styles — accessibility */
  button:focus-visible,
  textarea:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Auto-grow textarea */
  textarea {
    field-sizing: content;
  }
`;
document.head.appendChild(globalStyles);

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
