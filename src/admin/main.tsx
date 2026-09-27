import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { loadSettings } from '../config/settings';
import { I18nProvider } from '../i18n/I18nContext';
import '../styles.css';
import AdminApp from './AdminApp';

// Business settings are read synchronously everywhere after this, so they load before the first render.
void loadSettings().then(() => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AdminApp />
    </I18nProvider>
  </StrictMode>,
));
