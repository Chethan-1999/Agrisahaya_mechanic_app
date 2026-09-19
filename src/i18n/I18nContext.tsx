import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { LANGUAGES, strings, type LanguageCode, type StringKey } from './strings';

const STORAGE_KEY = 'agrisahaya.language';

function readStoredLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && LANGUAGES.some((language) => language.code === stored)) {
      return stored as LanguageCode;
    }
  } catch {
    // localStorage can throw in private-browsing/blocked-storage contexts — fall back silently.
  }
  return 'en';
}

type I18nValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: (key: StringKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Language selection lives only on this device (localStorage) — never
 * Firestore, never a Cloud Function. See Blueprint §04/§11.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(readStoredLanguage);

  function setLanguage(next: LanguageCode) {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Best-effort only — losing the preference on this device isn't fatal.
    }
  }

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t: (key: StringKey) => strings[language][key],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
