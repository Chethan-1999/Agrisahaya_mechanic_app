import { createContext, useContext, useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { BriefcaseBusiness, ChevronDown, Headphones, Store, UserRound, UsersRound } from 'lucide-react';

import agrisahayLogo from '../image.png';
import { loginAdmin, logoutAdmin } from './shared/services/adminAuth';
import { createCommunityPost, listCommunityPosts } from './shared/services/community';
import { assignJob, createJob, deleteJob, getNextJobId, listAssignedJobs, listJobs, updateJob } from './shared/services/jobs';
import { createMechanic, deleteMechanic, findMechanicByPhone, getMechanic, listMechanics, updateMechanic } from './shared/services/mechanics';
import { canVerifyOtp, createOtpCode } from './shared/services/otp';
import type { AdminProfile, AppSession, CommunityPost, Job, JobForm, Mechanic, MechanicForm } from './shared/types';
import { emptyJobForm, emptyMechanicForm } from './shared/types';
import { languageNames, translations, type Language, type TranslationKey } from './shared/i18n';
import { indianStates } from './shared/utils/indianStates';
import { hasErrors, isValidPhone, validateMechanicForm, type ValidationErrors } from './shared/utils/validation';

type Page =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicJobs'
  | 'mechanicCommunity'
  | 'mechanicMarketplace'
  | 'mechanicProfile'
  | 'mechanicEdit'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminJobs'
  | 'adminAssignJobs'
  | 'adminCommunity'
  | 'adminDetails'
  | 'adminEdit';

type Toast = { kind: 'success' | 'error'; text: string } | null;

type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  kind?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
} | null;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, values?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const navItems: Array<{ labelKey: TranslationKey; page: Page }> = [
  { labelKey: 'adminDashboard', page: 'adminDashboard' },
  { labelKey: 'mechanics', page: 'adminMechanics' },
  { labelKey: 'addNewJobs', page: 'adminJobs' },
  { labelKey: 'assignJobs', page: 'adminAssignJobs' },
  { labelKey: 'adminCommunity', page: 'adminCommunity' },
];

const mechanicTabs: Array<{ Icon: typeof BriefcaseBusiness; label: string; page: Page }> = [
  { Icon: BriefcaseBusiness, label: 'Jobs', page: 'mechanicJobs' },
  { Icon: UsersRound, label: 'Community', page: 'mechanicCommunity' },
  { Icon: Store, label: 'Marketplace', page: 'mechanicMarketplace' },
  { Icon: UserRound, label: 'Profile', page: 'mechanicProfile' },
];

