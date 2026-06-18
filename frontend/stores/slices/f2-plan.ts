// stores/slices/f2-plan.ts — AI 플랜 슬라이스. 소유: f2 담당.
import type { StateCreator } from "zustand";
import type { PlanResult } from "../types";

export interface F2Slice {
  planResult?: PlanResult;
  setPlanResult: (p: PlanResult) => void;
  clearPlan: () => void;
}

export const F2_INITIAL = {
  planResult: undefined,
};

export const F2_PERSIST_KEYS = ["planResult"] as const;

export const createF2Slice: StateCreator<F2Slice, [], [], F2Slice> = (set) => ({
  ...F2_INITIAL,
  setPlanResult: (planResult) => set({ planResult }),
  clearPlan: () => set({ ...F2_INITIAL }),
});
