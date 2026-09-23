import agrisahayaLogo from '../../../image.png';
import { LanguageSelector } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';

export function Landing({ onMechanicLogin, onMechanicSignup }: { onMechanicLogin: () => void; onMechanicSignup: () => void }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="landing-page">
      <section className="hero-panel">
        <div className="landing-card-actions">
          <LanguageSelector label={t('languageLabel')} language={language} onChange={setLanguage} />
        </div>
        <img alt="AgriSahaya logo" className="hero-logo" src={agrisahayaLogo} />
        <p className="eyebrow">{t('villageDistrictNetwork')}</p>
        <h1>{t('mechanicDirectory')}</h1>
        <p>{t('heroDescription')}</p>
        <div className="hero-actions">
          <button className="primary large" onClick={onMechanicLogin}>{t('technicianLogin')}</button>
          <button className="secondary large" onClick={onMechanicSignup}>{t('technicianSignup')}</button>
        </div>
      </section>
    </main>
  );
}
