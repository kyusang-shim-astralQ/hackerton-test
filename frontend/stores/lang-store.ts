// stores/lang-store.ts — 언어 상태(cp2k_agent_lang 키 유지, design-system §4.6 "언어는 별도 store")
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LANG_STORAGE_KEY, type Lang } from "@/lib/i18n";

interface LangState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "ko",
      setLang: (lang) => set({ lang }),
      toggleLang: () => set({ lang: get().lang === "ko" ? "en" : "ko" }),
    }),
    { name: LANG_STORAGE_KEY, version: 1 }
  )
);
