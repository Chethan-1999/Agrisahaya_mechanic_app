import { useEffect, useState, type FormEvent } from 'react';

import { Input, type Toast } from '../../components/ui';
import { auth } from '../../firebase';
import { OTP_REUSE_MS, usePhoneOtp } from '../../hooks/usePhoneOtp';
import { useI18n } from '../../i18n/I18nContext';
import { completeSignup } from '../../services/auth';
import { getMechanic, revokeOtherSessions } from '../../services/mechanics';
import { otpErrorKey } from '../../services/otp/otpErrors';
import { MechanicFields } from '../../shared/MechanicFields';
import type { Mechanic, MechanicForm } from '../../types';
import { emptyMechanicForm } from '../../types';
import { clearSignupDraft, loadSignupDraft, saveSignupDraft } from '../../utils/signupDraft';
import { hasErrors, validateProfileForm, type ValidationErrors } from '../../utils/validation';
import { withTimeout } from '../../utils/withTimeout';

const toPhoneDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10);

const formatCountdown = (ms: number) => {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Seconds left to reuse the code sent at `sentAt`, ticking every second; null when no code was sent. */
function useOtpTimeLeft(sentAt: number | null): number | null {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (sentAt === null) return;
    setNow(Date.now());
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [sentAt]);

  return sentAt === null ? null : Math.max(0, sentAt + OTP_REUSE_MS - now);
}

// Sending an OTP can put a reCAPTCHA image puzzle in front of the technician, so the
// normal network timeout would fire while they're still solving it.
const OTP_SEND_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Merged login/signup: phone-OTP verification only, no PIN. After OTP
 * verifies, an existing technician (technicians/{uid} already exists) is
 * revealed directly; a brand-new phone number is walked through the profile
 * form and completeSignup. Both paths call revokeOtherSessions right after
 * sign-in to enforce "only one phone at a time" (see technicianFunctions.ts)
 * — it only revokes sessions from before this sign-in, and the
 * getIdToken(true) refresh after it confirms THIS device's session survived.
 */
