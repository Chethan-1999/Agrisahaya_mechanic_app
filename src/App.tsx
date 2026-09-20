import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, BriefcaseBusiness, Headphones, Menu, PhoneCall, Search, Store, UserRound, UsersRound, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';

import agrisahayaLogo from '../image.png';
import { PullToRefresh } from './components/PullToRefresh';
import { ConfirmModal, Input, LanguageSelector, Metric, Select, formatDate, getErrorMessage, jobStatusMeta, type ConfirmDialog, type Toast } from './components/ui';
import { auth, db, firebaseConfigured } from './firebase';
import { usePhoneOtp } from './hooks/usePhoneOtp';
import { useI18n } from './i18n/I18nContext';
import { loginAdmin } from './services/adminAuth';
import { listAnnouncements } from './services/announcements';
import { completeSignup, reapplySignup } from './services/auth';
import {
  adminUpdateProfile,
  getMechanic,
  listMechanics,
  revokeOtherSessions,
  reviewSignup,
  setTechnicianStatus,
} from './services/mechanics';
import { listAllJobs, visibleJobs } from './services/jobs';
import { initNotifications } from './services/notifications';
import type { AdminProfile, AppSession, Job, Mechanic, MechanicForm } from './types';
import { emptyMechanicForm } from './types';
import { indianStates } from './utils/indianStates';
import { clearReapplyDraft, clearSignupDraft, loadReapplyDraft, loadSignupDraft, saveReapplyDraft, saveSignupDraft } from './utils/signupDraft';
import { hasErrors, validateProfileForm, type ValidationErrors } from './utils/validation';
import { AdminAddJobs } from './screens/AdminAddJobs';
import { AdminAssignJobs } from './screens/AdminAssignJobs';
import { AdminCommunity } from './screens/AdminCommunity';
import { AdminProfileRequests } from './screens/AdminProfileRequests';
import { Community } from './screens/Community';
import { RequestProfileChange } from './screens/RequestProfileChange';
import { TechnicianJobs } from './screens/TechnicianJobs';

type Page =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicPending'
  | 'mechanicReapply'
  | 'mechanicMarketplace'
  | 'mechanicProfile'
  | 'mechanicJobs'
  | 'mechanicRequestChange'
  | 'mechanicCommunity'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminAddJobs'
  | 'adminAssignJobs'
  | 'adminCommunity'
  | 'adminProfileRequests'
  | 'adminDetails'
  | 'adminEdit';

const navItems: Array<{ label: string; page: Page }> = [
  { label: 'Dashboard', page: 'adminDashboard' },
  { label: 'Mechanics', page: 'adminMechanics' },
  { label: 'Add new jobs', page: 'adminAddJobs' },
  { label: 'Assign jobs', page: 'adminAssignJobs' },
  { label: 'Community', page: 'adminCommunity' },
  { label: 'Profile change request', page: 'adminProfileRequests' },
];

const SUPPORT_NUMBER = '9646424964';

const mechanicTabs: Array<{ Icon: typeof BriefcaseBusiness; label: string; page: Page }> = [
  { Icon: BriefcaseBusiness, label: 'Jobs', page: 'mechanicJobs' },
  { Icon: UsersRound, label: 'Community', page: 'mechanicCommunity' },
  { Icon: Store, label: 'Marketplace', page: 'mechanicMarketplace' },
  { Icon: UserRound, label: 'Profile', page: 'mechanicProfile' },
];

const announcementsSeenKey = (technicianId: string) => `agrisahaya.announcementsSeenAt.${technicianId}`;
const NETWORK_TIMEOUT_MS = 15000;
const toPhoneDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

function readAnnouncementsSeenAt(technicianId: string) {
  try {
    return window.localStorage.getItem(announcementsSeenKey(technicianId)) ?? '';
  } catch {
    return '';
  }
}

function writeAnnouncementsSeenAt(technicianId: string, value: string) {
  try {
    window.localStorage.setItem(announcementsSeenKey(technicianId), value);
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts — the badge just reappears.
  }
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), NETWORK_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

