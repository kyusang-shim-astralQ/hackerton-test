// stores/slices/f5-report.ts — 리포트 슬라이스. 소유: f5 담당.
// ⚠️ 리포트는 런타임 산출물 — persist 제외 (잡과 함께 휘발).
import type { StateCreator } from "zustand";

export interface ReportData {
  status?: string;
  report: string; // 마크다운 본문
  summary: Record<string, unknown>;
  is_multi?: boolean;
  excitations?: unknown[];
  spectrum?: { wavelengths: number[]; intensities: number[]; sigma_ev: number };
}

export interface F5Slice {
  report?: ReportData;
  setReport: (r: ReportData) => void;
  clearReport: () => void;
}

export const F5_INITIAL = {
  report: undefined,
};

// ✅ persist 제외 (런타임 산출물)
export const F5_PERSIST_KEYS = [] as const;

export const createF5Slice: StateCreator<F5Slice, [], [], F5Slice> = (set) => ({
  ...F5_INITIAL,
  setReport: (report) => set({ report }),
  clearReport: () => set({ ...F5_INITIAL }),
});
