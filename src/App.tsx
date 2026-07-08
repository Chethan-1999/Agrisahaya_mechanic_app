import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { firebaseConfigured } from './firebase';
import { loginAdmin, logoutAdmin } from './services/adminAuth';
import { createMechanic, deleteMechanic, findMechanicByPhone, getMechanic, listMechanics, updateMechanic } from './services/mechanics';
import { canVerifyOtp, createOtpCode } from './services/otp';
import type { AdminProfile, AppSession, Mechanic, MechanicForm } from './types';
import { emptyMechanicForm } from './types';
import { hasErrors, isValidPhone, validateMechanicForm, type ValidationErrors } from './utils/validation';

type Page =
  | 'landing'
  | 'mechanicAuth'
  | 'mechanicDashboard'
  | 'mechanicProfile'
  | 'mechanicEdit'
  | 'adminLogin'
  | 'adminDashboard'
  | 'adminMechanics'
  | 'adminSettings'
  | 'adminDetails'
  | 'adminEdit';

type Toast = { kind: 'success' | 'error'; text: string } | null;

const navItems: Array<{ label: string; page: Page }> = [
  { label: 'Dashboard', page: 'adminDashboard' },
  { label: 'Mechanics', page: 'adminMechanics' },
  { label: 'Settings', page: 'adminSettings' },
];

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [session, setSession] = useState<AppSession>(null);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [currentMechanic, setCurrentMechanic] = useState<Mechanic | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;

    const timeoutId = window.setTimeout(() => setToast(null), 3500);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    if (session?.role === 'mechanic') {
      void loadCurrentMechanic(session.mechanicId);
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
    const roleLabel = session?.role === 'admin' ? 'admin' : 'mechanic';

    if (!confirm(`Logout from ${roleLabel} account?`)) {
      return;
    }

    if (session?.role === 'admin') {
      void logoutAdmin();
    }
    setSession(null);
    setCurrentMechanic(null);
    setSelectedMechanic(null);
    setPage('landing');
  }

  const activeMechanics = mechanics.filter((mechanic) => mechanic.isActive).length;
  const inactiveMechanics = mechanics.length - activeMechanics;

  return (
    <div className="app-shell">
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
        <AuthLayout onBack={() => setPage('landing')} title="Mechanic Access">
          <div className="tabs">
            <button className={tab === 'login' ? 'active' : ''} onClick={() => setTab('login')}>Login</button>
            <button className={tab === 'signup' ? 'active' : ''} onClick={() => setTab('signup')}>Sign Up</button>
          </div>
          {tab === 'login' ? (
            <MechanicLogin
              onLogin={(mechanicId) => {
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicDashboard');
              }}
              setToast={setToast}
              withLoading={withLoading}
            />
          ) : (
            <MechanicSignup
              onRegistered={(mechanicId) => {
                setToast({ kind: 'success', text: 'Registration Successful' });
                setSession({ role: 'mechanic', mechanicId });
                setPage('mechanicDashboard');
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

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicDashboard' && (
        <MechanicDashboard mechanic={currentMechanic} onEdit={() => setPage('mechanicEdit')} onLogout={logout} onProfile={() => setPage('mechanicProfile')} />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicProfile' && (
        <DetailPage mechanic={currentMechanic} onBack={() => setPage('mechanicDashboard')} onEdit={() => setPage('mechanicEdit')} title="My Profile" />
      )}

      {session?.role === 'mechanic' && currentMechanic && page === 'mechanicEdit' && (
        <EditMechanic
          mechanic={currentMechanic}
          onBack={() => setPage('mechanicDashboard')}
          onSaved={async () => {
            await loadCurrentMechanic(currentMechanic.id);
            setPage('mechanicDashboard');
          }}
          setToast={setToast}
          withLoading={withLoading}
        />
      )}

      {session?.role === 'admin' && page.startsWith('admin') && (
        <AdminShell activePage={page} darkMode={darkMode} onLogout={logout} onNavigate={setPage} onToggleDarkMode={setDarkMode}>
          {page === 'adminDashboard' && <AdminDashboard active={activeMechanics} inactive={inactiveMechanics} total={mechanics.length} />}
          {page === 'adminMechanics' && (
            <MechanicsTable
              mechanics={mechanics}
              onDelete={(mechanic) => {
                if (!confirm(`Delete ${mechanic.fullName}?`)) return;
                void withLoading(async () => {
                  await deleteMechanic(mechanic.id);
                  setToast({ kind: 'success', text: 'Mechanic deleted successfully' });
                  setMechanics(await listMechanics());
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
          {page === 'adminSettings' && <Settings darkMode={darkMode} onToggleDarkMode={setDarkMode} />}
          {page === 'adminDetails' && selectedMechanic && (
            <DetailPage mechanic={selectedMechanic} onBack={() => setPage('adminMechanics')} onEdit={() => setPage('adminEdit')} title="Mechanic Details" />
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
  );
}

function Landing({ darkMode, onAdmin, onMechanicLogin, onMechanicSignup, onToggleDarkMode }: { darkMode: boolean; onAdmin: () => void; onMechanicLogin: () => void; onMechanicSignup: () => void; onToggleDarkMode: (value: boolean) => void }) {
  return (
    <main className="landing-page">
      <div className="top-actions">
        <button className="admin-link" onClick={onAdmin}>Admin Login</button>
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
        <p>Maintain a clean, centralized database of mechanics, profiles, and admin-managed records.</p>
        <div className="hero-actions">
          <button className="primary large" onClick={onMechanicLogin}>Mechanic Login</button>
          <button className="secondary large" onClick={onMechanicSignup}>Mechanic Sign Up</button>
        </div>
        <span className="status-dot">{firebaseConfigured ? 'Firebase connected' : 'Firebase not configured'}</span>
      </section>
    </main>
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

function MechanicLogin({ onLogin, setToast, withLoading }: { onLogin: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState<string | null>(null);

  function sendOtp() {
    if (!isValidPhone(phoneNumber)) {
      setToast({ kind: 'error', text: 'Enter a valid 10 digit phone number.' });
      return;
    }
    const code = createOtpCode();
    setSentOtp(code);
    setToast({ kind: 'success', text: `Development OTP: ${code}` });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canVerifyOtp(sentOtp, otp)) {
      setToast({ kind: 'error', text: 'OTP verification required.' });
      return;
    }
    await withLoading(async () => {
      const mechanic = await findMechanicByPhone(phoneNumber.trim());
      if (!mechanic) throw new Error('No mechanic profile found. Please sign up first.');
      onLogin(mechanic.id);
    });
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input label="Mobile Number" onChange={setPhoneNumber} value={phoneNumber} />
      <div className="otp-row"><Input label="OTP" onChange={setOtp} value={otp} /><button className="secondary" onClick={sendOtp} type="button">Send OTP</button></div>
      <button className="primary" type="submit">Login</button>
    </form>
  );
}

function MechanicSignup({ onRegistered, setToast, withLoading }: { onRegistered: (mechanicId: string) => void; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const [form, setForm] = useState<MechanicForm>(emptyMechanicForm);
  const [otp, setOtp] = useState('');
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function sendOtp() {
    if (!isValidPhone(form.phoneNumber)) {
      setErrors({ phoneNumber: 'Enter a 10 digit phone number' });
      return;
    }
    const code = createOtpCode();
    setSentOtp(code);
    setOtpVerified(false);
    setToast({ kind: 'success', text: `Development OTP: ${code}` });
  }

  function verifyOtp() {
    const verified = canVerifyOtp(sentOtp, otp);
    setOtpVerified(verified);
    setToast({ kind: verified ? 'success' : 'error', text: verified ? 'OTP verified. Complete registration.' : 'Invalid OTP.' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateMechanicForm(form, otpVerified);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      const existing = await findMechanicByPhone(form.phoneNumber.trim());
      if (existing) throw new Error('A mechanic profile already exists for this phone number.');
      onRegistered(await createMechanic(trimMechanicForm(form)));
    });
  }

  return (
    <form className="form-grid" onSubmit={(event) => void submit(event)}>
      <Input error={errors.phoneNumber} label="Mobile Number" onChange={(value) => updateField('phoneNumber', value)} value={form.phoneNumber} />
      <div className="otp-row"><Input error={errors.otp} label="OTP Verification" onChange={setOtp} value={otp} /><button className="secondary" onClick={sendOtp} type="button">Send OTP</button><button className="secondary" onClick={verifyOtp} type="button">Verify</button></div>
      <p className={otpVerified ? 'success-text' : 'muted'}>{otpVerified ? 'OTP verified. Remaining fields enabled.' : 'Verify OTP to enable the registration fields.'}</p>
      <MechanicFields disabled={!otpVerified} errors={errors} form={form} onChange={updateField} />
      <button className="primary" type="submit">Submit</button>
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

function MechanicDashboard({ mechanic, onEdit, onLogout, onProfile }: { mechanic: Mechanic; onEdit: () => void; onLogout: () => void; onProfile: () => void }) {
  return (
    <main className="dashboard-page mechanic-page">
      <section className="card profile-card">
        <p className="eyebrow">Welcome</p>
        <h1>{mechanic.fullName}</h1>
        <div className="soon-box">New feature coming soon</div>
        <DetailGrid mechanic={mechanic} compact />
        <div className="button-row"><button className="secondary" onClick={onProfile}>Profile</button><button className="primary" onClick={onEdit}>Edit Profile</button><button className="danger" onClick={onLogout}>Logout</button></div>
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

function AdminDashboard({ active, inactive, total }: { active: number; inactive: number; total: number }) {
  return (
    <>
      <h1>Admin Dashboard</h1>
      <section className="metrics">
        <Metric label="Total Mechanics" value={total} />
        <Metric label="Active Mechanics" value={active} />
        <Metric label="Inactive Mechanics" value={inactive} />
      </section>
    </>
  );
}

function MechanicsTable({ mechanics, onDelete, onEdit, onRefresh, onView }: { mechanics: Mechanic[]; onDelete: (mechanic: Mechanic) => void; onEdit: (mechanic: Mechanic) => void; onRefresh: () => Promise<void>; onView: (mechanic: Mechanic) => void }) {
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
      <div className="section-heading"><h1>Mechanics</h1><button className="secondary" onClick={() => void onRefresh()}>Refresh</button></div>
      <div className="card filters"><Input label="Search" onChange={setSearch} value={search} /><Input label="District" onChange={setDistrict} value={district} /><Input label="Village" onChange={setVillage} value={village} /><Select label="Availability" onChange={setStatus} options={[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']]} value={status} /></div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Name</th><th>Phone Number</th><th>Village</th><th>District</th><th>Experience</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.map((mechanic) => (
              <tr key={mechanic.id}>
                <td>{mechanic.fullName}</td><td>{mechanic.phoneNumber}</td><td>{mechanic.village}</td><td>{mechanic.district}</td><td>{mechanic.experience}</td><td><span className={`pill ${mechanic.isActive ? 'active' : 'inactive'}`}>{mechanic.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="actions"><button onClick={() => onView(mechanic)}>View</button><button onClick={() => onEdit(mechanic)}>Edit</button><button className="danger-text" onClick={() => onDelete(mechanic)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="empty">No mechanics found.</p>}
      </div>
    </section>
  );
}

function DetailPage({ mechanic, onBack, onEdit, title }: { mechanic: Mechanic; onBack: () => void; onEdit: () => void; title: string }) {
  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button" onClick={onBack}>Back</button>
        <h1>{title}</h1>
        <h2>{mechanic.fullName}</h2>
        <DetailGrid mechanic={mechanic} />
        <button className="primary" onClick={onEdit}>Edit Profile</button>
      </section>
    </main>
  );
}

function EditMechanic({ adminMode = false, mechanic, onBack, onSaved, setToast, withLoading }: { adminMode?: boolean; mechanic: Mechanic; onBack: () => void; onSaved: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const [form, setForm] = useState<MechanicForm>(toMechanicForm(mechanic));
  const [isActive, setIsActive] = useState(mechanic.isActive);
  const [errors, setErrors] = useState<ValidationErrors>({});

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateMechanicForm(form, true);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;
    await withLoading(async () => {
      await updateMechanic(mechanic.id, { ...trimMechanicForm(form), isActive });
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
        {adminMode && <label className="checkbox-row"><input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" /> Active Mechanic</label>}
        <button className="primary" type="submit">Save Changes</button>
      </form>
    </main>
  );
}

function Settings({ darkMode, onToggleDarkMode }: { darkMode: boolean; onToggleDarkMode: (value: boolean) => void }) {
  return <section className="card settings-card"><h1>Settings</h1><label className="checkbox-row"><input checked={darkMode} onChange={(event) => onToggleDarkMode(event.target.checked)} type="checkbox" /> Enable dark mode</label></section>;
}

function MechanicFields({ disabled = false, errors = {}, form, onChange }: { disabled?: boolean; errors?: ValidationErrors; form: MechanicForm; onChange: (key: keyof MechanicForm, value: string) => void }) {
  return (
    <fieldset className="form-grid fields-grid" disabled={disabled}>
      <Input error={errors.fullName} label="Full Name" onChange={(value) => onChange('fullName', value)} value={form.fullName} />
      <Input label="Village" error={errors.village} onChange={(value) => onChange('village', value)} value={form.village} />
      <Input label="District" error={errors.district} onChange={(value) => onChange('district', value)} value={form.district} />
      <Input label="State" onChange={(value) => onChange('state', value)} value={form.state} />
      <Input label="Pincode" onChange={(value) => onChange('pincode', value)} value={form.pincode} />
      <Input label="Address" onChange={(value) => onChange('address', value)} value={form.address} />
      <Input label="Age" onChange={(value) => onChange('age', value)} value={form.age} />
      <Input label="Years of Experience" error={errors.experience} onChange={(value) => onChange('experience', value)} value={form.experience} />
    </fieldset>
  );
}

function Input({ error, label, onChange, type = 'text', value }: { error?: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="field"><span>{label}</span><input className={error ? 'invalid' : ''} onChange={(event) => onChange(event.target.value)} type={type} value={value} />{error && <small>{error}</small>}</label>;
}

function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return <label className="field"><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function DetailGrid({ compact = false, mechanic }: { compact?: boolean; mechanic: Mechanic }) {
  const rows = [
    ['Phone Number', mechanic.phoneNumber], ['Village', mechanic.village], ['District', mechanic.district],
    ['State', mechanic.state], ['Pincode', mechanic.pincode], ['Address', mechanic.address], ['Age', mechanic.age],
    ['Experience', `${mechanic.experience || '0'} years`], ['Registration Date', formatDate(mechanic.createdAt)],
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
    age: mechanic.age,
    experience: mechanic.experience,
  };
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
