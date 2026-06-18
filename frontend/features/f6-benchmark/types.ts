// features/f6-benchmark/types.ts — 벤치마크 데이터 계약 (data-models §18·19·20)
// 단일 소스: docs/contracts/data-models.md, docs/features/f6-benchmark/api.md
// shared stores/types.ts 의 BenchmarkStatus(축약형)와 별개로, f6 전용 정밀 타입을 여기에 둔다.

/** 레벨별 status (BenchmarkLevelReport.status) */
export type LevelStatus =
  | "Pending"
  | "Running"
  | "Recovering..."
  | "SUCCESS"
  | "INCORRECT"
  | "FAILURE"
  | "Skipped"
  | "Aborted";

/** 전역 status (BenchmarkReport.status) */
export type BenchmarkGlobalStatus =
  | "Idle"
  | "Running"
  | "Finished"
  | "Failure"
  | "Stopped";

/** BenchmarkLevelReport (data-models §20) */
export interface BenchmarkLevelReport {
  level: number; // 1~12
  status: LevelStatus;
  agent_energy: number | null;
  official_energy: number | null;
  diff: number | null; // 상대 오차 %
  message: string;
  healing_count?: number;
  last_diag?: string;
}

/** BenchmarkReport (data-models §19) — GET /api/benchmark/status 응답 */
export interface BenchmarkReport {
  status: BenchmarkGlobalStatus | string;
  current_level: number; // 0=시작 전, 1~12
  total_levels: number; // 12 고정
  reports: BenchmarkLevelReport[]; // 12 슬롯
  logs: string[];
  logs_pos?: number;
}

/** BenchmarkRequest (data-models §18) — POST /api/benchmark/run 본문 */
export interface BenchmarkRequest {
  levels: number[]; // 비면 1~12 전체
  session_id?: string | null;
  basis_set: string;
  cutoff: number;
  rel_cutoff: number;
  functional: string;
  method?: string;
  scf_algo?: string;
  charge?: number;
  multiplicity?: number;
  use_smear?: boolean;
  smear_temp?: number;
  property?: string;
  custom_options?: Record<string, unknown>;
  eps_scf?: string;
  periodic?: string;
  max_scf?: number | null;
  ignore_scf_failure?: boolean;
  basis_file?: string | null;
  pot_file?: string | null;
  lsd?: boolean;
  added_mos?: string | null;
}

/** run/stop 공통 응답 */
export interface BenchmarkActionResponse {
  status: string; // "success" | "error"
  message: string;
}

export const TOTAL_LEVELS = 12;

/**
 * LEVEL_TO_PROPERTY (data-models §18·api.md §2) — 프런트 UI 순서와 1:1.
 * 1 geo_opt … 12 hirshfeld.
 */
export const LEVEL_TO_PROPERTY: Record<number, string> = {
  1: "geo_opt",
  2: "energy",
  3: "dos",
  4: "band",
  5: "aimd",
  6: "vibrational",
  7: "neb",
  8: "adsorption",
  9: "absorption",
  10: "emission",
  11: "work_function",
  12: "hirshfeld",
};

/**
 * 가동 전 화면이 채울 기본 DFT 파라미터 (f2 DEFAULT_OPTIONS 동등 상수).
 * 벤치마크는 구조 업로드/플랜 없이 단독 실행되므로 atom_info/steps 없이 이 기본값으로 run 한다.
 * 값 출처: data-models §18 기본값 + SubmitRequest(§9) 기본값.
 */
export const DEFAULT_OPTIONS: Omit<BenchmarkRequest, "levels"> = {
  basis_set: "DZVP-MOLOPT-GTH",
  cutoff: 400.0,
  rel_cutoff: 50.0,
  functional: "PBE",
  method: "GPW",
  scf_algo: "OT",
  charge: 0,
  multiplicity: 1,
  use_smear: false,
  smear_temp: 300.0,
  property: "energy",
  custom_options: {},
  eps_scf: "1.0E-6",
  periodic: "XYZ",
  max_scf: null,
  ignore_scf_failure: false,
  lsd: false,
};
