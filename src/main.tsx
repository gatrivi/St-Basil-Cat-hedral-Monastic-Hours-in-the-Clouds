import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[DEBUG] CRITICAL RENDER ERROR:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'white', background: 'red', fontFamily: 'monospace' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log('[DEBUG] main.tsx: Entry point loaded');
const rootElement = document.getElementById('root');

function updateStatus(msg: string, color: string = 'gray') {
  console.log(`[STATUS] ${msg}`);
  const statusCheck = document.getElementById('status-check');
  if (statusCheck) {
    statusCheck.innerHTML += ` <span style="color: ${color}">> ${msg}</span>`;
  }
}

updateStatus('JS START', '#0f0');

if (!rootElement) {
  updateStatus('CRITICAL: NO ROOT', 'red');
  console.error('[DEBUG] main.tsx: CRITICAL - Root element not found in DOM');
} else {
  updateStatus('ROOT FOUND', '#0f0');
  try {
    updateStatus('CREATING ROOT', '#0f0');
    const root = createRoot(rootElement);
    
    updateStatus('RENDERING', '#0f0');
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    updateStatus('RENDER CALLED', '#0f0');
    
    // Hide status bar after a delay if everything seems okay
    setTimeout(() => {
      const statusCheck = document.getElementById('status-check');
      if (statusCheck) statusCheck.style.display = 'none';
    }, 5000);
    
  } catch (err: any) {
    updateStatus('RENDER CRASH: ' + err.message, 'red');
    console.error('[DEBUG] main.tsx: EXCEPTION DURING RENDER', err);
  }
}
