'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Language = 'ja' | 'en';

const LANG_STORAGE_KEY = 'pms_lang';

/** localStorage から同期的に言語を読み取る（FOUC防止） */
function getStoredLang(): Language {
  if (typeof window === 'undefined') return 'ja';
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'en' || stored === 'ja') return stored;
  } catch { /* SSR or private browsing */ }
  return 'ja';
}

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
  initialLang,
}: {
  children: ReactNode;
  initialLang?: Language;
}) {
  const [lang, setLangState] = useState<Language>(initialLang ?? getStoredLang);
  const [coreReady, setCoreReady] = useState(false);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    // localStorage に即座に保存（次回マウント時に同期的に読める）
    try { localStorage.setItem(LANG_STORAGE_KEY, newLang); } catch { /* ignore */ }
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
