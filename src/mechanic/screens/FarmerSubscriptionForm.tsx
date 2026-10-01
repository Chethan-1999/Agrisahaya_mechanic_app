import { ArrowLeft } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { farmerMachinery } from '../../../functions/src/shared/farmerMachinery';
import { Input } from '../../components/ui';
import { useI18n } from '../../i18n/I18nContext';
import type { StringKey } from '../../i18n/strings';
import { submitFarmerSubscription } from '../../services/farmerSubscriptions';
import { StateSelect } from '../../shared/MechanicFields';
import { emptyFarmerSubscriptionForm, type FarmerSubscriptionForm as FarmerForm } from '../../types';
import { hasErrors, validateFarmerForm, type FarmerFormErrors } from '../../utils/validation';
import { withTimeout } from '../../utils/withTimeout';

const machineryKeys: Record<string, StringKey> = {
  powerTiller: 'machPowerTiller',
  dripSystem: 'machDripSystem',
  weeder: 'machWeeder',
  rotovator: 'machRotovator',
  baler: 'machBaler',
  sprayers: 'machSprayers',
  other: 'machOther',
};

/** "Power tiller, Weeder, Other: Harvester" in the technician's language. */
export function machineryText(farmer: Pick<FarmerForm, 'machinery' | 'machineryOther'>, t: (key: StringKey) => string) {
  return farmer.machinery
    .map((code) => (code === 'other' && farmer.machineryOther ? `${t('machOther')}: ${farmer.machineryOther}` : machineryKeys[code] ? t(machineryKeys[code]) : code))
    .join(', ');
}

/** A mechanic fills in the Agrisahay subscription form for a farmer they refer; an admin verifies it before the plan starts. */
export function FarmerSubscriptionForm({ onBack, onSubmitted, withLoading }: {
  onBack: () => void;
  onSubmitted: () => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<FarmerForm>(emptyFarmerSubscriptionForm);
  const [errors, setErrors] = useState<FarmerFormErrors>({});
  const error = (field: keyof FarmerForm) => (errors[field] ? t(errors[field]) : undefined);

  function update<K extends keyof FarmerForm>(key: K, value: FarmerForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleMachine(code: string) {
    update('machinery', form.machinery.includes(code) ? form.machinery.filter((item) => item !== code) : [...form.machinery, code]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed: FarmerForm = {
      ...form,
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim(),
      village: form.village.trim(),
      mandalDistrict: form.mandalDistrict.trim(),
      pincode: form.pincode.trim(),
      state: form.state.trim(),
      machineryOther: form.machinery.includes('other') ? form.machineryOther.trim() : '',
    };
    const nextErrors = validateFarmerForm(trimmed);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await withTimeout(submitFarmerSubscription(trimmed), 'Request timed out. Check your connection, then try again.');
      onSubmitted();
    });
  }

  return (
    <main className="detail-page mechanic-form-page">
      <form className="card form-grid edit-card" onSubmit={(event) => void submit(event)}>
        <button className="text-button back-button" onClick={onBack} type="button"><ArrowLeft size={18} aria-hidden="true" />{t('back')}</button>
        <h1 className="subscription-form-title">{t('farmerFormTitle')}</h1>
        <p className="muted">{t('farmerFormHint')}</p>
        <fieldset className="form-grid fields-grid">
          <Input autoComplete="off" error={error('fullName')} label={t('farmerName')} name="farmerName" onChange={(value) => update('fullName', value)} value={form.fullName} />
          <Input
            autoComplete="off"
            error={error('phoneNumber')}
            inputMode="numeric"
            label={t('farmerPhone')}
            maxLength={10}
            name="farmerPhone"
            onChange={(value) => update('phoneNumber', value.replace(/\D/g, '').slice(0, 10))}
            pattern="[0-9]*"
            value={form.phoneNumber}
          />
          <Input autoComplete="off" error={error('village')} label={t('villageLocation')} name="village" onChange={(value) => update('village', value)} value={form.village} />
          <Input autoComplete="off" error={error('mandalDistrict')} label={t('mandalDistrict')} name="mandalDistrict" onChange={(value) => update('mandalDistrict', value)} value={form.mandalDistrict} />
          <Input
            autoComplete="off"
            error={error('pincode')}
            inputMode="numeric"
            label={t('pincode')}
            maxLength={6}
            name="pincode"
            onChange={(value) => update('pincode', value.replace(/\D/g, '').slice(0, 6))}
            pattern="[0-9]*"
            value={form.pincode}
          />
          <StateSelect error={error('state')} label={t('state')} onChange={(value) => update('state', value)} value={form.state} />
        </fieldset>
        <fieldset className="field machinery-field">
          <legend>{t('machineryOwned')}</legend>
          <div className="machinery-options">
            {farmerMachinery.map(({ code }) => (
              <label className={form.machinery.includes(code) ? 'machinery-option checked' : 'machinery-option'} key={code}>
                <input checked={form.machinery.includes(code)} onChange={() => toggleMachine(code)} type="checkbox" />
                {t(machineryKeys[code])}
              </label>
            ))}
          </div>
          {error('machinery') && <small>{error('machinery')}</small>}
        </fieldset>
        {form.machinery.includes('other') && (
          <Input autoComplete="off" error={error('machineryOther')} label={t('machineryOtherLabel')} name="machineryOther" onChange={(value) => update('machineryOther', value)} value={form.machineryOther} />
        )}
        <button className="primary" type="submit">{t('submitFarmer')}</button>
      </form>
    </main>
  );
}
