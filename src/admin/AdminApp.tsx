import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { ConfirmModal, type ConfirmDialog } from '../components/ui';
import { auth, db } from '../firebase';
import { useLoadingState } from '../hooks/useLoadingState';
import { logoutAdmin, registerAdminDevice } from '../services/adminAuth';
import { listAllJobs, visibleJobs, withJob } from '../services/jobs';
import { listMechanics, reviewSignup, setTechnicianStatus } from '../services/mechanics';
import { initNotifications } from '../services/notifications';
import type { AdminProfile, Job, Mechanic } from '../types';
import { withTimeout } from '../utils/withTimeout';
import { AdminAddJobs } from './screens/AdminAddJobs';
import { AdminAssignJobs } from './screens/AdminAssignJobs';
import { AdminCommunity } from './screens/AdminCommunity';
import { AdminDashboard } from './screens/AdminDashboard';
import { AdminLogin } from './screens/AdminLogin';
import { AdminLoginLayout } from './screens/AdminLoginLayout';
import { AdminProfileRequests } from './screens/AdminProfileRequests';
import { AdminShell } from './screens/AdminShell';
import { DetailPage } from './screens/DetailPage';
import { EditMechanic } from './screens/EditMechanic';
import { MechanicsTable } from './screens/MechanicsTable';

export type AdminPage =
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminAddJobs'
  | 'adminAssignJobs'
  | 'adminCommunity'
  | 'adminProfileRequests'
  | 'adminDetails'
  | 'adminEdit';

type AdminSession = { admin: AdminProfile } | null;

// Where the Android hardware/gesture back button goes from each page; pages not listed are roots (back exits the app).
const backTarget: Partial<Record<AdminPage, AdminPage>> = {
  adminMechanics: 'adminDashboard',
  adminAddJobs: 'adminDashboard',
  adminAssignJobs: 'adminDashboard',
  adminCommunity: 'adminDashboard',
  adminProfileRequests: 'adminDashboard',
  adminDetails: 'adminMechanics',
  adminEdit: 'adminMechanics',
};

export default function AdminApp() {
  const [page, setPage] = useState<AdminPage>('adminLogin');
  const [session, setSession] = useState<AdminSession>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const { loading, toast, setToast, withLoading } = useLoadingState();

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

  // Reveals a persisted Firebase session's data — looks up admins/{uid} and sets session+page accordingly.
  async function revealSession(user: User): Promise<boolean> {
    const adminSnapshot = await getDoc(doc(db, 'admins', user.uid));

    if (adminSnapshot.exists()) {
      const data = adminSnapshot.data();
      setSession({
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

    return false;
  }

  // Restores a persisted Firebase session on load/refresh instead of
  // dropping the user back to the login screen every time — the app opens
  // straight to the dashboard with no login prompt whenever a session is
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
            setPage('adminLogin');
          }
        } catch (error) {
          console.warn('Session restore failed:', error);
          void signOut(auth);
          setSession(null);
          setPage('adminLogin');
        } finally {
          setBootstrapping(false);
        }
      })();
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (session) {
      void loadMechanics();
      void loadJobs();
      void initNotifications(registerAdminDevice);
    }
  }, [session]);

  async function loadMechanics() {
    await withLoading(async () => setMechanics(await listMechanics()));
  }

  async function loadJobs() {
    await withLoading(async () => setJobs(await listAllJobs()));
  }

  // Assign jobs needs both: a mechanic approved since this session loaded (e.g. on another device) must show up
  // in the "Assign mechanic" dropdown, not as "Unknown", without restarting the app.
  async function loadJobsAndMechanics() {
    await withLoading(async () => {
      const [nextJobs, nextMechanics] = await Promise.all([listAllJobs(), listMechanics()]);
      setJobs(nextJobs);
      setMechanics(nextMechanics);
    });
  }

  // After a job save: the spinner is already closed, the returned job goes on screen right away, and jobs + mechanics
  // (whose jobStats just moved) are re-read in the background with no spinner.
  function showSavedJob(job: Job) {
    setJobs((current) => withJob(current, job));
    void Promise.all([listAllJobs(), listMechanics()]).then(
      ([nextJobs, nextMechanics]) => {
        setJobs(nextJobs);
        setMechanics(nextMechanics);
      },
      (error: unknown) => console.warn('Background refresh failed:', error),
    );
  }

  function logout() {
    setConfirmDialog({
      title: 'Logout?',
      message: 'Logout from admin account?',
      confirmLabel: 'Logout',
      kind: 'danger',
      onConfirm: () => {
        void logoutAdmin();
        setSession(null);
        setSelectedMechanic(null);
        setPage('adminLogin');
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

      {page === 'adminLogin' && (
        <AdminLoginLayout title="Admin Login">
          <AdminLogin
            onLogin={(admin) => {
              setSession({ admin });
              setPage('adminDashboard');
            }}
            withLoading={withLoading}
          />
        </AdminLoginLayout>
      )}

      {session && page.startsWith('admin') && page !== 'adminLogin' && (
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
          {page === 'adminAddJobs' && <AdminAddJobs jobs={jobs} onJobSaved={showSavedJob} onRefresh={loadJobs} setToast={setToast} withLoading={withLoading} />}
          {page === 'adminAssignJobs' && <AdminAssignJobs askConfirm={setConfirmDialog} jobs={jobs} mechanics={mechanics} onJobSaved={showSavedJob} onRefresh={loadJobsAndMechanics} setToast={setToast} withLoading={withLoading} />}
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
