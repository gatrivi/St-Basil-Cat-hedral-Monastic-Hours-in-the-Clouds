import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log('[DEBUG] main.tsx: Entry point loaded');
const rootElement = document.getElementById('root');
console.log('[DEBUG] main.tsx: Root element found:', !!rootElement);

if (!rootElement) {
  console.error('[DEBUG] main.tsx: CRITICAL - Root element not found in DOM');
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('[DEBUG] main.tsx: render() called');
}
