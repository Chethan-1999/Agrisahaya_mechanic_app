import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input, Textarea, type Toast } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import { listOwnProfileUpdateRequests, submitProfileUpdate } from '../../services/profileUpdates';
import type { Mechanic, MechanicForm } from '../../types';
import { PROFILE_UPDATE_LIFETIME_CAP_DISPLAY } from '../../types';
import { hasErrors, validateProfileForm, type ValidationErrors } from '../../utils/validation';

type EditableKey = Exclude<keyof MechanicForm, 'phoneNumber'>;
type EditableForm = Omit<MechanicForm, 'phoneNumber'>;

export function RequestProfileChange({ mechanic, onBack, onSubmitted, setToast, withLoading }: {
  mechanic: Mechanic;
  onBack: () => void;
  onSubmitted: () => void;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<EditableForm>({
    fullName: mechanic.fullName,
    village: mechanic.village,
    district: mechanic.district,
    state: mechanic.state,
    pincode: mechanic.pincode,
    address: mechanic.address,
    landmark: mechanic.landmark,
    age: mechanic.age,
    experience: mechanic.experience,
  });
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [usedCount, setUsedCount] = useState<number | null>(null);

  useEffect(() => {
    void listOwnProfileUpdateRequests(mechanic.id).then((requests) => setUsedCount(requests.length));
  }, [mechanic.id]);

  const capReached = usedCount !== null && usedCount >= PROFILE_UPDATE_LIFETIME_CAP_DISPLAY;

  function updateField(key: EditableKey, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (capReached) return;

    const nextErrors = validateProfileForm(form);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    if (!message.trim()) {
      setToast({ kind: 'error', text: t('giveReasonError') });
      return;
    }

    const changes: Partial<MechanicForm> = {};
    (Object.keys(form) as EditableKey[]).forEach((key) => {
      const nextValue = form[key].trim();
      if (nextValue !== mechanic[key]) {
        changes[key] = nextValue;
      }
    });

    if (Object.keys(changes).length === 0) {
      setToast({ kind: 'error', text: t('changeAtLeastOneError') });
      return;
    }

    await withLoading(async () => {
      await submitProfileUpdate(changes, message.trim());
      setToast({ kind: 'success', text: t('requestSubmittedToast') });
      onSubmitted();
    });
  }

  return (
    <main className="detail-page mechanic-form-page">
      <section className="card form-grid edit-card">
        <button className="text-button back-button" onClick={onBack} type="button"><ArrowLeft size={18} aria-hidden="true" />{t('back')}</button>
        <h1>{t('requestChangeTitle')}</h1>
        <p className="muted">{t('requestChangeHint')}</p>
        {usedCount !== null && (
          <p className="muted">
            {t('changesUsedLabel')}: {usedCount}/{PROFILE_UPDATE_LIFETIME_CAP_DISPLAY}
          </p>
        )}
        {capReached && <p className="muted error">{t('changesCapReachedError')}</p>}
        <Input error={errors.fullName} label={t('fullName')} onChange={(value) => updateField('fullName', value)} value={form.fullName} />
        <Input error={errors.village} label={t('village')} onChange={(value) => updateField('village', value)} value={form.village} />
        <Input error={errors.district} label={t('district')} onChange={(value) => updateField('district', value)} value={form.district} />
        <Input error={errors.state} label={t('state')} onChange={(value) => updateField('state', value)} value={form.state} />
        <Input error={errors.pincode} label={t('pincode')} onChange={(value) => updateField('pincode', value)} value={form.pincode} />
        <Input label={t('address')} onChange={(value) => updateField('address', value)} value={form.address} />
        <Input error={errors.age} label={t('age')} onChange={(value) => updateField('age', value)} value={form.age} />
        <Input error={errors.experience} label={t('experience')} onChange={(value) => updateField('experience', value)} value={form.experience} />
        <Textarea label={t('reasonForChange')} onChange={setMessage} value={message} />
        <button className="primary" disabled={capReached} onClick={() => void submit()} type="button">
          {t('submitRequestButton')}
        </button>
      </section>
    </main>
  );
}
