import { LANGUAGES, type LanguageCode, type StringKey } from '../i18n/strings';
import type { JobStatus } from '../types';

export type Toast = { kind: 'success' | 'error'; text: string } | null;

export function LanguageSelector({ label, language, onChange }: { label: string; language: LanguageCode; onChange: (value: LanguageCode) => void }) {
  return (
    <label className="language-select">
      <span>{label}</span>
      <select onChange={(event) => onChange(event.target.value as LanguageCode)} value={language}>
        {LANGUAGES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select>
    </label>
  );
}

/**
 * Maps a job status to the existing .pill CSS classes so job pills reuse the
 * same palette as technician-status pills. Pass `t` (from useI18n) to get a
 * translated label — used on the technician's own screens; the admin Job
 * Board omits it and stays in English.
 */
export function jobStatusMeta(status: JobStatus, t?: (key: StringKey) => string): { pillClass: string; label: string } {
  const label = (key: StringKey, fallback: string) => (t ? t(key) : fallback);
  switch (status) {
    case 'completed':
      return { pillClass: 'active', label: label('statusCompleted', 'Completed') };
    case 'cancelled':
      return { pillClass: 'rejected', label: label('statusCancelled', 'Cancelled') };
    case 'declined':
      return { pillClass: 'rejected', label: label('statusDeclined', 'Declined') };
    case 'accepted':
      return { pillClass: 'pending', label: label('statusAccepted', 'Accepted') };
    case 'assigned':
      return { pillClass: 'pending', label: label('statusPending', 'Pending') };
    default:
      return { pillClass: 'inactive', label: label('statusOpen', 'Open') };
  }
}

export function Input({ error, label, onChange, type = 'text', value }: { error?: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return <label className="field"><span>{label}</span><input className={error ? 'invalid' : ''} onChange={(event) => onChange(event.target.value)} type={type} value={value} />{error && <small>{error}</small>}</label>;
}

export function Textarea({ error, label, onChange, value }: { error?: string; label: string; onChange: (value: string) => void; value: string }) {
  return <label className="field"><span>{label}</span><textarea className={error ? 'invalid' : ''} onChange={(event) => onChange(event.target.value)} rows={3} value={value} />{error && <small>{error}</small>}</label>;
}

export function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return <label className="field"><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

export function Metric({ label, value }: { label: string; value: number }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

export function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : '-';
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
