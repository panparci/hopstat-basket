import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { purgeLegacyIndexedDb } from './lib/db';
import './index.css';

purgeLegacyIndexedDb();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
