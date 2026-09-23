import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';

import { LanguageSelector } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';

export function AuthLayout({ children, onBack, title }: { children: ReactNode; onBack: () => void; title: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="auth-top-row">
          <button className="text-button back-button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />{t('back')}</button>
          <LanguageSelector label={t('languageLabel')} language={language} onChange={setLanguage} />
        </div>
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}