export function MechanicAuth({ mode, onExisting, onNew, setToast, withLoading }: {
  mode: 'login' | 'signup';
  onExisting: (mechanicId: string, technician: Mechanic) => void;
  onNew: (mechanicId: string) => void;
  setToast: (toast: Toast) => void;
  withLoading: (action: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useI18n();
  const { clearOtpSession, confirmOtp, otp, phoneNumber, sendOtp, sentAt, session, setOtp, setPhoneNumber } = usePhoneOtp();
  const otpTimeLeft = useOtpTimeLeft(sentAt);
  const [step, setStep] = useState<'verify' | 'profile'>('verify');
  const [form, setForm] = useState<MechanicForm>(emptyMechanicForm);
  const [sentOtp, setSentOtp] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  useEffect(() => {
    setStep('verify');
    setForm(mode === 'signup' ? { ...emptyMechanicForm, ...loadSignupDraft() } : emptyMechanicForm);
    setSentOtp(null);
    setOtpVerified(false);
    setLoggingIn(false);
    setErrors({});
  }, [mode]);

  function updateField(key: keyof MechanicForm, value: string) {
    setForm((current) => {
      const next = { ...current, [key]: key === 'phoneNumber' ? toPhoneDigits(value) : value };
      if (mode === 'signup') {
        const { phoneNumber: _phoneNumber, ...draft } = next;
        saveSignupDraft(draft);
      }
      return next;
    });
  }

  function updatePhoneNumber(value: string) {
    setPhoneNumber(toPhoneDigits(value));
    setForm((current) => ({ ...current, phoneNumber: toPhoneDigits(value) }));
    setSentOtp(null);
    setOtpVerified(false);
    clearOtpSession();
    setErrors((current) => ({ ...current, phoneNumber: undefined }));
  }

  function clearSignupForm() {
    clearSignupDraft();
    setPhoneNumber('');
    setOtp('');
    setForm(emptyMechanicForm);
    setSentOtp(null);
    setOtpVerified(false);
    clearOtpSession();
    setErrors({});
  }

  // Turns a raw OTP failure ("Firebase: ... (auth/operation-not-allowed).") into a plain translated message —
  // no error codes on screen. The original stays in the console for debugging.
  function toOtpError(err: unknown): unknown {
    if (err instanceof Error && err.message === 'INVALID_PHONE') return new Error(t('enterValidPhone'));

    const key = otpErrorKey(err);
    if (!key) return err;

    console.warn('OTP error:', err);
    return new Error(t(key));
  }

  async function confirmOtpOrThrow() {
    try {
      await withTimeout(confirmOtp(), t('networkError'));
    } catch (err) {
      throw toOtpError(err);
    }
  }

  async function send() {
    await withLoading(async () => {
      let result: Awaited<ReturnType<typeof sendOtp>>;
      try {
        result = await withTimeout(sendOtp(), t('networkError'), OTP_SEND_TIMEOUT_MS);
      } catch (err) {
        throw toOtpError(err);
      }
      setSentOtp(result.devHint ?? 'sent');
      setToast({
        kind: 'success',
        text: result.reused ? t('otpAlreadySent') : result.devHint ? `Dev code: ${result.devHint}` : t('codeSentBySms'),
      });
    });
  }

  // Signing in from either tab with a number that already has an account just opens that account.
  async function openExistingAccount(uid: string, technician: Mechanic) {
    await withTimeout(revokeOtherSessions(), t('slowConnectionError'));
    await withTimeout(auth.currentUser?.getIdToken(true) ?? Promise.resolve(''), t('slowConnectionError'));
    if (mode === 'signup') setToast({ kind: 'success', text: t('alreadyRegisteredOpening') });
    onExisting(uid, technician);
  }

  async function verifySignupOtp() {
    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }

    await withLoading(async () => {
      await confirmOtpOrThrow();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error(t('signInFailed'));

      const technician = await withTimeout(getMechanic(uid), t('slowConnectionError'));
      if (technician) {
        await openExistingAccount(uid, technician);
        return;
      }

      setForm((current) => ({ ...current, phoneNumber: phoneNumber.trim() }));
      setOtpVerified(true);
      setErrors({});
      setToast({ kind: 'success', text: t('otpVerifiedComplete') });
    });
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (loggingIn) return;

    if (!session) {
      setToast({ kind: 'error', text: t('sendCodeFirst') });
      return;
    }

    setLoggingIn(true);
    try {
      await withLoading(async () => {
        await confirmOtpOrThrow();
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error(t('signInFailed'));

        const technician = await withTimeout(getMechanic(uid), t('slowConnectionError'));
        if (technician) {
          await openExistingAccount(uid, technician);
          return;
        }

        // No account yet: the phone is already verified, so go straight to the sign-up details — no second code.
        setForm((current) => ({ ...current, ...loadSignupDraft(), phoneNumber: phoneNumber.trim() }));
        setToast({ kind: 'success', text: t('noAccountSignUpNow') });
        setStep('profile');
      });
    } finally {
      setLoggingIn(false);
    }
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (mode === 'signup' && !otpVerified) {
      setToast({ kind: 'error', text: t('verifyOtpEnableFields') });
      return;
    }

    const { phoneNumber: _phoneNumber, ...profile } = form;
    const nextErrors = validateProfileForm(profile);
    setErrors(nextErrors);
    if (hasErrors(nextErrors)) return;

    await withLoading(async () => {
      await withTimeout(completeSignup(profile), t('slowConnectionError'));
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error(t('signInFailed'));
      clearSignupDraft();
      void revokeOtherSessions();
      onNew(uid);
    });
  }

  const otpTimer = otpTimeLeft === null ? null : (
    <p className={otpTimeLeft > 0 ? 'muted otp-timer' : 'error-text otp-timer'}>
      {otpTimeLeft > 0 ? t('otpReuseTimer').replace('{time}', formatCountdown(otpTimeLeft)) : t('otpTimerExpired')}
    </p>
  );

  if (mode === 'signup') {
    return (
      <form className="form-grid" onSubmit={(event) => void submitProfile(event)}>
        <div className="otp-row">
          <Input disabled={otpVerified} error={errors.phoneNumber} inputMode="numeric" label={t('mobileNumber')} maxLength={10} onChange={updatePhoneNumber} pattern="[0-9]*" value={phoneNumber} />
          <button className="secondary" disabled={otpVerified} onClick={() => void send()} type="button">{t('sendOtp')}</button>
        </div>
        {!otpVerified && otpTimer}
        <div className="otp-row">
          <Input disabled={otpVerified} label={t('otpVerification')} onChange={setOtp} value={otp} />
          <button className="secondary" disabled={otpVerified} onClick={() => void verifySignupOtp()} type="button">{t('verifyButton')}</button>
        </div>
        {sentOtp && sentOtp !== 'sent' && !otpVerified && <p className="success-text">Dev code: {sentOtp}</p>}
        <p className={otpVerified ? 'success-text' : 'muted'}>{otpVerified ? t('otpVerifiedFields') : t('verifyOtpEnableFields')}</p>
        <MechanicFields disabled={!otpVerified} errors={errors} form={form} onChange={updateField} translated />
        <button className="secondary" onClick={clearSignupForm} type="button">{t('clear')}</button>
        <button className="primary" type="submit">{t('submitButton')}</button>
      </form>
    );
  }

  if (step === 'profile') {
    return (
      <form className="form-grid" onSubmit={(event) => void submitProfile(event)}>
        <p className="success-text">{t('phoneVerifiedCompleteProfile')}</p>
        <MechanicFields errors={errors} form={form} onChange={updateField} translated />
        <button className="primary" type="submit">{t('submitButton')}</button>
      </form>
    );
  }

  return (
    <form className="form-grid" onSubmit={(event) => void verify(event)}>
      <div className="login-phone-row">
        <Input inputMode="numeric" label={t('mobileNumber')} maxLength={10} onChange={updatePhoneNumber} pattern="[0-9]*" value={phoneNumber} />
        <button className="secondary send-otp-button" onClick={() => void send()} type="button">{t('sendOtp')}</button>
        {otpTimer}
      </div>
      <Input label={t('otp')} onChange={setOtp} value={otp} />
      <button className="primary" disabled={loggingIn} type="submit">{loggingIn ? t('loggingIn') : t('login')}</button>
    </form>
  );
}