function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('I18n context is not available.');
  return context;
}

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [session, setSession] = useState<AppSession>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>([]);
  const [communitySeenAt, setCommunitySeenAt] = useState('');
  const [currentMechanic, setCurrentMechanic] = useState<Mechanic | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState<Language>('en');

  const i18n = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key, values = {}) => Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
      String(translations[language][key]),
    ),
  }), [language]);

  const { t } = i18n;

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    const { t } = i18n;
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (session?.role === 'mechanic') {
      void loadCurrentMechanic(session.mechanicId);
      void loadAssignedJobs(session.mechanicId);
      void loadCommunityPosts();
      setCommunitySeenAt(getStoredCommunitySeenAt(session.mechanicId));
    }

    if (session?.role === 'admin') {
      void loadMechanics();
      void loadJobs();
      void loadCommunityPosts();
    }
  }, [session]);

  useEffect(() => {
    if (session?.role !== 'mechanic' || page !== 'mechanicCommunity') return;

    markCommunitySeen(session.mechanicId);
  }, [communityPosts.length, page, session]);

  async function withLoading(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      setToast({ kind: 'error', text: getErrorMessage(error, t('somethingWentWrong')) });
    } finally {
      setLoading(false);
    }
  }

  async function loadMechanics() {
    await withLoading(async () => setMechanics(await listMechanics()));
  }

  async function loadJobs() {
    await withLoading(async () => setJobs(await listJobs()));
  }

  async function loadAssignedJobs(mechanicId: string) {
    await withLoading(async () => setJobs(await listAssignedJobs(mechanicId)));
  }

  async function loadCommunityPosts() {
    await withLoading(async () => setCommunityPosts(await listCommunityPosts()));
  }

  async function loadCurrentMechanic(id: string) {
    await withLoading(async () => setCurrentMechanic(await getMechanic(id)));
  }

  function markCommunitySeen(mechanicId: string) {
    const seenAt = new Date().toISOString();
    window.localStorage.setItem(getCommunitySeenKey(mechanicId), seenAt);
    setCommunitySeenAt(seenAt);
  }

  function navigateMechanic(nextPage: Page) {
    if (session?.role === 'mechanic' && nextPage === 'mechanicCommunity') {
      markCommunitySeen(session.mechanicId);
    }

    setPage(nextPage);
  }

  function logout() {
    const roleLabel = session?.role === 'admin' ? t('admin') : t('mechanic');

    setConfirmDialog({
      title: 'Confirm logout',
      message: t('logoutConfirm', { role: roleLabel }),
      confirmLabel: t('logout'),
      kind: 'danger',
      onConfirm: () => {
        if (session?.role === 'admin') {
          void logoutAdmin();
        }
        setSession(null);
        setCurrentMechanic(null);
        setSelectedMechanic(null);
        setJobs([]);
        setCommunityPosts([]);
        setCommunitySeenAt('');
        setPage('landing');
      },
    });
  }

  const activeMechanics = mechanics.filter((mechanic) => mechanic.isActive).length;
  const inactiveMechanics = mechanics.length - activeMechanics;
  const communityUnreadCount = session?.role === 'mechanic'
    ? communityPosts.filter((post) => !communitySeenAt || post.createdAt > communitySeenAt).length
    : 0;

  return (
    <I18nContext.Provider value={i18n}>
    <div className="app-shell">
      {loading && <div className="loading"><span />{t('loading')}</div>}
      {toast && <button className={`toast ${toast.kind}`} onClick={() => setToast(null)}>{toast.text}</button>}
      {confirmDialog && (
        <ConfirmModal
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            const action = confirmDialog.onConfirm;
            setConfirmDialog(null);
            void action();
          }}
        />
      )}

      {page === 'landing' && (
        <Landing
          darkMode={darkMode}
          onAdmin={() => setPage('adminLogin')}
          onMechanicLogin={() => {
            setTab('login');
            setPage('mechanicAuth');
          }}
          onMechanicSignup={() => {
            setTab('signup');
            setPage('mechanicAuth');
          }}
          onToggleDarkMode={setDarkMode}
        />
      )}

      {page === 'mechanicAuth' && (
        <AuthLayout onBack={() => setPage('landing')} title={t('mechanicAccess')}>
          <div className="tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>{t('login')}</button>
            <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>{t('signUp')}</button>
          </div>
          {tab === 'login' ? (
            <MechanicLogin
              onLogin={(mechanicId) => {
                setCurrentMechanic(null);
                setJobs([]);
                setCommunityPosts([]);
                setCommunitySeenAt(getStoredCommunitySeenAt(mechanicId));
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicJobs');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          ) : (
            <MechanicSignup
              onRegistered={(mechanicId) => {
                setToast({ kind: 'success', text: t('registrationSuccessful') });
                setCurrentMechanic(null);
                setJobs([]);
                setCommunityPosts([]);
                setCommunitySeenAt(getStoredCommunitySeenAt(mechanicId));
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicJobs');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          )}
        </AuthLayout>
      )}

      {page === 'adminLogin' && (
        <AuthLayout onBack={() => setPage('landing')} title={t('adminLogin')}>
          <AdminLogin
            onLogin={(admin) => {
              setSession({ role: 'admin', admin });
              setPage('adminDashboard');
            }}
            withLoading={withLoading}
          />
        </AuthLayout>
      )}

      {session?.role === 'mechanic' && currentMechanic && (page === 'mechanicJobs' || page === 'mechanicCommunity' || page === 'mechanicMarketplace' || page === 'mechanicProfile') && (
        <MechanicShell activePage={page} communityPostCount={communityUnreadCount} onLogout={logout} onNavigate={navigateMechanic}>
          {page === 'mechanicJobs' && <MechanicJobs jobs={jobs} mechanicId={currentMechanic.id} />}
          {page === 'mechanicCommunity' && <MechanicCommunity posts={communityPosts} />}
          {page === 'mechanicMarketplace' && <MarketplaceComingSoon />}
          {page === 'mechanicProfile' && <MechanicProfile mechanic={currentMechanic} onEdit={() => setPage('mechanicEdit')} />}
        </MechanicShell>
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicEdit' && (
        <EditMechanic
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicProfile')}
          onSaved={async () => {
            await loadCurrentMechanic(currentMechanic.id);
            setPage('mechanicProfile');
          }}
          setToast={setToast}
          withLoading={withLoading}
        />
      )}

      {session?.role === 'admin' && page.startsWith('admin') && (
        <AdminShell activePage={page} onLogout={logout} onNavigate={setPage}>
          {page === 'adminDashboard' && <AdminDashboard active={activeMechanics} inactive={inactiveMechanics} jobs={jobs} mechanics={mechanics} total={mechanics.length} />}
          {page === 'adminCommunity' && <AdminCommunity posts={communityPosts} onPost={async (message) => {
            await withLoading(async () => {
              await createCommunityPost(message, 'Admin');
              setToast({ kind: 'success', text: 'Community post published' });
              setCommunityPosts(await listCommunityPosts());
            });
          }} />}
          {page === 'adminMechanics' && (
            <MechanicsTable
              mechanics={mechanics}
              onDelete={(mechanic) => {
                setConfirmDialog({
                  title: 'Delete mechanic',
                  message: t('deleteMechanicConfirm', { name: mechanic.fullName }),
                  confirmLabel: t('delete'),
                  kind: 'danger',
                  onConfirm: () => void withLoading(async () => {
                    await deleteMechanic(mechanic.id);
                    setToast({ kind: 'success', text: t('mechanicDeleted') });
                    setMechanics(await listMechanics());
                  }),
                });
              }}
              onEdit={(mechanic) => {
                setSelectedMechanic(mechanic);
                setPage('adminEdit');
              }}
              onRefresh={loadMechanics}
              onView={(mechanic) => {
                setSelectedMechanic(mechanic);
                setPage('adminDetails');
              }}
            />
          )}
          {page === 'adminJobs' && (
            <JobsTable
              jobs={jobs}
              onDelete={async (job) => {
                setConfirmDialog({
                  title: 'Delete job',
                  message: `Delete job ${job.jobId || ''} for ${job.customerName}?`,
                  confirmLabel: 'Delete',
                  kind: 'danger',
                  onConfirm: () => void withLoading(async () => {
                    await deleteJob(job.id);
                    setToast({ kind: 'success', text: 'Job deleted successfully' });
                    setJobs(await listJobs());
                  }),
                });
              }}
              onSave={async (form) => {
                await withLoading(async () => {
                  await createJob(trimJobForm(form), getNextJobId(jobs));
                  setToast({ kind: 'success', text: 'Job saved successfully' });
                  setJobs(await listJobs());
                });
              }}
              onUpdate={async (jobId, form) => {
                await withLoading(async () => {
                  await updateJob(jobId, trimJobForm(form));
                  setToast({ kind: 'success', text: 'Job updated successfully' });
                  setJobs(await listJobs());
                });
              }}
            />
          )}
          {page === 'adminAssignJobs' && (
            <AssignJobsTable
              jobs={jobs}
              mechanics={mechanics}
              onAssign={async (job, mechanicId) => {
                const mechanic = mechanics.find((item) => item.id === mechanicId);
                if (!mechanic) return;

                await withLoading(async () => {
                  await assignJob(job.id, mechanic.id, mechanic.fullName);
                  setToast({ kind: 'success', text: `Job ${job.jobId || ''} assigned to ${mechanic.fullName}` });
                  setJobs(await listJobs());
                });
              }}
            />
          )}
          {page === 'adminDetails' && selectedMechanic && (
            <DetailPage mechanic={selectedMechanic} onBack={() => setPage('adminMechanics')} onEdit={() => setPage('adminEdit')} title={t('mechanicDetails')} />
          )}
          {page === 'adminEdit' && selectedMechanic && (
            <EditMechanic
              adminMode
              mechanic={selectedMechanic}
              onBack={() => setPage('adminMechanics')}
              onSaved={async () => {
                await loadMechanics();
                setPage('adminMechanics');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          )}
        </AdminShell>
      )}
    </div>
    </I18nContext.Provider>
  );
}

function Landing({ darkMode, onAdmin, onMechanicLogin, onMechanicSignup, onToggleDarkMode }: { darkMode: boolean; onAdmin: () => void; onMechanicLogin: () => void; onMechanicSignup: () => void; onToggleDarkMode: (value: boolean) => void }) {
  const { t } = useI18n();

  return (
    <main className="landing-page">
      <div className="top-actions">
        <label className="theme-toggle"><span>{darkMode ? t('dark') : t('light')}</span><span className="switch"><input checked={darkMode} onChange={(event) => onToggleDarkMode(event.target.checked)} type="checkbox" /><span /></span></label>
      </div>
      <section className="hero-panel">
        <div className="landing-card-actions">
          <button className="admin-link" onClick={onAdmin}>{t('adminLogin')}</button>
          <LanguageSelect />
        </div>
        <img alt="Agrisahay logo" className="hero-logo" src={agrisahayLogo} />
        <p className="eyebrow">{t('villageDistrictNetwork')}</p>
        <h1>{t('mechanicDirectory')}</h1>
        <p>{t('heroDescription')}</p>
        <div className="hero-actions">
          <button className="primary large" onClick={onMechanicLogin}>{t('mechanicLogin')}</button>
          <button className="secondary large" onClick={onMechanicSignup}>{t('mechanicSignUp')}</button>
        </div>
      </section>
    </main>
  );
}

function AuthLayout({ children, onBack, title }: { children: React.ReactNode; onBack: () => void; title: string }) {
  const { t } = useI18n();

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <div className="auth-top-row"><button className="text-button" onClick={onBack}>{t('back')}</button><LanguageSelect /></div>
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}

function LanguageSelect() {
  const { language, setLanguage, t } = useI18n();

  return <label className="language-select"><span>{t('language')}</span><select onChange={(event) => setLanguage(event.target.value as Language)} value={language}>{Object.entries(languageNames).map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>;
}

function ConfirmModal({ dialog, onCancel, onConfirm }: { dialog: NonNullable<ConfirmDialog>; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section aria-modal="true" className="confirm-modal" role="dialog" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{dialog.title}</h2>
        <p>{dialog.message}</p>
        <div className="modal-actions">
          <button className="secondary" onClick={onCancel} type="button">Cancel</button>
          <button className={dialog.kind === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} type="button">{dialog.confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function MechanicLogin({ onLogin, setToast, withLoading }: { onLogin: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState<string | null>(null);

  function updatePhoneNumber(value: string) {
    setPhoneNumber(toPhoneDigits(value));
    setPhoneError('');
    setSentOtp(null);
  }

  async function sendOtp() {
    if (!isValidPhone(phoneNumber)) {
      setPhoneError(t('validPhone'));
      return;
    }

    await withLoading(async () => {
      const mechanic = await findMechanicByPhone(phoneNumber.trim());
      if (!mechanic) {
        setOtp('');
        setSentOtp(null);
        setPhoneError(t('phoneNotRegistered'));
        return;
      }

      setPhoneError('');
      const code = createOtpCode();
      setSentOtp(code);
      setToast({ kind: 'success', text: t('developmentOtp', { code }) });
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canVerifyOtp(sentOtp, otp)) {
      setToast({ kind: 'error', text: t('otpRequired') });
      return;
    }
    await withLoading(async () => {
      const mechanic = await findMechanicByPhone(phoneNumber.trim());
      if (!mechanic) throw new Error(t('noMechanicProfile'));
      onLogin(mechanic.id);
    });
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input error={phoneError} inputMode="numeric" label={t('mobileNumber')} maxLength={10} onChange={updatePhoneNumber} pattern="[0-9]*" value={phoneNumber} />
      <div className="otp-row"><Input label="OTP" onChange={setOtp} value={otp} /><button className="secondary" onClick={() => void sendOtp()} type="button">{t('sendOtp')}</button></div>
      <button className="primary" type="submit">{t('login')}</button>
    </form>
  );
}

function MechanicSignup({ onRegistered, setToast, withLoading }: { onRegistered: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { language, t } = useI18n();
  const [form, setForm] = useState<MechanicForm>(emptyMechanicForm);
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'phoneNumber' ? toPhoneDigits(value) : value }));
  }

  function clearForm() {
    setForm(emptyMechanicForm);
    setOtp('');
    setSentOtp(null);
    setOtpVerified(false);
    setErrors({});
  }

  function sendOtp() {
    if (otpVerified) return;

    if (!isValidPhone(form.phoneNumber)) {
      setErrors({ phoneNumber: t('validationPhoneInvalid') });
      return;
    }
    const code = createOtpCode();
    setSentOtp(code);
    setOtpVerified(false);
    setToast({ kind: 'success', text: t('developmentOtp', { code }) });
  }

  function verifyOtp() {
    const verified = canVerifyOtp(sentOtp, otp);
    setOtpVerified(verified);
    setToast({ kind: verified ? 'success' : 'error', text: verified ? t('otpVerifiedComplete') : t('invalidOtp') });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateMechanicForm(form, otpVerified, translations[language]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      const existing = await findMechanicByPhone(form.phoneNumber.trim());
      if (existing) throw new Error(t('phoneAlreadyExists'));
      onRegistered(await createMechanic(trimMechanicForm(form)));
    });
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <div className="otp-row"><Input disabled={otpVerified} error={errors.phoneNumber} inputMode="numeric" label={t('mobileNumber')} maxLength={10} onChange={(value) => updateField('phoneNumber', value)} pattern="[0-9]*" value={form.phoneNumber} /><button className="secondary" disabled={otpVerified} onClick={sendOtp} type="button">{t('sendOtp')}</button></div>
      <div className="otp-row"><Input error={errors.otp} label={t('otpVerification')} onChange={setOtp} value={otp} /><button className="secondary" disabled={otpVerified} onClick={verifyOtp} type="button">{t('verify')}</button></div>
      <p className={otpVerified ? 'success-text' : 'muted'}>{otpVerified ? t('otpVerifiedFields') : t('verifyOtpEnableFields')}</p>
      <MechanicFields disabled={!otpVerified} errors={errors} form={form} onChange={updateField} />
      <button className="secondary" onClick={clearForm} type="button">{t('clear')}</button>
      <button className="primary" type="submit">{t('submit')}</button>
    </form>
  );
}

function AdminLogin({ onLogin, withLoading }: { onLogin: (admin: AdminProfile) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { language, t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await withLoading(async () => onLogin(await loginAdmin(email, password, translations[language])));
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input label={t('email')} onChange={setEmail} type="email" value={email} />
      <Input label={t('password')} onChange={setPassword} type="password" value={password} />
      <button className="primary" type="submit">{t('adminLogin')}</button>
      <p className="muted">{t('adminUsersFirebase')}</p>
    </form>
  );
}

function MechanicShell({ activePage, children, communityPostCount, onLogout, onNavigate }: { activePage: Page; children: React.ReactNode; communityPostCount: number; onLogout: () => void; onNavigate: (page: Page) => void }) {
  const [showSupport, setShowSupport] = useState(false);

  return (
    <main className="mechanic-app-page">
      <div className="mechanic-app-content">
        <div className="mechanic-help-area">
          <button aria-expanded={showSupport} aria-label="Show customer support number" className="mechanic-help-button" onClick={() => setShowSupport((isVisible) => !isVisible)} type="button">
            <Headphones size={20} strokeWidth={2.5} />
            <span>Help</span>
          </button>
          {showSupport && (
            <div className="mechanic-support-popover">
              <span>Customer support</span>
              <a href="tel:9646424964">9646424964</a>
            </div>
          )}
        </div>
        {children}
      </div>
      <nav className="mechanic-bottom-nav" aria-label="Mechanic navigation">
        {mechanicTabs.map((item) => {
          const Icon = item.Icon;

          return <button className={activePage === item.page ? 'active' : ''} key={item.page} onClick={() => onNavigate(item.page)} type="button"><span><Icon size={19} strokeWidth={2.4} />{item.page === 'mechanicCommunity' && communityPostCount > 0 && <b>{communityPostCount}</b>}</span>{item.label}</button>;
        })}
      </nav>
      <button className="mechanic-logout" onClick={onLogout} type="button">Logout</button>
    </main>
  );
}

function MechanicBlankPage({ title }: { title: string }) {
  return (
    <section className="card mechanic-tab-card blank-tab-card">
      <h1>{title}</h1>
    </section>
  );
}

function MarketplaceComingSoon() {
  return (
    <section className="marketplace-soon-page">
      <div className="marketplace-soon-card">
        <div className="marketplace-emoji-row" aria-hidden="true">
          <span>🛠️</span>
          <span>🚜</span>
          <span>🛒</span>
        </div>
        <p className="eyebrow">Marketplace</p>
        <h1>Feature coming soon</h1>
        <p>Buy or sell</p>
        <div className="marketplace-preview-chips" aria-label="Marketplace preview items">
          <span>🔧 Tools</span>
          <span>⚙️ Spare parts</span>
          <span>🧰 Service kits</span>
        </div>
      </div>
    </section>
  );
}

function MechanicCommunity({ posts }: { posts: CommunityPost[] }) {
  return (
    <section className="mechanic-community-screen">
      <div className="mechanic-screen-hero community-hero">
        <div>
          <p className="eyebrow">Community updates</p>
          <h1>Community</h1>
        </div>
        <span>{posts.length}</span>
      </div>
      <div className="community-post-list">
        {posts.map((post) => (
          <article className="community-post-card" key={post.id}>
            <div className="community-post-meta"><strong>Admin</strong><time>{formatDate(post.createdAt)}</time></div>
            <p>{post.message}</p>
          </article>
        ))}
        {posts.length === 0 && (
          <section className="community-empty-state">
            <span aria-hidden="true">📢</span>
            <h1>No community posts</h1>
            <p>Admin updates will appear here.</p>
          </section>
        )}
      </div>
    </section>
  );
}

function MechanicJobs({ jobs, mechanicId }: { jobs: Job[]; mechanicId: string }) {
  const [expandedJobIds, setExpandedJobIds] = useState<string[]>([]);
  const assignedJobs = jobs.filter((job) => job.assignedMechanicId === mechanicId);

  function toggleJobDetails(jobId: string) {
    setExpandedJobIds((currentJobIds) => (
      currentJobIds.includes(jobId)
        ? currentJobIds.filter((currentJobId) => currentJobId !== jobId)
        : [...currentJobIds, jobId]
    ));
  }

  return (
    <section className="mechanic-jobs-screen">
      <div className="mechanic-screen-hero jobs-hero">
        <div>
          <p className="eyebrow">Assigned work</p>
          <h1>Jobs</h1>
        </div>
        <span>{assignedJobs.length}</span>
      </div>
      <div className="mechanic-job-list">
        {assignedJobs.map((job) => {
          const isExpanded = expandedJobIds.includes(job.id);

          return (
            <article className="mechanic-job-card" key={job.id}>
              <div className="job-card-summary">
                <div>
                  <div className="job-card-topline"><span>Job ID: {job.jobId}</span><time>Created date: {formatDate(job.createdAt)}</time></div>
                  <h2><span>Vehicle</span>{job.equipment}</h2>
                  <p><span>Issue</span>{job.issue}</p>
                </div>
                <button aria-expanded={isExpanded} aria-label={isExpanded ? 'Hide job details' : 'Show job details'} className="job-show-more" onClick={() => toggleJobDetails(job.id)} type="button">
                  <span>{isExpanded ? 'Less' : 'More'}</span>
                  <ChevronDown className={isExpanded ? 'open' : ''} size={20} strokeWidth={2.6} />
                </button>
              </div>
              {isExpanded && (
                <div className="job-card-details">
                  <dl>
                    <div><dt>Customer</dt><dd>{job.customerName}</dd></div>
                    <div><dt>Phone</dt><dd>{job.phoneNumber || '-'}</dd></div>
                    <div><dt>District</dt><dd>{job.district}</dd></div>
                    <div><dt>Notes</dt><dd>{job.additionalNotes || '-'}</dd></div>
                  </dl>
                </div>
              )}
            </article>
          );
        })}
        {assignedJobs.length === 0 && (
          <section className="jobs-empty-state">
            <span aria-hidden="true">🧰</span>
            <h1>No jobs assigned</h1>
            <p>New assigned work will show up here.</p>
          </section>
        )}
      </div>
    </section>
  );
}

function MechanicProfile({ mechanic, onEdit }: { mechanic: Mechanic; onEdit: () => void }) {
  const { t } = useI18n();

  return (
      <section className="mechanic-profile-screen">
        <div className="mechanic-profile-hero">
          <div className="profile-avatar">{getInitials(mechanic.fullName)}</div>
          <p className="eyebrow">{t('welcome')}</p>
          <h1>{mechanic.fullName}</h1>
          <div className="profile-chip-row">
            <span>{mechanic.isActive ? t('active') : t('inactive')}</span>
            <span>{mechanic.experience || '0'} yrs</span>
            <span>{mechanic.district || '-'}</span>
          </div>
          <button className="primary profile-edit-button" onClick={onEdit}>{t('editProfile')}</button>
        </div>
        <section className="profile-details-card">
          <h2>Profile details</h2>
          <DetailGrid mechanic={mechanic} compact />
        </section>
      </section>
  );
}

function AdminShell({ activePage, children, onLogout, onNavigate }: { activePage: Page; children: React.ReactNode; onLogout: () => void; onNavigate: (page: Page) => void }) {
  const { t } = useI18n();

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <h2>{t('mechanicDirectory')}</h2>
        <LanguageSelect />
        {navItems.map((item) => <button className={activePage === item.page ? 'active' : ''} key={item.page} onClick={() => onNavigate(item.page)}>{t(item.labelKey)}</button>)}
        <button className="logout" onClick={onLogout}>{t('logout')}</button>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

function AdminDashboard({ active, inactive, jobs, mechanics, total }: { active: number; inactive: number; jobs: Job[]; mechanics: Mechanic[]; total: number }) {
  const { t } = useI18n();
  const assignedJobs = jobs.filter((job) => job.assignedMechanicId);
  const unassignedJobs = jobs.length - assignedJobs.length;
  const assignmentRate = jobs.length ? Math.round((assignedJobs.length / jobs.length) * 100) : 0;
  const recentJobs = jobs.slice(0, 5);
  const topMechanics = mechanics
    .map((mechanic) => ({
      mechanic,
      assignedCount: jobs.filter((job) => job.assignedMechanicId === mechanic.id).length,
    }))
    .filter((item) => item.assignedCount > 0)
    .sort((firstItem, secondItem) => secondItem.assignedCount - firstItem.assignedCount)
    .slice(0, 4);

  return (
    <section className="admin-dashboard-page">
      <div className="admin-dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>{t('adminDashboard')}</h1>
          <p>Track mechanics, jobs, and assignments from one place.</p>
        </div>
        <div className="dashboard-rate-card">
          <span>{assignmentRate}%</span>
          <p>Jobs assigned</p>
        </div>
      </div>

      <section className="dashboard-metrics-grid">
        <Metric label={t('totalMechanics')} value={total} />
        <Metric label={t('activeMechanics')} value={active} />
        <Metric label={t('inactiveMechanics')} value={inactive} />
        <Metric label="Total jobs" value={jobs.length} />
        <Metric label="Assigned jobs" value={assignedJobs.length} />
        <Metric label="Unassigned jobs" value={unassignedJobs} />
      </section>

      <section className="dashboard-panels">
        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Latest work</p>
              <h2>Recent jobs</h2>
            </div>
            <span>{recentJobs.length}</span>
          </div>
          <div className="recent-job-list">
            {recentJobs.map((job) => (
              <div className="recent-job-item" key={job.id}>
                <div>
                  <strong>{job.jobId || '-'}</strong>
                  <p>{job.equipment} - {job.issue}</p>
                </div>
                <span className={job.assignedMechanicId ? 'status-chip assigned' : 'status-chip open'}>{job.assignedMechanicId ? 'Assigned' : 'Open'}</span>
              </div>
            ))}
            {recentJobs.length === 0 && <p className="empty compact-empty">No jobs added yet.</p>}
          </div>
        </article>

        <article className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Assignment load</p>
              <h2>Top mechanics</h2>
            </div>
            <span>{topMechanics.length}</span>
          </div>
          <div className="mechanic-load-list">
            {topMechanics.map(({ assignedCount, mechanic }) => (
              <div className="mechanic-load-item" key={mechanic.id}>
                <div className="load-avatar">{getInitials(mechanic.fullName)}</div>
                <div>
                  <strong>{mechanic.fullName}</strong>
                  <p>{mechanic.district || '-'} · {mechanic.experience || '0'} yrs</p>
                </div>
                <span>{assignedCount}</span>
              </div>
            ))}
            {topMechanics.length === 0 && <p className="empty compact-empty">No assigned jobs yet.</p>}
          </div>
        </article>
      </section>
    </section>
  );
}

function AdminCommunity({ onPost, posts }: { onPost: (message: string) => Promise<void>; posts: CommunityPost[] }) {
  const [message, setMessage] = useState('');
  const trimmedMessage = message.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmedMessage) return;
    await onPost(trimmedMessage);
    setMessage('');
  }

  return (
    <section className="admin-community-page">
      <div className="admin-community-composer card">
        <p className="eyebrow">Broadcast message</p>
        <h1>Community</h1>
        <p className="muted">Post updates that every mechanic can read after login.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className="field">
            <span>Write post</span>
            <textarea onChange={(event) => setMessage(event.target.value)} placeholder="Write an update for mechanics..." value={message} />
          </label>
          <button className="primary" disabled={!trimmedMessage} type="submit">Post update</button>
        </form>
      </div>

      <div className="admin-community-feed card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Published</p>
            <h2>Community posts</h2>
          </div>
          <span>{posts.length}</span>
        </div>
        <div className="community-post-list admin-feed-list">
          {posts.map((post) => (
            <article className="community-post-card" key={post.id}>
              <div className="community-post-meta"><strong>Admin</strong><time>{formatDate(post.createdAt)}</time></div>
              <p>{post.message}</p>
            </article>
          ))}
          {posts.length === 0 && <p className="empty compact-empty">No posts published yet.</p>}
        </div>
      </div>
    </section>
  );
}

function MechanicsTable({ mechanics, onDelete, onEdit, onRefresh, onView }: { mechanics: Mechanic[]; onDelete: (mechanic: Mechanic) => void; onEdit: (mechanic: Mechanic) => void; onRefresh: () => Promise<void>; onView: (mechanic: Mechanic) => void }) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => mechanics.filter((mechanic) => {
    const searchText = `${mechanic.fullName} ${mechanic.phoneNumber} ${mechanic.village} ${mechanic.district}`.toLowerCase();
    return searchText.includes(search.toLowerCase())
      && (!district || mechanic.district.toLowerCase().includes(district.toLowerCase()))
      && (!village || mechanic.village.toLowerCase().includes(village.toLowerCase()))
      && (status === 'all' || (status === 'active' ? mechanic.isActive : !mechanic.isActive));
  }), [district, mechanics, search, status, village]);

  return (
    <section>
      <div className="section-heading"><h1>{t('mechanics')}</h1><button className="secondary" onClick={() => void onRefresh()}>{t('refresh')}</button></div>
      <div className="card filters"><Input label={t('search')} onChange={setSearch} value={search} /><Input label={t('district')} onChange={setDistrict} value={district} /><Input label={t('village')} onChange={setVillage} value={village} /><Select label={t('availability')} onChange={setStatus} options={[["all", t('all')], ["active", t('active')], ["inactive", t('inactive')]]} value={status} /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{t('name')}</th><th>{t('phoneNumber')}</th><th>{t('village')}</th><th>{t('district')}</th><th>{t('experience')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead>
          <tbody>
            {filtered.map((mechanic) => (
              <tr key={mechanic.id}>
                <td>{mechanic.fullName}</td><td>{mechanic.phoneNumber}</td><td>{mechanic.village}</td><td>{mechanic.district}</td><td>{mechanic.experience}</td><td><span className={`pill ${mechanic.isActive ? 'active' : 'inactive'}`}>{mechanic.isActive ? t('active') : t('inactive')}</span></td>
                <td className="actions"><button onClick={() => onView(mechanic)}>{t('view')}</button><button onClick={() => onEdit(mechanic)}>{t('edit')}</button><button className="danger-text" onClick={() => onDelete(mechanic)}>{t('delete')}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">{t('noMechanicsFound')}</p>}
      </div>
    </section>
  );
}

function JobsTable({ jobs, onDelete, onSave, onUpdate }: { jobs: Job[]; onDelete: (job: Job) => Promise<void>; onSave: (form: JobForm) => Promise<void>; onUpdate: (jobId: string, form: JobForm) => Promise<void> }) {
  const [showForm, setShowForm] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [form, setForm] = useState<JobForm>(emptyJobForm);
  const [error, setError] = useState('');

  function updateField(key: keyof JobForm, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'phoneNumber' ? toPhoneDigits(value) : value }));
    setError('');
  }

  function startNewJob() {
    setForm(emptyJobForm);
    setEditingJobId(null);
    setError('');
    setShowForm(true);
  }

  function startEdit(job: Job) {
    setForm(toJobForm(job));
    setEditingJobId(job.id);
    setError('');
    setShowForm(true);
  }

  function cancelEdit() {
    setForm(emptyJobForm);
    setEditingJobId(null);
    setError('');
    setShowForm(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!form.customerName.trim() || !form.phoneNumber.trim() || !form.equipment.trim() || !form.issue.trim() || !form.district.trim()) {
      setError('Customer name, phone number, equipment, issue, and district are required.');
      return;
    }

    if (!isValidPhone(form.phoneNumber)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (editingJobId) {
      await onUpdate(editingJobId, form);
    } else {
      await onSave(form);
    }

    setForm(emptyJobForm);
    setEditingJobId(null);
    setShowForm(false);
  }

  return (
    <section>
      <div className="section-heading jobs-heading">
        <h1>Add new jobs</h1>
        <button className="add-job-button" onClick={startNewJob} type="button" aria-label="Add job">
          <span aria-hidden="true">+</span>
          Add job
        </button>
      </div>
      <form onSubmit={(event) => void submit(event)}>
        <div className="table-wrap jobs-table-wrap">
          <table className="jobs-table">
            <thead><tr><th>Job ID</th><th>Customer name</th><th>Phone number</th><th>Equipment</th><th>Issue</th><th>District</th><th>Additional notes</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {showForm && (
                <tr className="job-entry-row">
                  <td>{editingJobId ? jobs.find((job) => job.id === editingJobId)?.jobId || '-' : getNextJobId(jobs)}</td>
                  <td><input aria-label="Customer name" onChange={(event) => updateField('customerName', event.target.value)} placeholder="Customer name" value={form.customerName} /></td>
                  <td><input aria-label="Phone number" inputMode="numeric" maxLength={10} onChange={(event) => updateField('phoneNumber', event.target.value)} pattern="[0-9]*" placeholder="Phone number" value={form.phoneNumber} /></td>
                  <td><input aria-label="Equipment" onChange={(event) => updateField('equipment', event.target.value)} placeholder="Equipment" value={form.equipment} /></td>
                  <td><input aria-label="Issue" onChange={(event) => updateField('issue', event.target.value)} placeholder="Issue" value={form.issue} /></td>
                  <td><input aria-label="District" onChange={(event) => updateField('district', event.target.value)} placeholder="District" value={form.district} /></td>
                  <td><input aria-label="Additional notes" onChange={(event) => updateField('additionalNotes', event.target.value)} placeholder="Additional notes" value={form.additionalNotes} /></td>
                  <td>{editingJobId ? 'Editing' : 'New'}</td>
                  <td className="actions"><button className="icon-save" title="Save job" type="submit" aria-label="Save job">Save</button><button className="danger-text" onClick={cancelEdit} type="button">Cancel</button></td>
                </tr>
              )}
              {jobs.map((job, index) => (
                <tr key={job.id}>
                  <td>{job.jobId || getDisplayJobId(jobs, index)}</td><td>{job.customerName}</td><td>{job.phoneNumber || '-'}</td><td>{job.equipment}</td><td>{job.issue}</td><td>{job.district}</td><td>{job.additionalNotes || '-'}</td><td>{formatDate(job.createdAt)}</td><td className="actions"><button onClick={() => startEdit(job)} type="button">Edit</button><button className="danger-text" onClick={() => void onDelete(job)} type="button">Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {jobs.length === 0 && <p className="empty">No jobs saved yet.</p>}
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>
    </section>
  );
}

function AssignJobsTable({ jobs, mechanics, onAssign }: { jobs: Job[]; mechanics: Mechanic[]; onAssign: (job: Job, mechanicId: string) => Promise<void> }) {
  const [selectedMechanics, setSelectedMechanics] = useState<Record<string, string>>({});
  const [editingAssignments, setEditingAssignments] = useState<Record<string, boolean>>({});

  function getSelectedMechanicId(job: Job) {
    return selectedMechanics[job.id] ?? job.assignedMechanicId;
  }

  function startEditAssignment(job: Job) {
    setSelectedMechanics((current) => ({ ...current, [job.id]: job.assignedMechanicId }));
    setEditingAssignments((current) => ({ ...current, [job.id]: true }));
  }

  function cancelEditAssignment(job: Job) {
    setSelectedMechanics((current) => ({ ...current, [job.id]: job.assignedMechanicId }));
    setEditingAssignments((current) => ({ ...current, [job.id]: false }));
  }

  async function saveAssignment(job: Job, mechanicId: string) {
    await onAssign(job, mechanicId);
    setEditingAssignments((current) => ({ ...current, [job.id]: false }));
  }

  return (
    <section>
      <div className="section-heading jobs-heading">
        <h1>Assign jobs</h1>
        <p className="muted">Select a mechanic for each job and save the assignment.</p>
      </div>
      <div className="table-wrap assign-table-wrap">
        <table className="assign-table">
          <thead><tr><th>Job ID</th><th>Customer</th><th>Phone number</th><th>Equipment</th><th>Issue</th><th>District</th><th>Current mechanic</th><th>Assign mechanic</th><th>Actions</th></tr></thead>
          <tbody>
            {jobs.map((job, index) => {
              const selectedMechanicId = getSelectedMechanicId(job);
              const isAssigned = Boolean(job.assignedMechanicId);
              const isEditingAssignment = Boolean(editingAssignments[job.id]);
              const isDropdownDisabled = isAssigned && !isEditingAssignment;

              return (
                <tr key={job.id}>
                  <td>{job.jobId || getDisplayJobId(jobs, index)}</td>
                  <td>{job.customerName}</td>
                  <td>{job.phoneNumber || '-'}</td>
                  <td>{job.equipment}</td>
                  <td>{job.issue}</td>
                  <td>{job.district}</td>
                  <td>{job.assignedMechanicName ? <span className="assignment-status"><strong>ASSIGNED</strong><small>{job.assignedMechanicName}</small></span> : <span className="not-assigned">Not assigned</span>}</td>
                  <td>
                    <select aria-label={`Assign mechanic for ${job.jobId || job.customerName}`} disabled={isDropdownDisabled} onChange={(event) => setSelectedMechanics((current) => ({ ...current, [job.id]: event.target.value }))} value={selectedMechanicId}>
                      <option value="">Select mechanic</option>
                      {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.fullName} - {mechanic.district}</option>)}
                    </select>
                  </td>
                  <td className="actions">
                    {isDropdownDisabled ? (
                      <button onClick={() => startEditAssignment(job)} type="button">Edit</button>
                    ) : (
                      <button className="icon-save" disabled={!selectedMechanicId} onClick={() => void saveAssignment(job, selectedMechanicId)} type="button">Save</button>
                    )}
                    {isEditingAssignment && <button className="danger-text" onClick={() => cancelEditAssignment(job)} type="button">Cancel</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && <p className="empty">No jobs available to assign.</p>}
        {mechanics.length === 0 && <p className="empty">No mechanics available. Add mechanics before assigning jobs.</p>}
      </div>
    </section>
  );
}

function DetailPage({ mechanic, onBack, onEdit, title }: { mechanic: Mechanic; onBack: () => void; onEdit: () => void; title: string }) {
  const { t } = useI18n();

  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button" onClick={onBack}>{t('back')}</button>
        <h1>{title}</h1>
        <h2>{mechanic.fullName}</h2>
        <DetailGrid mechanic={mechanic} />
        <button className="primary" onClick={onEdit}>{t('editProfile')}</button>
      </section>
    </main>
  );
}

function EditMechanic({ adminMode = false, mechanic, onBack, onSaved, setToast, withLoading }: { adminMode?: boolean; mechanic: Mechanic; onBack: () => void; onSaved: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { language, t } = useI18n();
  const [form, setForm] = useState<MechanicForm>(toMechanicForm(mechanic));
  const [isActive, setIsActive] = useState(mechanic.isActive);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: key === 'phoneNumber' ? toPhoneDigits(value) : value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateMechanicForm(form, true, translations[language]);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    await withLoading(async () => {
      await updateMechanic(mechanic.id, { ...trimMechanicForm(form), isActive });
      setToast({ kind: 'success', text: t('profileUpdated') });
      await onSaved();
    });
  }

  return (
    <main className="detail-page">
      <form className="card form-grid edit-card" onSubmit={(event) => void submit(event)}>
        <button className="text-button" onClick={onBack} type="button">{t('back')}</button>
        <h1>{t('editProfile')}</h1>
        <MechanicFields errors={errors} form={form} onChange={updateField} />
        {adminMode && <label className="checkbox-row"><input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> {t('activeMechanic')}</label>}
        <button className="primary" type="submit">{t('saveChanges')}</button>
      </form>
    </main>
  );
}

function MechanicFields({ disabled = false, errors = {}, form, onChange }: { disabled?: boolean; errors?: ValidationErrors; form: MechanicForm; onChange: (key: keyof MechanicForm, value: string) => void }) {
  const { t } = useI18n();

  return (
    <fieldset className="form-grid fields-grid" disabled={disabled}>
      <Input error={errors.fullName} label={t('fullName')} onChange={(value) => onChange('fullName', value)} value={form.fullName} />
      <StateSelect error={errors.state} label={t('state')} onChange={(value) => onChange('state', value)} value={form.state} />
      <Input label={t('district')} error={errors.district} onChange={(value) => onChange('district', value)} value={form.district} />
      <Input label={t('village')} error={errors.village} onChange={(value) => onChange('village', value)} value={form.village} />
      <Input label={t('address')} onChange={(value) => onChange('address', value)} value={form.address} />
      <Input label={t('pincode')} onChange={(value) => onChange('pincode', value)} value={form.pincode} />
      <Input label={t('age')} onChange={(value) => onChange('age', value)} value={form.age} />
      <Input label={t('yearsOfExperience')} error={errors.experience} onChange={(value) => onChange('experience', value)} value={form.experience} />
    </fieldset>
  );
}

function Input({ disabled = false, error, inputMode, label, maxLength, onChange, pattern, type = 'text', value }: { disabled?: boolean; error?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; label: string; maxLength?: number; onChange: (value: string) => void; pattern?: string; type?: string; value: string }) {
  return <label className="field"><span>{label}</span><input className={error ? 'invalid' : ''} disabled={disabled} inputMode={inputMode} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} pattern={pattern} type={type} value={value} />{error && <small>{error}</small>}</label>;
}

function StateSelect({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: string) => void; value: string }) {
  const { t } = useI18n();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const filteredStates = useMemo(() => indianStates.filter((state) => state.toLowerCase().includes(search.trim().toLowerCase())), [search]);

  useEffect(() => setSearch(value), [value]);

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    onChange(nextSearch);
    setOpen(true);
  }

  function selectState(state: string) {
    setSearch(state);
    onChange(state);
    setOpen(false);
  }

  return <div className="field state-select"><label htmlFor={inputId}>{label}</label><input autoComplete="off" className={error ? 'invalid' : ''} id={inputId} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => updateSearch(event.target.value)} onFocus={() => setOpen(true)} placeholder={t('searchSelectState')} value={search} />{open && <div className="state-options">{filteredStates.length > 0 ? filteredStates.map((state) => <button key={state} onMouseDown={(event) => event.preventDefault()} onClick={() => selectState(state)} type="button">{state}</button>) : <span>{t('noStateFound')}</span>}</div>}{error && <small>{error}</small>}</div>;
}

function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return <label className="field"><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const { t } = useI18n();
  const rows = [
    [t('phoneNumber'), mechanic.phoneNumber], [t('village'), mechanic.village], [t('district'), mechanic.district],
    [t('state'), mechanic.state], [t('pincode'), mechanic.pincode], [t('address'), mechanic.address], [t('age'), mechanic.age],
    [t('experience'), t('experienceYears', { years: mechanic.experience || '0' })], [t('registrationDate'), formatDate(mechanic.createdAt)],
  ];
  return <dl className={compact ? 'detail-grid compact' : 'detail-grid'}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>;
}

function trimMechanicForm(form: MechanicForm): MechanicForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as MechanicForm;
}

function trimJobForm(form: JobForm): JobForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as JobForm;
}

function toJobForm(job: Job): JobForm {
  return {
    customerName: job.customerName,
    phoneNumber: job.phoneNumber,
    equipment: job.equipment,
    issue: job.issue,
    district: job.district,
    additionalNotes: job.additionalNotes,
  };
}

function getDisplayJobId(jobs: Job[], index: number) {
  return String(jobs.length - index).padStart(2, '0');
}

function toMechanicForm(mechanic: Mechanic): MechanicForm {
  return {
    fullName: mechanic.fullName,
    phoneNumber: mechanic.phoneNumber,
    village: mechanic.village,
    district: mechanic.district,
    state: mechanic.state,
    pincode: mechanic.pincode,
    address: mechanic.address,
    age: mechanic.age,
    experience: mechanic.experience,
  };
}

function toPhoneDigits(value: string) {
  return value.replace(/\D/g, '').slice(0, 10);
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'M';
}

function getCommunitySeenKey(mechanicId: string) {
  return `mechanic-community-seen:${mechanicId}`;
}

function getStoredCommunitySeenAt(mechanicId: string) {
  return window.localStorage.getItem(getCommunitySeenKey(mechanicId)) ?? '';
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
