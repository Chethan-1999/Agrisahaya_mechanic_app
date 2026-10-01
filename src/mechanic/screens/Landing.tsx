import agrisahayaLogo from '../../../image.png';
import { ArrowRight, History, MapPin, ShieldCheck, Sprout, UserRound, UserPlus } from 'lucide-react';
import { LanguageSelector } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';

export function Landing({ onMechanicLogin, onMechanicSignup }: { onMechanicLogin: () => void; onMechanicSignup: () => void }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="landing-page farm-landing" lang={language}>
      <section className="hero-panel">
        <div className="landing-card-actions">
          <LanguageSelector label={t('languageLabel')} language={language} onChange={setLanguage} />
        </div>
        <div className="landing-brand">
          <img alt="Agrisahay logo" className="hero-logo" src={agrisahayaLogo} />
          <p className="eyebrow">{t('villageDistrictNetwork')}</p>
          <h1>{t('mechanicDirectory')}</h1>
          <p className="hero-tagline">{t('heroDescription')}</p>
          <ul className="landing-benefits">
            <li><span><History aria-hidden="true" /></span><p>{t('landingQuick')}</p></li>
            <li><span><ShieldCheck aria-hidden="true" /></span><p>{t('landingTrusted')}</p></li>
            <li><span><MapPin aria-hidden="true" /></span><p>{t('landingVillages')}</p></li>
          </ul>
        </div>
        <footer className="landing-access">
          <div className="hero-actions" aria-label={t('landingPartner')}>
            <span className="service-partner-label">{t('landingPartner')}</span>
            <button className="primary large" onClick={onMechanicLogin}>
              <UserRound aria-hidden="true" />
              <span>{t('technicianLogin')}</span>
              <ArrowRight aria-hidden="true" />
            </button>
            <button className="secondary large" onClick={onMechanicSignup}>
              <UserPlus aria-hidden="true" />
              <span>{t('technicianSignup')}</span>
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className="landing-signoff">
            <Sprout aria-hidden="true" />
            <p>{t('landingTogether')}</p>
          </div>
        </footer>
      </section>
    </main>
  );
}
