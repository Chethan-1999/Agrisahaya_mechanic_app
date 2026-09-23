import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { Toast } from '../../components/ui';
import { adminUpdateProfile } from '../../services/mechanics';
import { MechanicFields } from '../../shared/MechanicFields';
import { trimMechanicForm, toMechanicForm } from '../../shared/mechanicForm';
import type { Mechanic, MechanicForm } from '../../types';
import { hasErrors, validateProfileForm, type ValidationErrors } from '../../utils/validation';

export function EditMechanic({ mechanic, onBack, onSaved, setToast, withLoading }: { mechanic: Mechanic; onBack: () => void; onSaved: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
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
