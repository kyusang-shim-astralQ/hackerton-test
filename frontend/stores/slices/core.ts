// stores/slices/core.ts — 코어 슬라이스 (단계 진행 + reset). 공유 골격.
// 단일 소스: docs/design-system.md §4.6, fe/01 §6
import type { StateCreator } from "zustand";
import { TOTAL_STEPS } from "@/lib/steps";

export interface CoreSlice {
  currentStep: number;
  maxReached: number;
  // actions
  setStep: (s: number) => void;
  /** 다음 단계로 진행하며 maxReached 갱신 */
  goNext: () => void;
  goPrev: () => void;
  reset: () => void; // "새 계산": 상태 초기화 + localStorage 비움 (wizard-store가 구현 주입)
}

export const CORE_INITIAL = {
  currentStep: 1,
  maxReached: 1,
};

// 영속 키 (입력만 — 진행단계 포함)
export const CORE_PERSIST_KEYS = ["currentStep", "maxReached"] as const;

/**
 * 코어 슬라이스 생성자. reset()의 실제 구현(전 슬라이스 초기화 + clearStorage)은
 * wizard-store 합성부에서 주입한다(여기선 시그니처만 보장).
 */
export const createCoreSlice: StateCreator<CoreSlice, [], [], CoreSlice> = (set, get) => ({
  ...CORE_INITIAL,
  setStep: (currentStep) =>
    set((s) => ({
      currentStep,
      maxReached: Math.max(s.maxReached, currentStep),
    })),
  goNext: () =>
    set((s) => {
      const next = Math.min(TOTAL_STEPS, s.currentStep + 1);
      return { currentStep: next, maxReached: Math.max(s.maxReached, next) };
    }),
  goPrev: () => set((s) => ({ currentStep: Math.max(1, s.currentStep - 1) })),
  // wizard-store가 덮어쓴다.
  reset: () => set({ ...CORE_INITIAL } as Partial<CoreSlice>),
});
