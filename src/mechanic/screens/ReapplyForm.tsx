import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import type { Toast } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { reapplySignup } from '../../services/auth';
import { MechanicFields } from '../../shared/MechanicFields';
import { toMechanicForm, trimMechanicForm } from '../../shared/mechanicForm';
import type { Mechanic, MechanicForm } from '../../types';
import { clearReapplyDraft, loadReapplyDraft, saveReapplyDraft } from '../../utils/signupDraft';
import { hasErrors, validateProfileForm, type ValidationErrors } from '../../utils/validation';
import { withTimeout } from '../../utils/withTimeout';

/** A rejected technician corrects their details and sends the signup to the admin again — as many times as needed. */
export function ReapplyForm({ mechanic, onBack, onSubmitted, setToast, withLoading }: { mechanic: Mechanic; onBack: () => void; onSubmitted: () => Promise<void>; setToast: (toast: Toast) => void; withLoading: (action: () => Promise<void>) => Promise<void> }) {
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
    <main className="detail-page mechanic-form-page">
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
