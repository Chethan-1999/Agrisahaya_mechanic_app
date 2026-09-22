import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { I18nProvider } from '../i18n/I18nContext';
import '../styles.css';
import AdminApp from './AdminApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AdminApp />
    </I18nProvider>
  </StrictMode>,
);
