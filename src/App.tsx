import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Input, LanguageSelector, Metric, PinInput, Select, formatDate, getErrorMessage, type Toast } from './components/ui';
import { auth, db, firebaseConfigured } from './firebase';
import { usePhoneOtp } from './hooks/usePhoneOtp';
import { useI18n } from './i18n/I18nContext';
import { loginAdmin } from './services/adminAuth';
import { completeSignup } from './services/auth';
import { enableBiometricPin, isBiometricAvailable, isBiometricPinEnabled, tryBiometricPinLogin, unlockWithBiometrics } from './services/biometric';
import {
  adminUpdateProfile,
  getMechanic,
  listMechanics,
  reviewSignup,
  setTechnicianStatus,
} from './services/mechanics';
import { initNotifications } from './services/notifications';
import { changePin, getPinErrorInfo, loginWithPin, setPin } from './services/pin';
import type { AdminProfile, AppSession, Mechanic, MechanicForm } from './types';
import { emptyMechanicForm } from './types';
import { hasErrors, validateProfileForm, type ValidationErrors } from './utils/validation';
import { AdminJobBoard } from './screens/AdminJobBoard';
import { AdminProfileRequests } from './screens/AdminProfileRequests';
import { ChangePin } from './screens/ChangePin';
import { RequestProfileChange } from './screens/RequestProfileChange';
import { TechnicianJobs } from './screens/TechnicianJobs';

type Page =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicPending'
  | 'mechanicDashboard'
  | 'mechanicProfile'
  | 'mechanicJobs'
  | 'mechanicRequestChange'
  | 'mechanicChangePin'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminJobs'
  | 'adminProfileRequests'
  | 'adminSettings'
  | 'adminDetails'
  | 'adminEdit';

const navItems: Array<{ label: string; page: Page }> = [
  { label: 'Dashboard', page: 'adminDashboard' },
  { label: 'Mechanics', page: 'adminMechanics' },
  { label: 'Jobs', page: 'adminJobs' },
  { label: 'Profile Requests', page: 'adminProfileRequests' },
  { label: 'Settings', page: 'adminSettings' },
];

