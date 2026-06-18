'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { dictionaries, Locale } from '../i18n/dictionaries';

interface LanguageContextProps {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof typeof dictionaries['en']) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocale] = useState<Locale>('en');

  // Load saved locale from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tenderiq_locale') as Locale;
    if (saved && ['en', 'hi', 'mr', 'ta'].includes(saved)) {
      setLocale(saved);
    }
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem('tenderiq_locale', newLocale);
  };

  const t = (key: keyof typeof dictionaries['en']): string => {
    const dict = dictionaries[locale] || dictionaries.en;
    return dict[key] || dictionaries.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
};
export type { Locale };
