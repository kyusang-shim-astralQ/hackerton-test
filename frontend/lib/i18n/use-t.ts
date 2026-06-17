// lib/i18n/use-t.ts — t() 훅. JSX 에서 t('key') 직접 렌더.
"use client";

import { useCallback } from "react";
import { useLangStore } from "@/stores/lang-store";
import { translate, type Lang } from "./index";

export interface UseTResult {
  /** 현재 언어 키 번역 ({param} 치환 지원) */
  t: (key: string, params?: Record<string, string | number>) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export function useT(): UseTResult {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const toggleLang = useLangStore((s) => s.toggleLang);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) =>
      translate(lang, key, params),
    [lang]
  );

  return { t, lang, setLang, toggleLang };
}
