import type { ReactNode } from 'react';

// Admin has exactly one pre-auth screen, so unlike the mechanic app's
// AuthLayout this has no back button (nothing to go back to) and no
// language selector (admin UI stays English-only — see MechanicFields.tsx).
export function AdminLoginLayout({ children, title }: { children: ReactNode; title: string }) {
  return (
    <main className="auth-page admin-login-page">
      <section className="auth-card card">
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}
