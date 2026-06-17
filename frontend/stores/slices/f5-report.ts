// stores/slices/f5-report.ts — 리포트 슬라이스 (f5 담당이 사용·확장). 리포트는 런타임 산출 → persist 제외.
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { ReportData } from "../types";

export interface F5Slice {
  reportData?: ReportData;
  setReportData: (r?: ReportData) => void;
}

export const F5_INITIAL = {
  reportData: undefined,
};

/** ✅ persist 제외 — 리포트는 저장하지 않음(완료 결과는 재생성). */
export const F5_PERSIST_KEYS: (keyof F5Slice)[] = [];

export const createF5Slice: StateCreator<WizardState, [], [], F5Slice> = (
  set
) => ({
  ...F5_INITIAL,
  setReportData: (reportData) => set({ reportData }),
});
