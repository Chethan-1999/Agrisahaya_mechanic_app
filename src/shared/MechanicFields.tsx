import { useEffect, useId, useMemo, useState } from 'react';

import { Input } from '../components/ui';
import { useI18n } from '../i18n/I18nContext';
import type { MechanicForm } from '../types';
import { indianStates } from '../utils/indianStates';
import type { ValidationErrors } from '../utils/validation';

// `translated` is only true on the technician's own signup form — the admin's
// edit screen (EditMechanic) always stays in English, since admin works the
// web console regardless of a technician's chosen language. See i18n/strings.ts.
export function MechanicFields({ disabled = false, errors = {}, form, onChange, translated = false }: { disabled?: boolean; errors?: ValidationErrors; form: MechanicForm; onChange: (key: keyof MechanicForm, value: string) => void; translated?: boolean }) {
  const { t } = useI18n();
  const labels = translated
    ? {
        fullName: t('fullName'),
        village: t('village'),
        district: t('district'),
        state: t('state'),
        pincode: t('pincode'),
        address: t('address'),
        age: t('age'),
        experience: t('experience'),
      }
    : {
        fullName: 'Full Name',
        village: 'Village',
        district: 'District',
        state: 'State',
        pincode: 'Pincode',
        address: 'Address',
        age: 'Age',
        experience: 'Years of Experience',
      };

  return (
    <fieldset className="form-grid fields-grid" disabled={disabled}>
      <Input error={errors.fullName} label={labels.fullName} autoComplete="name" name="fullName" onChange={(value) => onChange('fullName', value)} value={form.fullName} />
      <StateSelect error={errors.state} label={labels.state} onChange={(value) => onChange('state', value)} value={form.state} />
      <Input label={labels.district} error={errors.district} autoComplete="address-level2" name="district" onChange={(value) => onChange('district', value)} value={form.district} />
      <Input label={labels.village} error={errors.village} autoComplete="address-level3" name="village" onChange={(value) => onChange('village', value)} value={form.village} />
      <Input label={labels.address} autoComplete="street-address" name="address" onChange={(value) => onChange('address', value)} value={form.address} />
      <Input label={labels.pincode} error={errors.pincode} autoComplete="postal-code" name="pincode" onChange={(value) => onChange('pincode', value)} value={form.pincode} />
      <Input error={errors.age} label={labels.age} autoComplete="off" name="age" onChange={(value) => onChange('age', value)} value={form.age} />
      <Input label={labels.experience} error={errors.experience} autoComplete="off" name="experience" onChange={(value) => onChange('experience', value)} value={form.experience} />
    </fieldset>
  );
}

export function StateSelect({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: string) => void; value: string }) {
  const { t } = useI18n();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const filteredStates = useMemo(() => indianStates.filter((state) => state.toLowerCase().includes(search.trim().toLowerCase())), [search]);

  useEffect(() => setSearch(value), [value]);

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    onChange(nextSearch);
    setOpen(true);
  }

  function selectState(state: string) {
    setSearch(state);
    onChange(state);
    setOpen(false);
  }

  return (
    <div className="field state-select">
      <label htmlFor={inputId}>{label}</label>
      <input autoComplete="off" className={error ? 'invalid' : ''} id={inputId} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={(event) => updateSearch(event.target.value)} onFocus={() => setOpen(true)} placeholder={t('searchSelectState')} value={search} />
      {open && (
        <div className="state-options">
          {filteredStates.length > 0
            ? filteredStates.map((state) => <button key={state} onMouseDown={(event) => event.preventDefault()} onClick={() => selectState(state)} type="button">{state}</button>)
            : <span>{t('noStateFound')}</span>}
        </div>
      )}
      {error && <small>{error}</small>}
    </div>
  );
}
