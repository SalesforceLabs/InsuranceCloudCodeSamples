import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@salesforce-ux/design-system-2/dist/css/modular/slds2.theme.cosmos.css';
import './styles/global.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
