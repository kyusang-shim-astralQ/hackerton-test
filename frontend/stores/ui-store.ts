// stores/ui-store.ts — UI 표시 상태(요약 패널 접힘). localStorage 영속(cp2k.summaryCollapsed).
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UiState {
  summaryCollapsed: boolean;
  setSummaryCollapsed: (v: boolean) => void;
  toggleSummary: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      summaryCollapsed: false,
      setSummaryCollapsed: (summaryCollapsed) => set({ summaryCollapsed }),
      toggleSummary: () =>
        set({ summaryCollapsed: !get().summaryCollapsed }),
    }),
    { name: "cp2k.summaryCollapsed", version: 1 }
  )
);
