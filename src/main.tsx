import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/tokens.css';
import './styles/globals.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('AuraMesh root element is missing.');
}

if (import.meta.env.DEV && window.location.pathname === '/__renderer-demo') {
  void import('./dev/renderer-demo').then(({ mountRendererDemo }) =>
    mountRendererDemo(root),
  );
} else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
