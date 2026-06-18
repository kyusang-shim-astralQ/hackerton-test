"use client";
// lib/i18n/provider.tsx — i18n Provider + useT 훅 (공유 골격)
// 기본 ko, localStorage('cp2k_agent_lang') 유지. 기능은 이 파일을 수정하지 않는다.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { mergedDict, type Lang } from "./registry";

const LANG_KEY = "cp2k_agent_lang";

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** 키 → 현재 언어 문자열. {param} 치환 지원. 미존재 시 키 그대로 반환. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ko");

  // hydration: localStorage에서 언어 복원 (SSR 안전)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "ko" || saved === "en") setLangState(saved);
    } catch {
      /* localStorage 불가 환경 무시 */
    }
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_KEY, l);
    } catch {
      /* noop */
    }
  };

  const value = useMemo<I18nContextValue>(() => {
    const dict = mergedDict(lang);
    return {
      lang,
      setLang,
      t: (key, params) => {
        const raw = dict[key];
        return raw === undefined ? key : interpolate(raw, params);
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within <I18nProvider>");
  return ctx;
}

export type { Lang };
