'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Language = 'ja' | 'en';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// 共通名前空間を事前ロードするヘルパー（useTranslation.ts のキャッシュと共有）
async function preloadCoreNamespaces(lang: Language): Promise<void> {
  const namespaces = ['common', 'sidebar'];
  await Promise.all(
    namespaces.map((ns) =>
      import(`./locales/${lang}/${ns}.json`)
        .then((mod) => {
          // useTranslation.ts のモジュールレベルキャッシュに直接書き込む
          if (!(globalThis as any).__i18nCache) (globalThis as any).__i18nCache = { ja: {}, en: {} };
          (globalThis as any).__i18nCache[lang][ns] = mod.default || mod;
        })
        .catch(() => {})
    )
  );
}

export function LanguageProvider({
  children,
  initialLang = 'ja',
}: {
  children: ReactNode;
  initialLang?: Language;
}) {
  const [lang, setLangState] = useState<Language>(initialLang);
  const [coreReady, setCoreReady] = useState(false);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    // Persist to DB
    fetch('/api/profile/language', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLang }),
    }).catch(() => {});
  }, []);

  // 言語が変わったら共通名前空間をプリロード
  useEffect(() => {
    setCoreReady(false);
    preloadCoreNamespaces(lang).then(() => setCoreReady(true));
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {coreReady ? children : null}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
