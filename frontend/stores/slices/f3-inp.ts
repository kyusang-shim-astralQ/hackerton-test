// stores/slices/f3-inp.ts — 물성/옵션/생성파일/플랜제외 슬라이스. 소유: f3 담당.
// ⚠️ 제외 상태(excludedSteps)는 단일 소스 — f3(/generate-inp)·f4(/submit-job)·모니터 표시 모두 동일 규칙 적용.
//    persist에서 빠지면 step-5 이동/새로고침 시 제외가 풀려 제외 스텝이 다시 제출된다(CLAUDE.md §5, data-models §4).
import type { StateCreator } from "zustand";
import type { InpOptions, GeneratedFile } from "../types";

export interface F3Slice {
  /** 단일 물성(12개 중 1개). data-models: property는 단일 문자열이나, UI 토글 편의상 맵으로 보관 */
  selectedProperties: Record<string, boolean>;
  inpOptions?: InpOptions;
  generatedFiles?: GeneratedFile[];
  /** 플랜 스텝 제외 오버라이드 맵 (원본 step_idx 기준). true = 제외 */
  excludedSteps: Record<number, boolean>;

  setSelectedProperties: (p: Record<string, boolean>) => void;
  setInpOptions: (o: InpOptions) => void;
  setGeneratedFiles: (f: GeneratedFile[]) => void;
  setStepExcluded: (stepIdx: number, excluded: boolean) => void;
}

export const F3_INITIAL = {
  selectedProperties: {} as Record<string, boolean>,
  inpOptions: undefined,
  generatedFiles: undefined,
  excludedSteps: {} as Record<number, boolean>,
};

// 입력만 영속 — 제외 상태(excludedSteps) 반드시 포함
export const F3_PERSIST_KEYS = [
  "selectedProperties",
  "inpOptions",
  "generatedFiles",
  "excludedSteps",
] as const;

export const createF3Slice: StateCreator<F3Slice, [], [], F3Slice> = (set) => ({
  ...F3_INITIAL,
  setSelectedProperties: (selectedProperties) => set({ selectedProperties }),
  setInpOptions: (inpOptions) => set({ inpOptions }),
  setGeneratedFiles: (generatedFiles) => set({ generatedFiles }),
  setStepExcluded: (stepIdx, excluded) =>
    set((s) => ({ excludedSteps: { ...s.excludedSteps, [stepIdx]: excluded } })),
});
