// stores/slices/f2-plan.ts — 물성/DFT옵션/AI플랜 슬라이스 (f2 담당이 사용·확장).
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { InpOptions, PlanResult } from "../types";

export interface F2Slice {
  /** 단일 선택 물성 (12종 중 1개). Record 형태를 유지해 design-system §4.6 계약과 정합. */
  selectedProperties: Record<string, boolean>;
  /** DFT 옵션 폼 값 (PlanRequest 필드와 1:1) */
  inpOptions?: InpOptions;
  /** AI 플랜 결과(steps + expert_tip + atom_info 에코) */
  planResult?: PlanResult;

  setSelectedProperty: (key: string) => void; // 단일 선택 토글
  setInpOptions: (opts?: InpOptions) => void;
  patchInpOptions: (patch: Partial<InpOptions>) => void;
  setPlanResult: (plan?: PlanResult) => void;
}

/** step-3 폼 기본값 (PlanRequest 필드와 1:1). 카드가 마운트 시 이 값으로 초기화. */
export const F2_DEFAULT_INP_OPTIONS: InpOptions = {
  functional: "PBE",
  basis_set: "DZVP-MOLOPT-GTH",
  cutoff: 400,
  rel_cutoff: 50,
  method: "GPW",
  scf_algo: "OT",
  charge: 0,
  multiplicity: 1,
  use_smear: false,
  smear_temp: 300,
  eps_scf: "1.0E-6",
  periodic: "XYZ",
  max_scf: 50,
  ignore_scf_failure: false,
  lsd: false,
  added_mos: null,
  optimizer: "BFGS",
  custom_options: {},
};

export const F2_INITIAL = {
  selectedProperties: {} as Record<string, boolean>,
  inpOptions: undefined,
  planResult: undefined,
};

/** 입력 영속(§4.6): 물성/옵션/플랜 저장. */
export const F2_PERSIST_KEYS: (keyof F2Slice)[] = [
  "selectedProperties",
  "inpOptions",
  "planResult",
];

export const createF2Slice: StateCreator<WizardState, [], [], F2Slice> = (
  set
) => ({
  ...F2_INITIAL,
  // 단일 선택: 누른 키만 true 로 두고 나머지는 비운다.
  setSelectedProperty: (key) => set({ selectedProperties: { [key]: true } }),
  setInpOptions: (inpOptions) => set({ inpOptions }),
  patchInpOptions: (patch) =>
    set((s) => ({
      inpOptions: { ...(s.inpOptions ?? ({} as InpOptions)), ...patch },
    })),
  setPlanResult: (planResult) => set({ planResult }),
});
