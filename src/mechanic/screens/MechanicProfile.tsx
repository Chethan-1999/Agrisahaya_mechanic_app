import { useEffect, useState, type FormEvent } from 'react';
import { WalletCards } from 'lucide-react';

import { PullToRefresh } from '../../components/PullToRefresh';
import type { Toast } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { updateOwnProfile } from '../../services/mechanics';
import { DetailGrid } from '../../shared/DetailGrid';
import { MechanicFields } from '../../shared/MechanicFields';
import { getInitials } from '../../shared/formatting';
import { toMechanicForm, trimMechanicForm } from '../../shared/mechanicForm';
import type { Mechanic } from '../../types';
import { hasErrors, validateProfileForm, type ValidationErrors } from '../../utils/validation';

export function MechanicProfile({ mechanic, onLogout, onRefresh, setToast, withLoading }: { mechanic: Mechanic; onLogout: () => void; onRefresh: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => toMechanicForm(mechanic));
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    setForm(toMechanicForm(mechanic));
    setErrors({});
  }, [mechanic]);

  function updateField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function cancelEdit() {
    setEditing(false);
    setForm(toMechanicForm(mechanic));
    setErrors({});
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const { phoneNumber: _phoneNumber, ...profile } = trimMechanicForm(form);
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await updateOwnProfile(profile);
      await onRefresh();
      setEditing(false);
      setToast({ kind: 'success', text: 'Profile updated successfully.' });
    });
  }

  return (
    <PullToRefresh onRefresh={onRefresh}>
      <section className="mechanic-profile-screen">
        <div className="mechanic-profile-hero">
          <div className="profile-avatar">{getInitials(mechanic.fullName)}</div>
          <p className="eyebrow">{t('welcome')}</p>
          <h1>{mechanic.fullName}</h1>
          <div className="profile-wallet-card">
            <span><WalletCards size={20} strokeWidth={2.6} /></span>
            <div>
              <small>Wallet</small>
              <strong>100 points</strong>
            </div>
          </div>
        </div>
        <section className="profile-details-card">
          <div className="profile-details-heading">
            <h2>{t('profileNav')}</h2>
            {!editing && <button className="secondary compact-profile-button" onClick={() => setEditing(true)} type="button">Edit profile</button>}
          </div>
          {editing ? (
            <form className="form-grid" onSubmit={(event) => void saveProfile(event)}>
              <MechanicFields errors={errors} form={form} onChange={updateField} translated />
              <div className="button-row">
                <button className="primary" type="submit">Save profile</button>
                <button className="secondary" onClick={cancelEdit} type="button">Cancel</button>
              </div>
            </form>
          ) : <DetailGrid mechanic={mechanic} compact />}
        </section>
        <button className="secondary profile-logout-button" onClick={onLogout} type="button">{t('logout')}</button>
      </section>
    </PullToRefresh>
  );
}
