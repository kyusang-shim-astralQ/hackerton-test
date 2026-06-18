// features/f2-plan/constants.ts — f2-plan 정적 메타. 소유: f2 담당.
// property 키는 data-models.md 표준 12종과 1:1 (geo_opt, single_point, dos, band, aimd,
// vibrational, neb, adsorption, work_function, hirshfeld, absorption, emission).
// DFT 옵션 선택지/기본값은 PlanRequest(data-models §3) 기본값과 일치.

/** 표준 12종 물성 키 (단일 선택). */
export type PropertyKey =
  | "geo_opt"
  | "single_point"
  | "dos"
  | "band"
  | "aimd"
  | "vibrational"
  | "neb"
  | "adsorption"
  | "work_function"
  | "hirshfeld"
  | "absorption"
  | "emission";

export interface PropertyDef {
  key: PropertyKey;
  /** i18n 키 접두 (f2.prop.<key> / f2.prop.<key>.desc) */
  run_type: string; // 대표 RUN_TYPE (사용자 안내용 표기)
}

export interface PropertyCategory {
  /** i18n 키 (f2.cat.<id>) */
  id: "static" | "dynamic" | "reactivity" | "optical" | "electronic" | "other";
  items: PropertyDef[];
}

/** 카테고리별 12개 물성 (단일 선택 라디오). */
export const PROPERTY_CATEGORIES: PropertyCategory[] = [
  {
    id: "static",
    items: [
      { key: "geo_opt", run_type: "GEO_OPT" },
      { key: "single_point", run_type: "ENERGY" },
    ],
  },
  {
    id: "electronic",
    items: [
      { key: "dos", run_type: "ENERGY" },
      { key: "band", run_type: "ENERGY" },
      { key: "hirshfeld", run_type: "ENERGY" },
    ],
  },
  {
    id: "dynamic",
    items: [
      { key: "aimd", run_type: "MD" },
      { key: "vibrational", run_type: "VIBRATIONAL_ANALYSIS" },
    ],
  },
  {
    id: "reactivity",
    items: [
      { key: "neb", run_type: "BAND" },
      { key: "adsorption", run_type: "GEO_OPT" },
    ],
  },
  {
    id: "optical",
    items: [
      { key: "absorption", run_type: "TDDFPT" },
      { key: "emission", run_type: "TDDFPT" },
    ],
  },
  {
    id: "other",
    items: [{ key: "work_function", run_type: "ENERGY" }],
  },
];

/** 광학 물성(흡수/방출) — TDDFPT → DIAGONALIZATION 고정 안내 대상. */
export const OPTICAL_PROPERTIES: PropertyKey[] = ["absorption", "emission"];

export function isOptical(key?: string | null): boolean {
  return !!key && (OPTICAL_PROPERTIES as string[]).includes(key);
}

// ── DFT 옵션 선택지 (PlanRequest 필드와 1:1) ───────────────────────

export const FUNCTIONALS = ["PBE", "PBE0", "B3LYP", "BLYP", "SCAN", "HSE06"] as const;
export const BASIS_SETS = [
  "DZVP-MOLOPT-GTH",
  "TZVP-MOLOPT-GTH",
  "TZV2P-MOLOPT-GTH",
  "SZV-MOLOPT-GTH",
  "DZVP-MOLOPT-SR-GTH",
] as const;
/** 유사퍼텐셜 — PlanRequest.pot_file 로 전송 */
export const PSEUDOPOTENTIALS = [
  "GTH-PBE",
  "GTH-PBE0",
  "GTH-BLYP",
  "GTH-SCAN",
] as const;

export const SCF_ALGOS = ["OT", "DIAGONALIZATION"] as const;
export const MIXING_METHODS = ["BROYDEN_MIXING", "PULAY_MIXING", "DIRECT_P_MIXING"] as const;
export const OPTIMIZERS = ["BFGS", "CG", "LBFGS"] as const;
export const EPS_SCF_CHOICES = ["1.0E-5", "1.0E-6", "1.0E-7", "1.0E-8"] as const;

/** 옵션 폼 기본값 — PlanRequest 기본값(data-models §3)과 일치. */
export const DEFAULT_OPTIONS = {
  property: "" as string,
  functional: "PBE",
  basis_set: "DZVP-MOLOPT-GTH",
  pseudo: "GTH-PBE", // → pot_file
  cutoff: 400.0,
  rel_cutoff: 50.0,
  lsd: false, // RKS=false, UKS=true
  // SCF
  eps_scf: "1.0E-6",
  max_scf: 50 as number | null,
  scf_algo: "OT",
  mixing: "BROYDEN_MIXING", // → custom_options.mixing_method
  use_smear: false,
  smear_temp: 300.0,
  optimizer: "BFGS", // → custom_options.optimizer
} as const;
