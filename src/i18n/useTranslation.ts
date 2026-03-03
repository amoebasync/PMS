'use client';

import { useState, useEffect } from 'react';
import { useLanguage, type Language } from './context';

type TranslationData = Record<string, any>;

// Module-level cache: lang -> namespace -> data
const cache: Record<string, Record<string, TranslationData>> = { ja: {}, en: {} };

// Pending promises to avoid duplicate imports
const pending: Record<string, Promise<TranslationData>> = {};

async function loadNamespace(lang: Language, ns: string): Promise<TranslationData> {
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

/**
 * useTranslation hook
 * @param namespace - optional page-specific namespace (e.g. 'distributors')
 *   When provided, the page namespace is loaded and merged with 'common'.
 *   Keys are looked up in the page namespace first, then fall back to 'common'.
 */
export function useTranslation(namespace?: string) {
  const { lang } = useLanguage();
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const namespaces = namespace ? ['common', namespace] : ['common'];

    Promise.all(namespaces.map((ns) => loadNamespace(lang, ns))).then(() => {
      if (!cancelled) forceUpdate((n) => n + 1);
    });

    return () => { cancelled = true; };
  }, [lang, namespace]);

  const t = (key: string, params?: Record<string, string | number>): string => {
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
    if (value === undefined) value = key;

    // Simple parameter interpolation: {{name}}
    if (params) {
      for (const [pk, pv] of Object.entries(params)) {
        value = value.replace(new RegExp(`\\{\\{${pk}\\}\\}`, 'g'), String(pv));
      }
    }
    return value;
  };

  return { t, lang };
}
