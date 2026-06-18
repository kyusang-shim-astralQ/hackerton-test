// stores/slices/f6-benchmark.ts — 벤치마크 슬라이스. 소유: f6 담당.
// ⚠️ 런타임 상태(benchmarkReport)는 persist 제외. 선택 레벨(selectedLevels)만 입력으로 영속.
import type { StateCreator } from "zustand";
import type { BenchmarkStatus } from "../types";
import type { BenchmarkReport } from "@/features/f6-benchmark/types";
import { TOTAL_LEVELS } from "@/features/f6-benchmark/types";

export interface F6Slice {
  /** 공유 축약형 상태(레거시 호환 — shared types) */
  benchmarkStatus?: BenchmarkStatus;
  /** f6 전용 정밀 진행상태(런타임, persist 제외) */
  benchmarkReport?: BenchmarkReport;
  /** 선택된 벤치마크 레벨(입력 — 영속). 기본 1~12 전체 */
  selectedLevels: number[];

  setBenchmarkStatus: (b: BenchmarkStatus) => void;
  setBenchmarkReport: (r: BenchmarkReport) => void;
  setSelectedLevels: (levels: number[]) => void;
  clearBenchmark: () => void;
}

const ALL_LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

export const F6_INITIAL = {
  benchmarkStatus: undefined,
  benchmarkReport: undefined,
  selectedLevels: ALL_LEVELS,
};

// ✅ 선택 레벨만 영속(입력). 진행상태는 런타임 — 제외.
export const F6_PERSIST_KEYS = ["selectedLevels"] as const;

export const createF6Slice: StateCreator<F6Slice, [], [], F6Slice> = (set) => ({
  ...F6_INITIAL,
  setBenchmarkStatus: (benchmarkStatus) => set({ benchmarkStatus }),
  setBenchmarkReport: (benchmarkReport) => set({ benchmarkReport }),
  setSelectedLevels: (selectedLevels) => set({ selectedLevels }),
  clearBenchmark: () => set({ benchmarkStatus: undefined, benchmarkReport: undefined }),
});
