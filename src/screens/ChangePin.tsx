import { useState, type FormEvent } from 'react';

import { PinInput, type Toast } from '../components/ui';
import { useI18n } from '../i18n/I18nContext';
import { changePin } from '../services/pin';

export function ChangePin({ onBack, setToast, withLoading }: {
  onBack: () => void;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!/^\d{4}$/.test(currentPin) || !/^\d{4}$/.test(newPin)) {
      setToast({ kind: 'error', text: t('pinFormatError') });
      return;
    }
    if (newPin !== confirmPin) {
      setToast({ kind: 'error', text: t('pinMismatchError') });
      return;
    }

    await withLoading(async () => {
      await changePin(currentPin, newPin);
      setToast({ kind: 'success', text: t('pinChangedToast') });
      onBack();
    });
  }

  return (
    <main className="detail-page">
      <section className="card profile-card">
        <button className="text-button" onClick={onBack} type="button">{t('back')}</button>
        <h1>{t('changePinTitle')}</h1>
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <PinInput label={t('currentPinLabel')} onChange={setCurrentPin} value={currentPin} />
          <PinInput label={t('newPinLabel')} onChange={setNewPin} value={newPin} />
          <PinInput label={t('confirmPinLabel')} onChange={setConfirmPin} value={confirmPin} />
          <button className="primary" type="submit">{t('changePinButton')}</button>
        </form>
      </section>
    </main>
  );
}
