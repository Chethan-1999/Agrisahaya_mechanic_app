import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';

import { PullToRefresh } from '../components/PullToRefresh';
import { ConfirmModal, getErrorMessage, type ConfirmDialog } from '../components/ui';
import { auth } from '../firebase';
import { useLoadingState } from '../hooks/useLoadingState';
import { useI18n } from '../i18n/I18nContext';
import { listAnnouncements } from '../services/announcements';
import { dataErrorKey } from '../services/dataErrors';
import { getMechanic, updateDeviceInfo } from '../services/mechanics';
import { initNotifications } from '../services/notifications';
import type { Mechanic } from '../types';
import { withTimeout } from '../utils/withTimeout';
import { AuthLayout } from './screens/AuthLayout';
import { Community } from './screens/Community';
import { Landing } from './screens/Landing';
import { MarketplaceComingSoon } from './screens/MarketplaceComingSoon';
import { MechanicAuth } from './screens/MechanicAuth';
import { MechanicPending } from './screens/MechanicPending';
import { MechanicProfile } from './screens/MechanicProfile';
import { isMechanicTabPage, MechanicShell } from './screens/MechanicShell';
import { ReapplyForm } from './screens/ReapplyForm';
import { RequestProfileChange } from './screens/RequestProfileChange';
import { TechnicianJobs } from './screens/TechnicianJobs';

export type MechanicPage =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicPending'
  | 'mechanicReapply'
  | 'mechanicMarketplace'
  | 'mechanicProfile'
  | 'mechanicJobs'
  | 'mechanicRequestChange'
  | 'mechanicCommunity';

type MechanicSession = { mechanicId: string } | null;

// Where the Android hardware/gesture back button goes from each page; pages not listed are roots (back exits the app).
const backTarget: Partial<Record<MechanicPage, MechanicPage>> = {
  mechanicReapply: 'mechanicPending',
  mechanicAuth: 'landing',
  mechanicProfile: 'mechanicJobs',
  mechanicMarketplace: 'mechanicJobs',
  mechanicCommunity: 'mechanicJobs',
  mechanicRequestChange: 'mechanicProfile',
};

const announcementsSeenKey = (technicianId: string) => `agrisahaya.announcementsSeenAt.${technicianId}`;

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

export default function MechanicApp() {
  const [page, setPage] = useState<MechanicPage>('landing');
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [session, setSession] = useState<MechanicSession>(null);
  const [currentMechanic, setCurrentMechanic] = useState<Mechanic | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [unreadAnnouncements, setUnreadAnnouncements] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const { t } = useI18n();
  const { loading, toast, setToast, withLoading } = useLoadingState((error) => {
    const key = dataErrorKey(error);
    return key ? t(key) : getErrorMessage(error);
  });

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
  }, [toast, setToast]);

  // Reveals a persisted Firebase session's data — looks up technicians/{uid} and sets session+page accordingly.
  async function revealSession(user: User): Promise<boolean> {
    const technician = await getMechanic(user.uid);

    if (technician) {
      setSession({ mechanicId: user.uid });
      setPage(technician.status === 'active' ? 'mechanicJobs' : 'mechanicPending');
      return true;
    }

    return false;
  }

  // Restores a persisted Firebase session on load/refresh instead of
  // dropping the user back to the landing page every time — the app opens
  // straight to the jobs screen with no login prompt whenever a session is
  // already there.
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
    if (session) {
      void loadCurrentMechanic(session.mechanicId);
      void initNotifications(updateDeviceInfo);
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
    if (!session || currentMechanic?.status !== 'active') return;

    if (page === 'mechanicCommunity') {
      writeAnnouncementsSeenAt(session.mechanicId, new Date().toISOString());
      setUnreadAnnouncements(0);
    } else {
      void refreshUnreadAnnouncements(session.mechanicId);
    }
  }, [page, session, currentMechanic?.status]);

  // The pending/inactive screen has no other trigger to notice an admin's decision, so poll quietly.
  useEffect(() => {
    if (!session || page !== 'mechanicPending') return;

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

  async function loadCurrentMechanic(id: string) {
    await withLoading(async () => setCurrentMechanic(await getMechanic(id)));
  }

  function logout() {
    setConfirmDialog({
      title: 'Logout?',
      message: t('logoutConfirm'),
      confirmLabel: t('logout'),
      kind: 'danger',
      onConfirm: () => {
        void signOut(auth);
        setSession(null);
        setCurrentMechanic(null);
        setPage('landing');
      },
    });
  }

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
              setSession({ mechanicId });
              setPage(technician.status === 'active' ? 'mechanicJobs' : 'mechanicPending');
            }}
            onNew={(mechanicId) => {
              setToast({
                kind: 'success',
                text: 'Registered — you will be notified once an admin verifies your account.',
              });
              setSession({ mechanicId });
              setPage('mechanicPending');
            }}
            setToast={setToast}
            withLoading={withLoading}
          />
        </AuthLayout>
      )}

      {session && page === 'mechanicPending' && (
        <PullToRefresh onRefresh={async () => {
          const technician = await getMechanic(session.mechanicId);
          if (!technician) return;
          setCurrentMechanic(technician);
          if (technician.status === 'active') setPage('mechanicJobs');
        }}>
          <MechanicPending mechanic={currentMechanic} onLogout={logout} onReapply={() => setPage('mechanicReapply')} />
        </PullToRefresh>
      )}

      {session && currentMechanic && page === 'mechanicReapply' && (
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

      {session && currentMechanic && isMechanicTabPage(page) && (
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

      {session && currentMechanic && page === 'mechanicRequestChange' && (
        <RequestProfileChange
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicProfile')}
          onSubmitted={() => setPage('mechanicProfile')}
          setToast={setToast}
          withLoading={withLoading}
        />
      )}
    </div>
  );
}