// Where the Android hardware/gesture back button goes from each page; pages not listed are roots (back exits the app).
const backTarget: Partial<Record<Page, Page>> = {
  mechanicReapply: 'mechanicPending',
  mechanicAuth: 'landing',
  adminLogin: 'landing',
  mechanicProfile: 'mechanicJobs',
  mechanicMarketplace: 'mechanicJobs',
  mechanicCommunity: 'mechanicJobs',
  mechanicRequestChange: 'mechanicProfile',
  adminMechanics: 'adminDashboard',
  adminAddJobs: 'adminDashboard',
  adminAssignJobs: 'adminDashboard',
  adminCommunity: 'adminDashboard',
  adminProfileRequests: 'adminDashboard',
  adminDetails: 'adminMechanics',
  adminEdit: 'adminMechanics',
};

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [session, setSession] = useState<AppSession>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [currentMechanic, setCurrentMechanic] = useState<Mechanic | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener('backButton', () => {
      const target = backTarget[page];
      if (target) setPage(target);
      else void CapacitorApp.exitApp();
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [page]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // Reveals a persisted Firebase session's data — looks up admins/{uid} then
  // technicians/{uid} and sets session+page accordingly.
  async function revealSession(user: User): Promise<boolean> {
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
      return true;
    }

    const technician = await getMechanic(user.uid);

    if (technician) {
      setSession({ role: 'mechanic', mechanicId: user.uid });
      setPage(technician.status === 'active' ? 'mechanicJobs' : 'mechanicPending');
      return true;
    }

    return false;
  }

  // Restores a persisted Firebase session on load/refresh instead of
  // dropping the user back to the landing page every time — the app opens
  // straight to the dashboard with no lock/login prompt whenever a session
  // is already there.
  useEffect(() => {
    let handledInitialAuthState = false;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (handledInitialAuthState) return;
      handledInitialAuthState = true;

      if (!user) {
        setBootstrapping(false);
        return;
      }

      void (async () => {
        try {
          const restored = await withTimeout(revealSession(user), 'Session restore timed out. Please sign in again.');
          if (!restored) {
            await signOut(auth);
            setSession(null);
            setCurrentMechanic(null);
            setPage('landing');
          }
        } catch (error) {
          console.warn('Session restore failed:', error);
          void signOut(auth);
          setSession(null);
          setCurrentMechanic(null);
          setPage('landing');
        } finally {
          setBootstrapping(false);
        }
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (session?.role === 'mechanic') {
      void loadCurrentMechanic(session.mechanicId);
      void initNotifications();
    }

    if (session?.role === 'admin') {
      void loadMechanics();
      void loadJobs();
    }
  }, [session]);

  // Unread badge on the Announcements tab: count of announcements newer than the last time this device opened the tab.
  async function refreshUnreadAnnouncements(technicianId: string) {
    try {
      const seenAt = readAnnouncementsSeenAt(technicianId);
      const announcements = await listAnnouncements();
      setUnreadAnnouncements(announcements.filter((announcement) => announcement.createdAt > seenAt).length);
    } catch {
      // Badge is a nicety — never surface an error for it.
    }
  }

  useEffect(() => {
    if (session?.role !== 'mechanic' || currentMechanic?.status !== 'active') return;

    if (page === 'mechanicCommunity') {
      writeAnnouncementsSeenAt(session.mechanicId, new Date().toISOString());
      setUnreadAnnouncements(0);
    } else {
      void refreshUnreadAnnouncements(session.mechanicId);
    }
  }, [page, session, currentMechanic?.status]);

  // The pending/inactive screen has no other trigger to notice an admin's decision, so poll quietly.
  useEffect(() => {
    if (session?.role !== 'mechanic' || page !== 'mechanicPending') return;

    const mechanicId = session.mechanicId;
    const intervalId = window.setInterval(() => {
      void getMechanic(mechanicId)
        .then((technician) => {
          if (!technician) return;
          setCurrentMechanic(technician);
          if (technician.status === 'active') setPage('mechanicJobs');
        })
        .catch(() => undefined);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [page, session]);

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

  async function loadJobs() {
    await withLoading(async () => setJobs(await listAllJobs()));
  }

  async function loadCurrentMechanic(id: string) {
    await withLoading(async () => setCurrentMechanic(await getMechanic(id)));
  }

  function logout() {
    setConfirmDialog({
      title: 'Logout?',
      message: session?.role === 'admin' ? 'Logout from admin account?' : t('logoutConfirm'),
      confirmLabel: t('logout'),
      kind: 'danger',
      onConfirm: () => {
        void signOut(auth);
        setSession(null);
        setCurrentMechanic(null);
        setSelectedMechanic(null);
        setPage('landing');
      },
    });
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

  return (
    <div className="app-shell">
      {/* Invisible reCAPTCHA anchor for firebaseOtpProvider's signInWithPhoneNumber — always mounted, never shown. */}
      <div id="recaptcha-container" />
      {loading && <div className="loading"><span />Loading...</div>}
      {confirmDialog && (
        <ConfirmModal
          dialog={confirmDialog}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={(value) => {
            const { onConfirm } = confirmDialog;
            setConfirmDialog(null);
            onConfirm(value);
          }}
        />
      )}
      {toast && <button className={`toast ${toast.kind}`} onClick={() => setToast(null)}>{toast.text}</button>}

      {page === 'landing' && (
        <Landing
          onAdmin={() => setPage('adminLogin')}
          onMechanicLogin={() => {
            setAuthTab('login');
            setPage('mechanicAuth');
          }}
          onMechanicSignup={() => {
            setAuthTab('signup');
            setPage('mechanicAuth');
          }}
        />
      )}

      {page === 'mechanicAuth' && (
        <AuthLayout onBack={() => setPage('landing')} title={t('technicianAccess')}>
          <div className="tabs">
            <button className={authTab === 'login' ? 'active' : ''} onClick={() => setAuthTab('login')} type="button">{t('login')}</button>
            <button className={authTab === 'signup' ? 'active' : ''} onClick={() => setAuthTab('signup')} type="button">{t('signUp')}</button>
          </div>
          <MechanicAuth
            mode={authTab}
            onExisting={(mechanicId, technician) => {
              setSession({ role: 'mechanic', mechanicId });
              setPage(technician.status === 'active' ? 'mechanicJobs' : 'mechanicPending');
            }}
            onNew={(mechanicId) => {
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

      {session?.role === 'mechanic' && page === 'mechanicPending' && (
        <PullToRefresh onRefresh={async () => {
          const technician = await getMechanic(session.mechanicId);
          if (!technician) return;
          setCurrentMechanic(technician);
          if (technician.status === 'active') setPage('mechanicJobs');
        }}>
          <MechanicPending mechanic={currentMechanic} onLogout={logout} onReapply={() => setPage('mechanicReapply')} />
        </PullToRefresh>
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicReapply' && (
        <ReapplyForm
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicPending')}
          onSubmitted={async () => {
            setToast({ kind: 'success', text: t('reapplySubmittedToast') });
            setCurrentMechanic(await getMechanic(currentMechanic.id));
            setPage('mechanicPending');
          }}
          setToast={setToast}
          withLoading={withLoading}
        />
      )}

      {session?.role === 'mechanic' && currentMechanic && mechanicTabs.some((tab) => tab.page === page) && (
        <MechanicShell activePage={page} onNavigate={setPage} unreadAnnouncements={unreadAnnouncements}>
          {page === 'mechanicJobs' && (
            <TechnicianJobs
              setToast={setToast}
              technicianId={currentMechanic.id}
              withLoading={withLoading}
            />
          )}
          {page === 'mechanicCommunity' && <Community withLoading={withLoading} />}
          {page === 'mechanicMarketplace' && <MarketplaceComingSoon />}
          {page === 'mechanicProfile' && (
            <MechanicProfile
              mechanic={currentMechanic}
              onLogout={logout}
              onRefresh={() => loadCurrentMechanic(session.mechanicId)}
              onRequestChange={() => setPage('mechanicRequestChange')}
            />
          )}
        </MechanicShell>
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

      {session?.role === 'admin' && page.startsWith('admin') && (
        <AdminShell activePage={page} onLogout={logout} onNavigate={setPage}>
          {page === 'adminDashboard' && (
            <AdminDashboard active={activeMechanics} inactive={inactiveMechanics} jobs={visibleJobs(jobs)} mechanics={mechanics} pending={pendingMechanics} total={mechanics.length} />
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
              onReject={(mechanic) => setConfirmDialog({
                title: 'Reject signup?',
                message: `${mechanic.fullName}'s signup will be rejected. They can correct their details and apply again.`,
                confirmLabel: 'Reject',
                kind: 'danger',
                inputLabel: 'Reason (optional, shown to the mechanic)',
                onConfirm: (reason) => {
                  void withLoading(async () => {
                    await reviewSignup(mechanic.id, 'reject', undefined, reason);
                    setToast({ kind: 'success', text: `${mechanic.fullName} rejected.` });
                    setMechanics(await listMechanics());
                  });
                },
              })}
              onRefresh={loadMechanics}
              onToggleStatus={(mechanic) => {
                const next = mechanic.status === 'active' ? 'inactive' : 'active';
                const toggle = () => {
                  void withLoading(async () => {
                    await setTechnicianStatus(mechanic.id, next);
                    setToast({ kind: 'success', text: `${mechanic.fullName} is now ${next}.` });
                    setMechanics(await listMechanics());
                  });
                };
                if (next === 'active') {
                  toggle();
                  return;
                }
                setConfirmDialog({
                  title: 'Deactivate mechanic?',
                  message: `${mechanic.fullName} will lose access until reactivated. Any jobs they hold are taken back and marked for reassignment.`,
                  confirmLabel: 'Deactivate',
                  kind: 'danger',
                  onConfirm: toggle,
                });
              }}
              onView={(mechanic) => {
                setSelectedMechanic(mechanic);
                setPage('adminDetails');
              }}
            />
          )}
          {page === 'adminAddJobs' && <AdminAddJobs askConfirm={setConfirmDialog} jobs={jobs} onRefresh={loadJobs} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminAssignJobs' && <AdminAssignJobs askConfirm={setConfirmDialog} jobs={jobs} mechanics={mechanics} onRefresh={loadJobs} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminProfileRequests' && <AdminProfileRequests mechanics={mechanics} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminCommunity' && <AdminCommunity setToast={setToast} withLoading={withLoading} />}
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

function Landing({ onAdmin, onMechanicLogin, onMechanicSignup }: { onAdmin: () => void; onMechanicLogin: () => void; onMechanicSignup: () => void }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <main className="landing-page">
      <section className="hero-panel">
        <div className="landing-card-actions">
          <button className="admin-link" onClick={onAdmin}>{t('adminLogin')}</button>
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

function AuthLayout({ children, onBack, title }: { children: React.ReactNode; onBack: () => void; title: string }) {
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

/**
 * Merged login/signup: phone-OTP verification only, no PIN. After OTP
 * verifies, an existing technician (technicians/{uid} already exists) is
 * revealed directly; a brand-new phone number is walked through the profile
 * form and completeSignup. Both paths call revokeOtherSessions right after
 * sign-in to enforce "only one phone at a time" (see technicianFunctions.ts)
 * — the getIdToken(true) refresh after it keeps THIS device's own session
 * from being caught by the same revocation.
 */
function MechanicAuth({ mode, onExisting, onNew, setToast, withLoading }: {
  mode: 'login' | 'signup';
  onExisting: (mechanicId: string, technician: Mechanic) => void;
  onNew: (mechanicId: string) => void;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const { clearOtpSession, confirmOtp, otp, phoneNumber, sendOtp, session, setOtp, setPhoneNumber } = usePhoneOtp();
  const [step, setStep] = useState<'verify' | 'profile'>('verify');
  const [form, setForm] = useState<MechanicForm>(emptyMechanicForm);
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    setStep('verify');
    setForm(mode === 'signup' ? { ...emptyMechanicForm, ...loadSignupDraft() } : emptyMechanicForm);
    setSentOtp(null);
    setOtpVerified(false);
    setErrors({});
  }, [mode]);

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: key === 'phoneNumber' ? toPhoneDigits(value) : value };
      if (mode === 'signup') {
        const { phoneNumber: _phoneNumber, ...draft } = next;
        saveSignupDraft(draft);
      }
      return next;
    });
  }

  function updatePhoneNumber(value: string) {
    setPhoneNumber(toPhoneDigits(value));
    setForm((current) => ({ ...current, phoneNumber: toPhoneDigits(value) }));
    setSentOtp(null);
    setOtpVerified(false);
    clearOtpSession();
    setErrors((current) => ({ ...current, phoneNumber: undefined }));
  }

  function clearSignupForm() {
    clearSignupDraft();
    setPhoneNumber('');
    setOtp('');
    setForm(emptyMechanicForm);
    setSentOtp(null);
    setOtpVerified(false);
    clearOtpSession();
    setErrors({});
  }

  async function send() {
    await withLoading(async () => {
      let hint: string | null;
      try {
        hint = await withTimeout(sendOtp(), 'OTP request timed out. Check that Firebase or the local emulators are running, then try again.');
      } catch (err) {
        throw err instanceof Error && err.message === 'INVALID_PHONE' ? new Error(t('enterValidPhone')) : err;
      }
      setSentOtp(hint ?? 'sent');
      setOtpVerified(false);
      setToast({ kind: 'success', text: hint ? `Dev code: ${hint}` : t('codeSentBySms') });
    });
  }

  async function verifySignupOtp() {
    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }

    await withLoading(async () => {
      await withTimeout(confirmOtp(), 'OTP verification timed out. Check that Firebase or the local emulators are running, then try again.');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign-in failed. Try again.');

      const technician = await withTimeout(getMechanic(uid), 'Checking mechanic profile timed out. Check Firestore or the local emulators, then try again.');
      if (technician) {
        await signOut(auth);
        throw new Error(t('phoneAlreadyExists'));
      }

      setForm((current) => ({ ...current, phoneNumber: phoneNumber.trim() }));
      setOtpVerified(true);
      setErrors({});
      setToast({ kind: 'success', text: t('otpVerifiedComplete') });
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }
    await withLoading(async () => {
      await withTimeout(confirmOtp(), 'OTP verification timed out. Check that Firebase or the local emulators are running, then try again.');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign-in failed. Try again.');

      const technician = await withTimeout(getMechanic(uid), 'Checking mechanic profile timed out. Check Firestore or the local emulators, then try again.');
      if (technician) {
        await withTimeout(revokeOtherSessions(), 'Session cleanup timed out. Try again.');
        await withTimeout(auth.currentUser?.getIdToken(true) ?? Promise.resolve(''), 'Refreshing your session timed out. Try again.');
        if (mode === 'signup') {
          setToast({ kind: 'success', text: 'This number is already registered. Opening your account.' });
        }
        onExisting(uid, technician);
        return;
      }

      if (mode === 'login') {
        await signOut(auth);
        setToast({ kind: 'error', text: 'No mechanic account found. Please use Sign Up to register.' });
        return;
      }

      setForm((current) => ({ ...current, phoneNumber: phoneNumber.trim() }));
      setStep('profile');
    });
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (mode === 'signup' && !otpVerified) {
      setToast({ kind: 'error', text: t('verifyOtpEnableFields') });
      return;
    }

    const { phoneNumber: _phoneNumber, ...profile } = form;
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await withTimeout(completeSignup(profile), 'Signup timed out. Check that Firebase Functions are running, then try again.');
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Registration failed. Try again.');
      clearSignupDraft();
      void revokeOtherSessions();
      onNew(uid);
    });
  }

  if (mode === 'signup') {
    return (
      <form className="form-grid" onSubmit={(event) => void submitProfile(event)}>
        <div className="otp-row">
          <Input disabled={otpVerified} error={errors.phoneNumber} inputMode="numeric" label={t('mobileNumber')} maxLength={10} onChange={updatePhoneNumber} pattern="[0-9]*" value={phoneNumber} />
          <button className="secondary" disabled={otpVerified} onClick={() => void send()} type="button">{t('sendOtp')}</button>
        </div>
        <div className="otp-row">
          <Input disabled={otpVerified} label={t('otpVerification')} onChange={setOtp} value={otp} />
          <button className="secondary" disabled={otpVerified} onClick={() => void verifySignupOtp()} type="button">{t('verifyButton')}</button>
        </div>
        {sentOtp && sentOtp !== 'sent' && !otpVerified && <p className="success-text">Dev code: {sentOtp}</p>}
        <p className={otpVerified ? 'success-text' : 'muted'}>{otpVerified ? t('otpVerifiedFields') : t('verifyOtpEnableFields')}</p>
        <MechanicFields disabled={!otpVerified} errors={errors} form={form} onChange={updateField} translated />
        <button className="secondary" onClick={clearSignupForm} type="button">{t('clear')}</button>
        <button className="primary" type="submit">{t('submitButton')}</button>
      </form>
    );
  }

  if (step === 'profile') {
    return (
      <form className="form-grid" onSubmit={(event) => void submitProfile(event)}>
        <p className="success-text">{t('phoneVerifiedCompleteProfile')}</p>
        <MechanicFields errors={errors} form={form} onChange={updateField} translated />
        <button className="primary" type="submit">{t('submitButton')}</button>
      </form>
    );
  }

  return (
    <form className="form-grid" onSubmit={(event) => void verify(event)}>
      <Input label={t('mobileNumber')} onChange={setPhoneNumber} value={phoneNumber} />
      <div className="otp-row"><Input label={t('otp')} onChange={setOtp} value={otp} /><button className="secondary" onClick={() => void send()} type="button">{t('sendOtp')}</button></div>
      <button className="primary" type="submit">{t('verifyButton')}</button>
    </form>
  );
}

function AdminLogin({ onLogin, withLoading }: { onLogin: (admin: AdminProfile) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await withLoading(async () => onLogin(await loginAdmin(email, password)));
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input autoComplete="username" label="Email" name="email" onChange={setEmail} type="email" value={email} />
      <Input autoComplete="current-password" label="Password" name="password" onChange={setPassword} type="password" value={password} />
      <button className="primary" type="submit">{t('adminLogin')}</button>
      <p className="muted">This login is only for Agrisahay admin.</p>
    </form>
  );
}

function MechanicPending({ mechanic, onLogout, onReapply }: { mechanic: Mechanic | null; onLogout: () => void; onReapply: () => void }) {
  const { t } = useI18n();
  const status = mechanic?.status ?? 'pending';
  const heading = status === 'rejected' ? t('rejectedHeading') : status === 'inactive' ? t('inactiveHeading') : t('pendingHeading');
  const body = status === 'rejected' ? t('rejectedBody') : status === 'inactive' ? t('inactiveBody') : t('pendingBody');

  return (
    <main className="mechanic-app-page approval-page">
      <section className="approval-card">
        <div className="approval-badge" aria-hidden="true">{status === 'pending' ? '✓' : '!'}</div>
        <p className="eyebrow">{t('welcome')}</p>
        <h1>{mechanic?.fullName ?? ''}</h1>
        <div className="approval-status-pill">{heading}</div>
        {status === 'pending' && <div className="approval-progress" aria-hidden="true"><span /></div>}
        <p>{body}</p>
        {status === 'rejected' && mechanic?.rejectionReason && <p><strong>{t('rejectionReasonLabel')}:</strong> {mechanic.rejectionReason}</p>}
        {status === 'rejected' && <button className="primary" onClick={onReapply} type="button">{t('reapplyButton')}</button>}
        <p className="support-call-line"><PhoneCall size={16} strokeWidth={2.5} /> For Support Call: <a href={`tel:${SUPPORT_NUMBER}`}>{SUPPORT_NUMBER}</a></p>
        <button className="secondary approval-logout" onClick={onLogout} type="button">{t('logout')}</button>
      </section>
    </main>
  );
}

/** A rejected technician corrects their details and sends the signup to the admin again — as many times as needed. */
function ReapplyForm({ mechanic, onBack, onSubmitted, setToast, withLoading }: { mechanic: Mechanic; onBack: () => void; onSubmitted: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  // Whatever they were last typing on this phone wins; otherwise start from the details on their rejected application.
  const [form, setForm] = useState<MechanicForm>(() => ({ ...toMechanicForm(mechanic), ...loadReapplyDraft(mechanic.id) }));
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      const { phoneNumber: _phoneNumber, ...draft } = next;
      saveReapplyDraft(mechanic.id, draft);
      return next;
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { phoneNumber: _phoneNumber, ...profile } = trimMechanicForm(form);
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await withTimeout(reapplySignup(profile), 'Request timed out. Check your connection, then try again.');
      clearReapplyDraft(mechanic.id);
      await onSubmitted();
    });
  }

  return (
    <main className="detail-page">
      <form className="card form-grid edit-card" onSubmit={(event) => void submit(event)}>
        <button className="text-button back-button" onClick={onBack} type="button"><ArrowLeft size={18} aria-hidden="true" />{t('back')}</button>
        <h1>{t('reapplyTitle')}</h1>
        <p className="muted">{t('reapplyHint')}</p>
        {mechanic.rejectionReason && <p className="error-text">{t('rejectionReasonLabel')}: {mechanic.rejectionReason}</p>}
        <MechanicFields errors={errors} form={form} onChange={updateField} translated />
        <button className="primary" type="submit">{t('reapplyButton')}</button>
      </form>
    </main>
  );
}

function MechanicShell({ activePage, children, onNavigate, unreadAnnouncements }: { activePage: Page; children: React.ReactNode; onNavigate: (page: Page) => void; unreadAnnouncements: number }) {
  const { t } = useI18n();
  const [showSupport, setShowSupport] = useState(false);
  const canShowSupport = activePage === 'mechanicJobs';
  const labels: Partial<Record<Page, string>> = {
    mechanicJobs: t('jobsNav'),
    mechanicCommunity: t('communityNav'),
    mechanicProfile: t('profileNav'),
  };

  useEffect(() => {
    if (!canShowSupport) setShowSupport(false);
  }, [canShowSupport]);

  return (
    <main className="mechanic-app-page">
      <div className="mechanic-app-content">
        {canShowSupport && <div className="mechanic-help-area">
          <button aria-expanded={showSupport} aria-label={t('supportLabel')} className="mechanic-help-button" onClick={() => setShowSupport((isVisible) => !isVisible)} type="button">
            <Headphones size={20} strokeWidth={2.5} />
            <span>{t('supportLabel')}</span>
          </button>
          {showSupport && (
            <div className="mechanic-support-popover">
              <span>For Support</span>
              <a href={`tel:${SUPPORT_NUMBER}`}><PhoneCall size={18} strokeWidth={2.6} />{SUPPORT_NUMBER}</a>
            </div>
          )}
        </div>}
        {children}
      </div>
      <nav className="mechanic-bottom-nav" aria-label="Mechanic navigation">
        {mechanicTabs.map(({ Icon, label, page }) => (
          <button className={activePage === page ? 'active' : ''} key={page} onClick={() => onNavigate(page)} type="button">
            <span><Icon size={19} strokeWidth={2.4} />{page === 'mechanicCommunity' && unreadAnnouncements > 0 && <b>{unreadAnnouncements}</b>}</span>
            {labels[page] ?? label}
          </button>
        ))}
      </nav>
    </main>
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

function MechanicProfile({ mechanic, onLogout, onRefresh, onRequestChange }: { mechanic: Mechanic; onLogout: () => void; onRefresh: () => Promise<void>; onRequestChange: () => void }) {
  const { t } = useI18n();

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <section className="mechanic-profile-screen">
        <div className="mechanic-profile-hero">
          <div className="profile-avatar">{getInitials(mechanic.fullName)}</div>
          <p className="eyebrow">{t('welcome')}</p>
          <h1>{mechanic.fullName}</h1>
          <div className="profile-chip-row">
            <span>{mechanic.status}</span>
            <span>{mechanic.experience || '0'} yrs</span>
            <span>{mechanic.district || '-'}</span>
          </div>
          <button className="primary profile-edit-button" onClick={onRequestChange} type="button">{t('requestChangeNav')}</button>
        </div>
        <section className="profile-details-card">
          <h2>{t('profileNav')}</h2>
          <DetailGrid mechanic={mechanic} compact />
        </section>
        <button className="secondary profile-logout-button" onClick={onLogout} type="button">{t('logout')}</button>
      </section>
    </PullToRefresh>
  );
}

function AdminShell({ activePage, children, onLogout, onNavigate }: { activePage: Page; children: React.ReactNode; onLogout: () => void; onNavigate: (page: Page) => void }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeNavPage = activePage === 'adminDetails' || activePage === 'adminEdit' ? 'adminMechanics' : activePage;
  const activeLabel = navItems.find((item) => item.page === activeNavPage)?.label ?? 'Admin';

  function navigate(page: Page) {
    onNavigate(page);
    setMenuOpen(false);
  }

  return (
    <div className="admin-layout">
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="admin-mobile-bar">
          <button className="sidebar-toggle" onClick={() => setMenuOpen((open) => !open)} type="button" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'}>
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <div>
            <span>{t('mechanicDirectory')}</span>
            <strong>{activeLabel}</strong>
          </div>
        </div>
        <h2>{t('mechanicDirectory')}</h2>
        <div className="sidebar-menu">
          {navItems.map((item) => <button className={activeNavPage === item.page ? 'active' : ''} key={item.page} onClick={() => navigate(item.page)}>{item.label}</button>)}
          <button className="logout" onClick={onLogout}>Logout</button>
        </div>
      </aside>
      <main className="admin-content">{children}</main>
    </div>
  );
}

// Jobs count as "assigned" once a technician holds them (assigned → accepted → completed); open/cancelled/declined don't.
function isAssignedJob(job: Job) {
  return job.status === 'assigned' || job.status === 'reassigned' || job.status === 'accepted' || job.status === 'completed';
}

function AdminDashboard({ active, inactive, jobs, mechanics, pending, total }: { active: number; inactive: number; jobs: Job[]; mechanics: Mechanic[]; pending: number; total: number }) {
  const assignedJobs = jobs.filter(isAssignedJob).length;
  const openJobs = jobs.filter((job) => job.status === 'open').length;
  const assignmentRate = jobs.length ? Math.round((assignedJobs / jobs.length) * 100) : 0;
  const recentJobs = jobs.slice(0, 5);
  const topMechanics = mechanics
    .map((mechanic) => ({ mechanic, count: jobs.filter((job) => job.technicianId === mechanic.id && isAssignedJob(job)).length }))
    .filter((item) => item.count > 0)
    .sort((first, second) => second.count - first.count)
    .slice(0, 4);

  return (
    <section className="admin-dashboard-page">
      <div className="admin-dashboard-hero">
        <div>
          <p className="eyebrow">Operations overview</p>
          <h1>Admin Dashboard</h1>
          <p>Track mechanics, jobs, and assignments from one place.</p>
        </div>
        <div className="dashboard-rate-card">
          <span>{assignmentRate}%</span>
          <p>Jobs assigned</p>
        </div>
      </div>

      <section className="dashboard-metrics-grid">
        <Metric label="Total Mechanics" value={total} />
        <Metric label="Pending Approval" value={pending} />
        <Metric label="Active" value={active} />
        <Metric label="Inactive / Rejected" value={inactive} />
        <Metric label="Total jobs" value={jobs.length} />
        <Metric label="Open jobs" value={openJobs} />
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
            {recentJobs.map((job) => {
              const meta = jobStatusMeta(job.status);
              return (
                <div className="recent-job-item" key={job.id}>
                  <div>
                    <strong>{job.jobCode || job.farmerName || '-'}</strong>
                    <p>{job.equipment ? `${job.equipment} - ${job.issue}` : job.description}</p>
                  </div>
                  <span className={`pill ${meta.pillClass}`}>{meta.label}</span>
                </div>
              );
            })}
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
            {topMechanics.map(({ count, mechanic }) => (
              <div className="mechanic-load-item" key={mechanic.id}>
                <div className="load-avatar">{getInitials(mechanic.fullName)}</div>
                <div>
                  <strong>{mechanic.fullName}</strong>
                  <p>{mechanic.district || '-'} · {mechanic.experience || '0'} yrs</p>
                </div>
                <span>{count}</span>
              </div>
            ))}
            {topMechanics.length === 0 && <p className="empty compact-empty">No assigned jobs yet.</p>}
          </div>
        </article>
      </section>
    </section>
  );
}

function MechanicsTable({ mechanics, onApprove, onEdit, onReject, onRefresh, onToggleStatus, onView }: { mechanics: Mechanic[]; onApprove: (mechanic: Mechanic) => void; onEdit: (mechanic: Mechanic) => void; onReject: (mechanic: Mechanic) => void; onRefresh: () => Promise<void>; onToggleStatus: (mechanic: Mechanic) => void; onView: (mechanic: Mechanic) => void }) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();

  const filtered = useMemo(() => mechanics.filter((mechanic) => {
    if (!query) return true;
    const searchText = [
      mechanic.fullName,
      mechanic.phoneNumber,
      mechanic.village,
      mechanic.district,
      mechanic.state,
      mechanic.pincode,
      mechanic.status,
      mechanic.experience,
      mechanic.age,
    ].join(' ').toLowerCase();
    return searchText.includes(query);
  }), [mechanics, query]);

  return (
    <PullToRefresh onRefresh={onRefresh}>
    <section>
      <div className="section-heading"><h1>Mechanics</h1><button className="secondary refresh-button" onClick={() => void onRefresh()}>Refresh</button></div>
      <div className="card filters">
        <div className="search-field">
          <Input label="Search mechanics" onChange={setSearch} value={search} />
          <Search size={18} aria-hidden="true" />
        </div>
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
    </PullToRefresh>
  );
}

function DetailPage({ editable, mechanic, onBack, onEdit, onRequestChange, title }: { editable: boolean; mechanic: Mechanic; onBack: () => void; onEdit?: () => void; onRequestChange?: () => void; title: string }) {
  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button back-button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Back</button>
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
        <button className="text-button back-button" onClick={onBack} type="button"><ArrowLeft size={18} aria-hidden="true" />Back</button>
        <h1>Edit Profile</h1>
        <MechanicFields errors={errors} form={form} onChange={updateField} />
        <button className="primary" type="submit">Save Changes</button>
      </form>
    </main>
  );
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
        age: 'Age',
        experience: 'Years of Experience',
      };

  return (
    <fieldset className="form-grid fields-grid" disabled={disabled}>
      <Input error={errors.fullName} label={labels.fullName} autoComplete="name" name="fullName" onChange={(value) => onChange('fullName', value)} value={form.fullName} />
      <StateSelect error={errors.state} label={labels.state} onChange={(value) => onChange('state', value)} value={form.state} />
      <Input label={labels.district} error={errors.district} autoComplete="address-level2" name="district" onChange={(value) => onChange('district', value)} value={form.district} />
      <Input label={labels.village} error={errors.village} autoComplete="address-level3" name="village" onChange={(value) => onChange('village', value)} value={form.village} />
      <Input label={labels.address} autoComplete="street-address" name="address" onChange={(value) => onChange('address', value)} value={form.address} />
      <Input label={labels.pincode} error={errors.pincode} autoComplete="postal-code" name="pincode" onChange={(value) => onChange('pincode', value)} value={form.pincode} />
      <Input error={errors.age} label={labels.age} autoComplete="off" name="age" onChange={(value) => onChange('age', value)} value={form.age} />
      <Input label={labels.experience} error={errors.experience} autoComplete="off" name="experience" onChange={(value) => onChange('experience', value)} value={form.experience} />
    </fieldset>
  );
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

  return (
    <div className="field state-select">
      <label htmlFor={inputId}>{label}</label>
      <input autoComplete="off" className={error ? 'invalid' : ''} id={inputId} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => updateSearch(event.target.value)} onFocus={() => setOpen(true)} placeholder={t('searchSelectState')} value={search} />
      {open && (
        <div className="state-options">
          {filteredStates.length > 0
            ? filteredStates.map((state) => <button key={state} onMouseDown={(event) => event.preventDefault()} onClick={() => selectState(state)} type="button">{state}</button>)
            : <span>{t('noStateFound')}</span>}
        </div>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}

function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const rows = [
    ['Phone Number', mechanic.phoneNumber], ['Village', mechanic.village], ['District', mechanic.district],
    ['State', mechanic.state], ['Pincode', mechanic.pincode], ['Address', mechanic.address],
    ['Age', mechanic.age], ['Experience', `${mechanic.experience || '0'} years`], ['Status', mechanic.status],
    ['Jobs', `Pending ${mechanic.jobStats.pending} · Completed ${mechanic.jobStats.completed} · Cancelled ${mechanic.jobStats.cancelled} · Deleted ${mechanic.jobStats.deleted}`],
    ['Registration Date', formatDate(mechanic.createdAt)],
  ];
  return <dl className={compact ? 'detail-grid compact' : 'detail-grid'}>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>;
}

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
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
