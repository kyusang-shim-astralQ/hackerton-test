// stores/slices/f6-benchmark.ts — 벤치마크 슬라이스 (f6 담당이 사용·확장). flow 독립, persist 제외.
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { BenchmarkReport } from "../types";

export interface F6Slice {
  benchmarkStatus?: BenchmarkReport;
  setBenchmarkStatus: (s?: BenchmarkReport) => void;
}

export const F6_INITIAL = {
  benchmarkStatus: undefined,
};

/** ✅ persist 제외 — 벤치마크 런타임 상태는 저장하지 않음. */
export const F6_PERSIST_KEYS: (keyof F6Slice)[] = [];

export const createF6Slice: StateCreator<WizardState, [], [], F6Slice> = (
  set
) => ({
  ...F6_INITIAL,
  setBenchmarkStatus: (benchmarkStatus) => set({ benchmarkStatus }),
});
