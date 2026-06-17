// stores/slices/core.ts — 코어 슬라이스: 단계 진행 + reset. (store 골격 — 기능은 수정하지 않음)
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";

export interface CoreSlice {
  currentStep: number;
  maxReached: number;
  setStep: (s: number) => void;
  /** 단계 진입(도달 최댓값 갱신 포함) */
  goToStep: (s: number) => void;
  /** "새 계산": 전체 상태 초기화 + localStorage 비움 (design-system §4.6) */
  reset: () => void;
}

export const CORE_INITIAL = {
  currentStep: 1,
  maxReached: 1,
};

/** 코어 슬라이스에서 영속할 키 */
export const CORE_PERSIST_KEYS: (keyof CoreSlice)[] = [
  "currentStep",
  "maxReached",
];

export const createCoreSlice: StateCreator<
  WizardState,
  [],
  [],
  CoreSlice
> = (set, get) => ({
  ...CORE_INITIAL,
  setStep: (currentStep) => set({ currentStep }),
  goToStep: (s) =>
    set((state) => ({
      currentStep: s,
      maxReached: Math.max(state.maxReached, s),
    })),
  reset: () => {
    // persist.clearStorage 는 wizard-store 가 store 생성 후 주입(아래 reset 래핑) — 여기선 INITIAL 복원만.
    get().__resetAll();
  },
});
