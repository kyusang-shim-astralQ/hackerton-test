// stores/slices/f3-inp.ts — INP 생성 슬라이스 + 플랜 제외 상태(cross-feature) (f3 담당이 사용·확장).
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { GeneratedFile } from "../types";

export interface F3Slice {
  /** 생성된 .inp 파일 목록 */
  generatedFiles?: GeneratedFile[];
  /**
   * 플랜 제외 오버라이드 맵(원본 step 인덱스 기준, true=제외).
   * ★ 반드시 persist 대상(아래 PERSIST_KEYS) — 빠지면 step-5/새로고침 시 제외가 풀려 제외 스텝이 되살아남(fe/01 §6, data-models §4).
   * 권장은 planResult.steps[i].exclude 직접 갱신이나, 오버라이드 맵을 쓰는 기능을 위해 단일 소스로 여기 둠.
   */
  excludedSteps: Record<number, boolean>;

  setGeneratedFiles: (files?: GeneratedFile[]) => void;
  /** 원본 인덱스 i 의 제외 토글 */
  toggleStepExcluded: (i: number, excluded?: boolean) => void;
  clearExcludedSteps: () => void;
}

export const F3_INITIAL = {
  generatedFiles: undefined,
  excludedSteps: {} as Record<number, boolean>,
};

/** 입력 영속(§4.6): 생성파일 + 제외 상태 저장(제외 상태 누락 시 버그). */
export const F3_PERSIST_KEYS: (keyof F3Slice)[] = [
  "generatedFiles",
  "excludedSteps",
];

export const createF3Slice: StateCreator<WizardState, [], [], F3Slice> = (
  set
) => ({
  ...F3_INITIAL,
  setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
  toggleStepExcluded: (i, excluded) =>
    set((s) => {
      const next = { ...s.excludedSteps };
      const value = excluded ?? !next[i];
      if (value) next[i] = true;
      else delete next[i];
      return { excludedSteps: next };
    }),
  clearExcludedSteps: () => set({ excludedSteps: {} }),
});
