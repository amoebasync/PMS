'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage, type Language } from './context';

type TranslationData = Record<string, any>;

// Module-level cache: lang -> namespace -> data
// context.tsx の preloadCoreNamespaces と共有するためグローバルに配置
function getCache(): Record<string, Record<string, TranslationData>> {
  if (!(globalThis as any).__i18nCache) {
    (globalThis as any).__i18nCache = { ja: {}, en: {} };
  }
  return (globalThis as any).__i18nCache;
}

// Pending promises to avoid duplicate imports
const pending: Record<string, Promise<TranslationData>> = {};

async function loadNamespace(lang: Language, ns: string): Promise<TranslationData> {
  const cache = getCache();
  if (cache[lang][ns]) return cache[lang][ns];

  const key = `${lang}/${ns}`;
  if (!pending[key]) {
    pending[key] = import(`./locales/${lang}/${ns}.json`)
      .then((mod) => {
        const data = mod.default || mod;
        cache[lang][ns] = data;
        delete pending[key];
        return data;
      })
      .catch(() => {
        delete pending[key];
        return {};
      });
  }
  return pending[key];
}

function getNestedValue(obj: TranslationData, path: string): string {
  const keys = path.split('.');
  let current: any = obj;
  for (const k of keys) {
    if (current == null || typeof current !== 'object') return path;
    current = current[k];
  }
  return typeof current === 'string' ? current : path;
}

/** Check if all required namespaces are already cached */
function isCached(lang: Language, namespaces: string[]): boolean {
  const cache = getCache();
  return namespaces.every((ns) => !!cache[lang][ns]);
}

/**
 * useTranslation hook
 * @param namespace - optional page-specific namespace (e.g. 'distributors')
 *   When provided, the page namespace is loaded and merged with 'common'.
 *   Keys are looked up in the page namespace first, then fall back to 'common'.
 *
 * Returns { t, lang, ready }
 *   ready=false while translation JSON is loading — use this to show a loader
 *   instead of raw translation keys.
 */
export function useTranslation(namespace?: string) {
  const { lang } = useLanguage();
  const namespaces = namespace ? ['common', namespace] : ['common'];
  const alreadyCached = isCached(lang, namespaces);
  const [ready, setReady] = useState(alreadyCached);
  const prevKey = useRef(`${lang}/${namespace ?? ''}`);

  useEffect(() => {
    const key = `${lang}/${namespace ?? ''}`;
    // If lang or namespace changed, reset ready unless already cached
    if (key !== prevKey.current) {
      prevKey.current = key;
      if (isCached(lang, namespaces)) {
        setReady(true);
        return;
      }
      setReady(false);
    }

    // Already cached (e.g. preloaded by LanguageProvider)
    if (isCached(lang, namespaces)) {
      setReady(true);
      return;
    }

    let cancelled = false;

    Promise.all(namespaces.map((ns) => loadNamespace(lang, ns))).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => { cancelled = true; };
  }, [lang, namespace]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    const cache = getCache();
    // Look up in page namespace first, then common
    let value: string | undefined;
    if (namespace && cache[lang][namespace]) {
      const v = getNestedValue(cache[lang][namespace], key);
      if (v !== key) value = v;
    }
    if (value === undefined && cache[lang]['common']) {
      const v = getNestedValue(cache[lang]['common'], key);
      if (v !== key) value = v;
    }
    // 翻訳未ロード時はキー名ではなく空文字を返す（FOUC防止）
    if (value === undefined) value = ready ? key : '';

    // Simple parameter interpolation: {{name}}
    if (params) {
      for (const [pk, pv] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${pk}\\}\\}`, 'g'), String(pv));
      }
    }
    return value;
  };

  return { t, lang, ready };
}