const SUPPORT_NUMBER = '9646424964';

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [session, setSession] = useState<AppSession>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [currentMechanic, setCurrentMechanic] = useState<Mechanic | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [darkMode, setDarkMode] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // Reveals a persisted Firebase session's data — split out so the biometric
  // gate below can call it either immediately or after a successful retry.
  async function revealSession(user: User) {
    const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));

    if (adminSnapshot.exists()) {
      const data = adminSnapshot.data();
      setSession({
        role: 'admin',
        admin: {
          id: user.uid,
          name: String(data.name ?? 'Admin'),
          email: user.email ?? String(data.email ?? ''),
          role: 'admin',
        },
      });
      setPage('adminDashboard');
      return;
    }

    const technician = await getMechanic(user.uid);

    if (technician) {
      setSession({ role: 'mechanic', mechanicId: user.uid });
      setPage(technician.status === 'active' ? 'mechanicDashboard' : 'mechanicPending');
    }
  }

  // Restores a persisted Firebase session on load/refresh instead of
  // dropping the user back to the landing page every time. On a native
  // build, a device biometric/passcode prompt gates the reveal — see
  // services/biometric.ts and Blueprint §07.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setBootstrapping(false);
        return;
      }

      void (async () => {
        const unlocked = await unlockWithBiometrics();

        if (!unlocked) {
          setPendingUser(user);
          setLocked(true);
          setBootstrapping(false);
          return;
        }

        await revealSession(user);
        setBootstrapping(false);
      })();
    });

    return unsubscribe;
  }, []);

  async function retryUnlock() {
    if (!pendingUser) return;
    const unlocked = await unlockWithBiometrics();
    if (unlocked) {
      setLocked(false);
      await revealSession(pendingUser);
      setPendingUser(null);
    }
  }

  useEffect(() => {
    if (session?.role === 'mechanic') {
      void loadCurrentMechanic(session.mechanicId);
      void initNotifications();
    }

    if (session?.role === 'admin') {
      void loadMechanics();
    }
  }, [session]);

  async function withLoading(action: () => Promise<void>) {
    setLoading(true);
    try {
      await action();
    } catch (error) {
      setToast({ kind: 'error', text: getErrorMessage(error) });
    } finally {
      setLoading(false);
    }
  }

  async function loadMechanics() {
    await withLoading(async () => setMechanics(await listMechanics()));
  }

  async function loadCurrentMechanic(id: string) {
    await withLoading(async () => setCurrentMechanic(await getMechanic(id)));
  }

  function logout() {
    const confirmText = session?.role === 'admin' ? 'Logout from admin account?' : t('logoutConfirm');

    if (!confirm(confirmText)) {
      return;
    }

    void signOut(auth);
    setSession(null);
    setCurrentMechanic(null);
    setSelectedMechanic(null);
    setPage('landing');
  }

  const activeMechanics = mechanics.filter((mechanic) => mechanic.status === 'active').length;
  const pendingMechanics = mechanics.filter((mechanic) => mechanic.status === 'pending').length;
  const inactiveMechanics = mechanics.filter(
    (mechanic) => mechanic.status === 'inactive' || mechanic.status === 'rejected',
  ).length;

  if (bootstrapping) {
    return (
      <div className="app-shell">
        <div className="loading">
          <span />
          Loading...
        </div>
      </div>
    );
  }

  if (locked) {
    return <LockedScreen onRetry={() => void retryUnlock()} />;
  }

  return (
    <div className="app-shell">
      {/* Invisible reCAPTCHA anchor for firebaseOtpProvider's signInWithPhoneNumber — always mounted, never shown. */}
      <div id="recaptcha-container" />
      {loading && <div className="loading"><span />Loading...</div>}
      {toast && <button className={`toast ${toast.kind}`} onClick={() => setToast(null)}>{toast.text}</button>}

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
        <AuthLayout onBack={() => setPage('landing')} title={t('technicianAccess')}>
          <div className="tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>{t('loginTab')}</button>
            <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>{t('signupTab')}</button>
          </div>
          {tab === 'login' ? (
            <MechanicLogin
              onLogin={(mechanicId) => {
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicDashboard');
              }}
              onPending={(mechanicId) => {
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicPending');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          ) : (
            <MechanicSignup
              onRegistered={(mechanicId) => {
                setToast({
                  kind: 'success',
                  text: 'Registered — you will be notified once an admin verifies your account.',
                });
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicPending');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          )}
        </AuthLayout>
      )}

      {page === 'adminLogin' && (
        <AuthLayout onBack={() => setPage('landing')} title="Admin Login">
          <AdminLogin
            onLogin={(admin) => {
              setSession({ role: 'admin', admin });
              setPage('adminDashboard');
            }}
            withLoading={withLoading}
          />
        </AuthLayout>
      )}

      {session?.role === 'mechanic' && page === 'mechanicPending' && (
        <MechanicPending mechanic={currentMechanic} onLogout={logout} />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicDashboard' && (
        <MechanicDashboard
          mechanic={currentMechanic}
          onChangePin={() => setPage('mechanicChangePin')}
          onJobs={() => setPage('mechanicJobs')}
          onLogout={logout}
          onProfile={() => setPage('mechanicProfile')}
          onRequestChange={() => setPage('mechanicRequestChange')}
        />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicProfile' && (
        <DetailPage
          editable={false}
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicDashboard')}
          onRequestChange={() => setPage('mechanicRequestChange')}
          title="My Profile"
        />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicJobs' && (
        <TechnicianJobs
          onBack={() => setPage('mechanicDashboard')}
          setToast={setToast}
          technicianId={currentMechanic.id}
          withLoading={withLoading}
        />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicRequestChange' && (
        <RequestProfileChange
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicProfile')}
          onSubmitted={() => setPage('mechanicProfile')}
          setToast={setToast}
          withLoading={withLoading}
        />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicChangePin' && (
        <ChangePin onBack={() => setPage('mechanicDashboard')} setToast={setToast} withLoading={withLoading} />
      )}

      {session?.role === 'admin' && page.startsWith('admin') && (
        <AdminShell activePage={page} darkMode={darkMode} onLogout={logout} onNavigate={setPage} onToggleDarkMode={setDarkMode}>
          {page === 'adminDashboard' && (
            <AdminDashboard active={activeMechanics} inactive={inactiveMechanics} pending={pendingMechanics} total={mechanics.length} />
          )}
          {page === 'adminMechanics' && (
            <MechanicsTable
              mechanics={mechanics}
              onApprove={(mechanic) => {
                void withLoading(async () => {
                  await reviewSignup(mechanic.id, 'approve');
                  setToast({ kind: 'success', text: `${mechanic.fullName} approved.` });
                  setMechanics(await listMechanics());
                });
              }}
              onEdit={(mechanic) => {
                setSelectedMechanic(mechanic);
                setPage('adminEdit');
              }}
              onReject={(mechanic) => {
                if (!confirm(`Reject ${mechanic.fullName}'s signup?`)) return;
                void withLoading(async () => {
                  await reviewSignup(mechanic.id, 'reject');
                  setToast({ kind: 'success', text: `${mechanic.fullName} rejected.` });
                  setMechanics(await listMechanics());
                });
              }}
              onRefresh={loadMechanics}
              onToggleStatus={(mechanic) => {
                const next = mechanic.status === 'active' ? 'inactive' : 'active';
                void withLoading(async () => {
                  await setTechnicianStatus(mechanic.id, next);
                  setToast({ kind: 'success', text: `${mechanic.fullName} is now ${next}.` });
                  setMechanics(await listMechanics());
                });
              }}
              onView={(mechanic) => {
                setSelectedMechanic(mechanic);
                setPage('adminDetails');
              }}
            />
          )}
          {page === 'adminJobs' && <AdminJobBoard mechanics={mechanics} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminProfileRequests' && <AdminProfileRequests mechanics={mechanics} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminSettings' && <Settings darkMode={darkMode} onToggleDarkMode={setDarkMode} />}
          {page === 'adminDetails' && selectedMechanic && (
            <DetailPage editable mechanic={selectedMechanic} onBack={() => setPage('adminMechanics')} onEdit={() => setPage('adminEdit')} title="Mechanic Details" />
          )}
          {page === 'adminEdit' && selectedMechanic && (
            <EditMechanic
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
  );
}

function Landing({ darkMode, onAdmin, onMechanicLogin, onMechanicSignup, onToggleDarkMode }: { darkMode: boolean; onAdmin: () => void; onMechanicLogin: () => void; onMechanicSignup: () => void; onToggleDarkMode: (value: boolean) => void }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="landing-page">
      <div className="top-actions">
        <button className="admin-link" onClick={onAdmin}>Admin Login</button>
        <LanguageSelector label={t('languageLabel')} language={language} onChange={setLanguage} />
        <label className="theme-toggle"><span>{darkMode ? 'Dark' : 'Light'} mode</span><span className="switch"><input checked={darkMode} onChange={(event) => onToggleDarkMode(event.target.checked)} type="checkbox" /><span /></span></label>
      </div>
      <section className="hero-panel">
        <div aria-label="Mechanic Directory logo" className="hero-mark" role="img">
          <svg className="logo-icon" fill="none" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
            <path className="logo-gear-ring" d="M48 16 54 21 61.8 20.6 64.4 28 71.2 31.8 69.8 39.5 74 46 69.8 52.5 71.2 60.2 64.4 64 61.8 71.4 54 71 48 76 42 71 34.2 71.4 31.6 64 24.8 60.2 26.2 52.5 22 46 26.2 39.5 24.8 31.8 31.6 28 34.2 20.6 42 21 48 16Z" />
            <circle className="logo-gear-center" cx="48" cy="46" r="13" />
            <path className="logo-wrench" d="M64 28 41 51m0 0-6-6-12 12 6 6 12-12Zm23-23 9-9a10 10 0 0 1-12 12Z" />
          </svg>
        </div>
        <p className="eyebrow">Village and district service network</p>
        <h1>Mechanic Directory</h1>
        <p>Maintain a clean, centralized database of technicians, profiles, and admin-managed records.</p>
        <div className="hero-actions">
          <button className="primary large" onClick={onMechanicLogin}>{t('technicianLogin')}</button>
          <button className="secondary large" onClick={onMechanicSignup}>{t('technicianSignup')}</button>
        </div>
        <span className="status-dot">{firebaseConfigured ? 'Firebase connected' : 'Firebase not configured'}</span>
      </section>
    </main>
  );
}

function LockedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="app-shell">
      <main className="auth-page">
        <section className="auth-card card">
          <h2>Locked</h2>
          <p className="muted">Unlock with your fingerprint, face, or device passcode to continue.</p>
          <button className="primary" onClick={onRetry} type="button">Try Again</button>
        </section>
      </main>
    </div>
  );
}

function AuthLayout({ children, onBack, title }: { children: React.ReactNode; onBack: () => void; title: string }) {
  return (
    <main className="auth-page">
      <section className="auth-card card">
        <button className="text-button" onClick={onBack}>Back</button>
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}

/**
 * Day-to-day login is phone + PIN (loginWithPin), not a fresh OTP every time.
 * OTP only re-enters the picture as the "forgot PIN" / locked-account
 * recovery path (see ForgotPinFlow below) — the exact same flow signup uses,
 * reused rather than duplicated.
 */
function MechanicLogin({ onLogin, onPending, setToast, withLoading }: { onLogin: (mechanicId: string) => void; onPending: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'pin' | 'forgotOtp'>('pin');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPinValue] = useState('');
  const canUseBiometric = useMemo(() => isBiometricPinEnabled(), []);

  async function afterSignIn() {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in failed. Try again.');
    const technician = await getMechanic(uid);
    if (!technician) {
      await signOut(auth);
      throw new Error(t('noAccountFound'));
    }
    if (technician.status === 'active') {
      onLogin(uid);
    } else {
      onPending(uid);
    }
  }

  /** Routes a failed loginWithPin call to either a retryable toast or the OTP-recovery flow. */
  async function handlePinLoginError(err: unknown): Promise<void> {
    const { reason, remainingAttempts } = getPinErrorInfo(err);

    if (reason === 'PIN_NOT_SET' || reason === 'LOCKED') {
      setMode('forgotOtp');
      setToast({ kind: 'error', text: reason === 'LOCKED' ? t('pinLockedMessage') : t('pinNotSetMessage') });
      return;
    }

    if (reason === 'WRONG_PIN') {
      const suffix = typeof remainingAttempts === 'number' ? ` (${remainingAttempts})` : '';
      throw new Error(`${t('wrongPinError')}${suffix}`);
    }

    throw err;
  }

  async function submitPin(event: FormEvent) {
    event.preventDefault();
    await withLoading(async () => {
      try {
        await loginWithPin(phoneNumber, pin);
      } catch (err) {
        await handlePinLoginError(err);
        return;
      }
      await afterSignIn();
    });
  }

  async function useFingerprint() {
    await withLoading(async () => {
      const stored = await tryBiometricPinLogin();
      if (!stored) return;

      setPhoneNumber(stored.phoneNumber);
      setPinValue(stored.pin);

      try {
        await loginWithPin(stored.phoneNumber, stored.pin);
      } catch (err) {
        await handlePinLoginError(err);
        return;
      }
      await afterSignIn();
    });
  }

  if (mode === 'forgotOtp') {
    return <ForgotPinFlow onDone={afterSignIn} setToast={setToast} withLoading={withLoading} />;
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submitPin(event)}>
      <Input label={t('mobileNumber')} onChange={setPhoneNumber} value={phoneNumber} />
      <PinInput label={t('pin')} onChange={setPinValue} value={pin} />
      <button className="primary" type="submit">{t('loginButton')}</button>
      {canUseBiometric && (
        <button className="secondary" onClick={() => void useFingerprint()} type="button">
          {t('useFingerprintButton')}
        </button>
      )}
      <button className="text-button" onClick={() => setMode('forgotOtp')} type="button">
        {t('forgotPinLink')}
      </button>
    </form>
  );
}

/** Forgot/locked PIN recovery: the same phone-OTP flow signup uses, ending in the same PIN-set step. */
function ForgotPinFlow({ onDone, setToast, withLoading }: { onDone: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const { confirmOtp, devHint, otp, phoneNumber, sendOtp, session, setOtp, setPhoneNumber } = usePhoneOtp();
  const [verified, setVerified] = useState(false);

  async function send() {
    await withLoading(async () => {
      try {
        await sendOtp();
      } catch (err) {
        throw err instanceof Error && err.message === 'INVALID_PHONE' ? new Error(t('enterValidPhone')) : err;
      }
      setToast({ kind: 'success', text: devHint ? `Dev code: ${devHint}` : t('codeSentBySms') });
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }
    await withLoading(async () => {
      await confirmOtp();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign-in failed. Try again.');
      const technician = await getMechanic(uid);
      if (!technician) {
        await signOut(auth);
        throw new Error(t('noAccountFound'));
      }
      setVerified(true);
    });
  }

  if (verified) {
    return <SetPinStep onDone={onDone} phoneNumber={phoneNumber} setToast={setToast} withLoading={withLoading} />;
  }

  return (
    <form className="form-grid" onSubmit={(event) => void verify(event)}>
      <Input label={t('mobileNumber')} onChange={setPhoneNumber} value={phoneNumber} />
      <div className="otp-row"><Input label={t('otp')} onChange={setOtp} value={otp} /><button className="secondary" onClick={() => void send()} type="button">{t('sendOtp')}</button></div>
      <button className="primary" type="submit">{t('verifyButton')}</button>
    </form>
  );
}

/**
 * Sets/resets the PIN (used right after signup, and again after a
 * forgot-PIN OTP recovery), then optionally offers to enroll the biometric
 * shortcut on this device. Shared by MechanicSignup and ForgotPinFlow so the
 * "two PinInputs → setPin → optional biometric offer" sequence exists once.
 */
function SetPinStep({ onDone, phoneNumber, setToast, withLoading }: { onDone: () => Promise<void>; phoneNumber: string; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const [pin, setPinValue] = useState('');
  const [confirmPinValue, setConfirmPinValue] = useState('');
  const [offerBiometric, setOfferBiometric] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setToast({ kind: 'error', text: t('pinFormatError') });
      return;
    }
    if (pin !== confirmPinValue) {
      setToast({ kind: 'error', text: t('pinMismatchError') });
      return;
    }
    await withLoading(async () => {
      await setPin(pin);
      if (await isBiometricAvailable()) {
        setOfferBiometric(true);
      } else {
        await onDone();
      }
    });
  }

  async function respondToBiometricOffer(enable: boolean) {
    await withLoading(async () => {
      if (enable) {
        await enableBiometricPin(phoneNumber, pin);
      }
      await onDone();
    });
  }

  if (offerBiometric) {
    return (
      <div className="form-grid">
        <p className="muted">{t('enableBiometricPrompt')}</p>
        <div className="button-row">
          <button className="primary" onClick={() => void respondToBiometricOffer(true)} type="button">{t('enableBiometricYes')}</button>
          <button className="secondary" onClick={() => void respondToBiometricOffer(false)} type="button">{t('enableBiometricNo')}</button>
        </div>
      </div>
    );
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <p className="success-text">{t('setPinHint')}</p>
      <PinInput label={t('newPinLabel')} onChange={setPinValue} value={pin} />
      <PinInput label={t('confirmPinLabel')} onChange={setConfirmPinValue} value={confirmPinValue} />
      <button className="primary" type="submit">{t('setPinButton')}</button>
    </form>
  );
}

function MechanicSignup({ onRegistered, setToast, withLoading }: { onRegistered: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const { confirmOtp, devHint, otp, phoneNumber, sendOtp, session, setOtp, setPhoneNumber } = usePhoneOtp();
  const [step, setStep] = useState<'verify' | 'profile' | 'setPin'>('verify');
  const [form, setForm] = useState<MechanicForm>(emptyMechanicForm);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [registeredUid, setRegisteredUid] = useState<string | null>(null);

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function send() {
    await withLoading(async () => {
      try {
        await sendOtp();
      } catch (err) {
        throw err instanceof Error && err.message === 'INVALID_PHONE' ? new Error(t('enterValidPhone')) : err;
      }
      setToast({ kind: 'success', text: devHint ? `Dev code: ${devHint}` : t('codeSentBySms') });
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }
    await withLoading(async () => {
      await confirmOtp();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign-in failed. Try again.');
      const existingTechnician = await getMechanic(uid);
      if (existingTechnician) {
        await signOut(auth);
        throw new Error(t('accountExists'));
      }
      setForm((current) => ({ ...current, phoneNumber: phoneNumber.trim() }));
      setStep('profile');
    });
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    const { phoneNumber: _phoneNumber, ...profile } = form;
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await completeSignup(profile);
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Registration failed. Try again.');
      setRegisteredUid(uid);
      setStep('setPin');
    });
  }

  if (step === 'verify') {
    return (
      <form className="form-grid" onSubmit={(event) => void verify(event)}>
        <Input label={t('mobileNumber')} onChange={setPhoneNumber} value={phoneNumber} />
        <div className="otp-row"><Input label={t('otp')} onChange={setOtp} value={otp} /><button className="secondary" onClick={() => void send()} type="button">{t('sendOtp')}</button></div>
        <button className="primary" type="submit">{t('verifyButton')}</button>
      </form>
    );
  }

  if (step === 'setPin' && registeredUid) {
    return (
      <SetPinStep
        onDone={async () => onRegistered(registeredUid)}
        phoneNumber={phoneNumber}
        setToast={setToast}
        withLoading={withLoading}
      />
    );
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submitProfile(event)}>
      <p className="success-text">{t('phoneVerifiedCompleteProfile')}</p>
      <MechanicFields errors={errors} form={form} onChange={updateField} translated />
      <button className="primary" type="submit">{t('submitButton')}</button>
    </form>
  );
}

function AdminLogin({ onLogin, withLoading }: { onLogin: (admin: AdminProfile) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await withLoading(async () => onLogin(await loginAdmin(email, password)));
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input label="Email" onChange={setEmail} type="email" value={email} />
      <Input label="Password" onChange={setPassword} type="password" value={password} />
      <button className="primary" type="submit">Admin Login</button>
      <p className="muted">Admin users are created manually in Firebase Authentication and the admins collection.</p>
    </form>
  );
}

function MechanicPending({ mechanic, onLogout }: { mechanic: Mechanic | null; onLogout: () => void }) {
  const { t } = useI18n();
  const status = mechanic?.status ?? 'pending';
  const heading = status === 'rejected' ? t('rejectedHeading') : status === 'inactive' ? t('inactiveHeading') : t('pendingHeading');
  const body = status === 'rejected' ? t('rejectedBody') : status === 'inactive' ? t('inactiveBody') : t('pendingBody');

  return (
    <main className="auth-page">
      <section className="auth-card card">
        <h2>{heading}</h2>
        <p className="muted">{body}</p>
        <p className="muted">{t('supportLabel')}: <a href={`tel:${SUPPORT_NUMBER}`}>{SUPPORT_NUMBER}</a></p>
        <button className="danger" onClick={onLogout}>{t('logout')}</button>
      </section>
    </main>
  );
}

function MechanicDashboard({ mechanic, onChangePin, onJobs, onLogout, onProfile, onRequestChange }: { mechanic: Mechanic; onChangePin: () => void; onJobs: () => void; onLogout: () => void; onProfile: () => void; onRequestChange: () => void }) {
  const { t } = useI18n();

  return (
    <main className="dashboard-page mechanic-page">
      <section className="card profile-card">
        <p className="eyebrow">{t('welcome')}</p>
        <h1>{mechanic.fullName}</h1>
        <DetailGrid compact mechanic={mechanic} />
        <p className="muted">{t('supportLabel')}: <a href={`tel:${SUPPORT_NUMBER}`}>{SUPPORT_NUMBER}</a></p>
        <div className="button-row">
          <button className="primary" onClick={onJobs}>{t('jobsNav')}</button>
          <button className="secondary" onClick={onProfile}>{t('profileNav')}</button>
          <button className="secondary" onClick={onRequestChange}>{t('requestChangeNav')}</button>
          <button className="secondary" onClick={onChangePin}>{t('changePinNav')}</button>
          <button className="danger" onClick={onLogout}>{t('logout')}</button>
        </div>
      </section>
    </main>
  );
}

function AdminShell({ activePage, children, darkMode, onLogout, onNavigate, onToggleDarkMode }: { activePage: Page; children: React.ReactNode; darkMode: boolean; onLogout: () => void; onNavigate: (page: Page) => void; onToggleDarkMode: (value: boolean) => void }) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <h2>Mechanic Directory</h2>
        {navItems.map((item) => <button className={activePage === item.page ? 'active' : ''} key={item.page} onClick={() => onNavigate(item.page)}>{item.label}</button>)}
        <label className="sidebar-toggle"><span>Dark Mode</span><input checked={darkMode} onChange={(event) => onToggleDarkMode(event.target.checked)} type="checkbox" /></label>
        <button className="logout" onClick={onLogout}>Logout</button>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

function AdminDashboard({ active, inactive, pending, total }: { active: number; inactive: number; pending: number; total: number }) {
  return (
    <>
      <h1>Admin Dashboard</h1>
      <section className="metrics">
        <Metric label="Total Technicians" value={total} />
        <Metric label="Pending Approval" value={pending} />
        <Metric label="Active" value={active} />
        <Metric label="Inactive / Rejected" value={inactive} />
      </section>
    </>
  );
}

function MechanicsTable({ mechanics, onApprove, onEdit, onReject, onRefresh, onToggleStatus, onView }: { mechanics: Mechanic[]; onApprove: (mechanic: Mechanic) => void; onEdit: (mechanic: Mechanic) => void; onReject: (mechanic: Mechanic) => void; onRefresh: () => Promise<void>; onToggleStatus: (mechanic: Mechanic) => void; onView: (mechanic: Mechanic) => void }) {
  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [village, setVillage] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = useMemo(() => mechanics.filter((mechanic) => {
    const searchText = `${mechanic.fullName} ${mechanic.phoneNumber} ${mechanic.village} ${mechanic.district}`.toLowerCase();
    return searchText.includes(search.toLowerCase())
      && (!district || mechanic.district.toLowerCase().includes(district.toLowerCase()))
      && (!village || mechanic.village.toLowerCase().includes(village.toLowerCase()))
      && (status === 'all' || mechanic.status === status);
  }), [district, mechanics, search, status, village]);

  return (
    <section>
      <div className="section-heading"><h1>Mechanics</h1><button className="secondary" onClick={() => void onRefresh()}>Refresh</button></div>
      <div className="card filters">
        <Input label="Search" onChange={setSearch} value={search} />
        <Input label="District" onChange={setDistrict} value={district} />
        <Input label="Village" onChange={setVillage} value={village} />
        <Select label="Status" onChange={setStatus} options={[['all', 'All'], ['pending', 'Pending'], ['active', 'Active'], ['inactive', 'Inactive'], ['rejected', 'Rejected']]} value={status} />
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone Number</th><th>Village</th><th>District</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((mechanic) => (
              <tr key={mechanic.id}>
                <td>{mechanic.fullName}</td><td>{mechanic.phoneNumber}</td><td>{mechanic.village}</td><td>{mechanic.district}</td><td>{mechanic.experience}</td>
                <td><span className={`pill ${mechanic.status}`}>{mechanic.status}</span></td>
                <td className="actions">
                  <button onClick={() => onView(mechanic)}>View</button>
                  <button onClick={() => onEdit(mechanic)}>Edit</button>
                  {mechanic.status === 'pending' && (
                    <>
                      <button onClick={() => onApprove(mechanic)}>Approve</button>
                      <button className="danger-text" onClick={() => onReject(mechanic)}>Reject</button>
                    </>
                  )}
                  {(mechanic.status === 'active' || mechanic.status === 'inactive') && (
                    <button className={mechanic.status === 'active' ? 'danger-text' : ''} onClick={() => onToggleStatus(mechanic)}>
                      {mechanic.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No mechanics found.</p>}
      </div>
    </section>
  );
}

function DetailPage({ editable, mechanic, onBack, onEdit, onRequestChange, title }: { editable: boolean; mechanic: Mechanic; onBack: () => void; onEdit?: () => void; onRequestChange?: () => void; title: string }) {
  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button" onClick={onBack}>Back</button>
        <h1>{title}</h1>
        <h2>{mechanic.fullName}</h2>
        <DetailGrid mechanic={mechanic} />
        {editable && onEdit && <button className="primary" onClick={onEdit}>Edit Profile</button>}
        {onRequestChange && <button className="primary" onClick={onRequestChange}>Request a Change</button>}
      </section>
    </main>
  );
}

function EditMechanic({ mechanic, onBack, onSaved, setToast, withLoading }: { mechanic: Mechanic; onBack: () => void; onSaved: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const [form, setForm] = useState<MechanicForm>(toMechanicForm(mechanic));
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { phoneNumber: _phoneNumber, ...profile } = form;
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    await withLoading(async () => {
      await adminUpdateProfile(mechanic.id, trimMechanicForm(form));
      setToast({ kind: 'success', text: 'Profile updated successfully' });
      await onSaved();
    });
  }

  return (
    <main className="detail-page">
      <form className="card form-grid edit-card" onSubmit={(event) => void submit(event)}>
        <button className="text-button" onClick={onBack} type="button">Back</button>
        <h1>Edit Profile</h1>
        <MechanicFields errors={errors} form={form} onChange={updateField} />
        <button className="primary" type="submit">Save Changes</button>
      </form>
    </main>
  );
}

function Settings({ darkMode, onToggleDarkMode }: { darkMode: boolean; onToggleDarkMode: (value: boolean) => void }) {
  return <section className="card settings-card"><h1>Settings</h1><label className="checkbox-row"><input checked={darkMode} onChange={(event) => onToggleDarkMode(event.target.checked)} type="checkbox" /> Enable dark mode</label></section>;
}

// `translated` is only true on the technician's own signup form — the admin's
// edit screen (EditMechanic) always stays in English, since admin works the
// web console regardless of a technician's chosen language. See i18n/strings.ts.
function MechanicFields({ disabled = false, errors = {}, form, onChange, translated = false }: { disabled?: boolean; errors?: ValidationErrors; form: MechanicForm; onChange: (key: keyof MechanicForm, value: string) => void; translated?: boolean }) {
  const { t } = useI18n();
  const labels = translated
    ? {
        fullName: t('fullName'),
        village: t('village'),
        district: t('district'),
        state: t('state'),
        pincode: t('pincode'),
        address: t('address'),
        landmark: t('landmarkOptional'),
        age: t('age'),
        experience: t('experience'),
      }
    : {
        fullName: 'Full Name',
        village: 'Village',
        district: 'District',
        state: 'State',
        pincode: 'Pincode',
        address: 'Address',
        landmark: 'Landmark (optional)',
        age: 'Age',
        experience: 'Years of Experience',
      };

  return (
    <fieldset className="form-grid fields-grid" disabled={disabled}>
      <Input error={errors.fullName} label={labels.fullName} onChange={(value) => onChange('fullName', value)} value={form.fullName} />
      <Input label={labels.village} error={errors.village} onChange={(value) => onChange('village', value)} value={form.village} />
      <Input label={labels.district} error={errors.district} onChange={(value) => onChange('district', value)} value={form.district} />
      <Input label={labels.state} onChange={(value) => onChange('state', value)} value={form.state} />
      <Input label={labels.pincode} error={errors.pincode} onChange={(value) => onChange('pincode', value)} value={form.pincode} />
      <Input label={labels.address} onChange={(value) => onChange('address', value)} value={form.address} />
      <Input label={labels.landmark} onChange={(value) => onChange('landmark', value)} value={form.landmark} />
      <Input error={errors.age} label={labels.age} onChange={(value) => onChange('age', value)} value={form.age} />
      <Input label={labels.experience} error={errors.experience} onChange={(value) => onChange('experience', value)} value={form.experience} />
    </fieldset>
  );
}

function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const rows = [
    ['Phone Number', mechanic.phoneNumber], ['Village', mechanic.village], ['District', mechanic.district],
    ['State', mechanic.state], ['Pincode', mechanic.pincode], ['Address', mechanic.address], ['Landmark', mechanic.landmark],
    ['Age', mechanic.age], ['Experience', `${mechanic.experience || '0'} years`], ['Status', mechanic.status],
    ['Jobs', `Pending ${mechanic.jobStats.pending} · Completed ${mechanic.jobStats.completed} · Cancelled ${mechanic.jobStats.cancelled}`],
    ['Registration Date', formatDate(mechanic.createdAt)],
  ];
  return <dl className={compact ? 'detail-grid compact' : 'detail-grid'}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>;
}

function trimMechanicForm(form: MechanicForm): MechanicForm {
  return Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()])) as MechanicForm;
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
    landmark: mechanic.landmark,
    age: mechanic.age,
    experience: mechanic.experience,
  };
}
