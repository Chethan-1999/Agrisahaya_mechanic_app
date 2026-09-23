import { Menu, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { useI18n } from '../../i18n/I18nContext';
import type { AdminPage } from '../AdminApp';

const navItems: Array<{ label: string; page: AdminPage }> = [
  { label: 'Dashboard', page: 'adminDashboard' },
  { label: 'Mechanics', page: 'adminMechanics' },
  { label: 'Add new jobs', page: 'adminAddJobs' },
  { label: 'Assign jobs', page: 'adminAssignJobs' },
  { label: 'Community', page: 'adminCommunity' },
  { label: 'Profile change request', page: 'adminProfileRequests' },
];

export function AdminShell({ activePage, children, onLogout, onNavigate }: { activePage: AdminPage; children: ReactNode; onLogout: () => void; onNavigate: (page: AdminPage) => void }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const activeNavPage = activePage === 'adminDetails' || activePage === 'adminEdit' ? 'adminMechanics' : activePage;
  const activeLabel = navItems.find((item) => item.page === activeNavPage)?.label ?? 'Admin';

  function navigate(page: AdminPage) {
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
