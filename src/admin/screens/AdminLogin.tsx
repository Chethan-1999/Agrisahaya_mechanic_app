import { useState, type FormEvent } from 'react';

import { Input } from '../../components/ui';
import { loginAdmin } from '../../services/adminAuth';
import type { AdminProfile } from '../../types';

export function AdminLogin({ onLogin, withLoading }: { onLogin: (admin: AdminProfile) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
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
      <button className="primary" type="submit">Admin Login</button>
      <p className="muted">This login is only for Agrisahay admin.</p>
    </form>
  );
}
