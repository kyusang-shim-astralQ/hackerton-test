// stores/types.ts — cross-feature 데이터 계약 타입 (docs/contracts/data-models.md 미러).
// 기능 슬라이스/화면이 import 한다. 계약에 없는 필드를 임의 추가하지 않는다.

/** 단일 원자 좌표 (AtomInfo.atoms 요소) */
export interface Atom {
  element: string;
  x: number;
  y: number;
  z: number;
}

/** data-models.md §1 AtomInfo — 세 형태(정상/parse-failure/empty-CIF)가 키 집합이 다름. 선택 키는 ?. 로 방어. */
export interface AtomInfo {
  filename: string;
  atom_count: number;
  atoms: Atom[];
  elements: string[];
  element_counts: Record<string, number>;
  element_indices?: Record<string, number[]>;
  cell: number[]; // [a,b,c]
  cell_angles?: number[]; // [alpha,beta,gamma]
  volume?: number;
  full_coord_text: string;
  full_cell_text: string;
  use_scaled: boolean;
  smear_recommended?: boolean;
  smear_reason_ko?: string;
  smear_reason_en?: string;
  periodic?: string;
  error?: string;
  // 비계약 표시 메타(프런트 편의) — 선택
  spacegroup?: string;
  phase?: string;
}

/** data-models.md §2 AnalyzeCifResponse */
export interface AnalyzeCifResponse {
  status: string;
  filename: string;
  atom_info: AtomInfo;
  content_hash: string;
}

/** data-models.md §4 PlanStep — 기능 경계 교차 핵심 계약. selected/exclude 단일 규칙. */
export interface PlanStep {
  step_idx?: number;
  step_name: string;
  importance?: string;
  run_type: string;
  physics_reason?: string;
  objective?: string;
  description?: string;
  inp_options: string[] | Record<string, unknown>;
  selected?: boolean;
  exclude?: boolean;
  active_tokens?: string[];
}

/** data-models.md §5 PlanResult */
export interface PlanResult {
  expert_tip: string;
  steps: PlanStep[];
  atom_info: AtomInfo;
}

/** data-models.md §7 GeneratedFile */
export interface GeneratedFile {
  filename: string;
  content: string;
  validation_logs?: unknown[] | null;
}

/** data-models.md §10 SubmitJobResponse */
export interface SubmitJobResponse {
  status: string;
  directory: string;
  is_multi?: boolean;
  sub_jobs?: { filename: string; job_key: string }[];
  message: string;
}

/** data-models.md §12 StepHistory */
export interface StepHistory {
  run_type: string;
  energy: number[];
  scf: number[];
  change?: number[];
  macro_energy?: number[];
  macro_conv?: number[];
  property?: string;
}

/** data-models.md §11 JobStatus (+ §15 JobLiveStatusResponse 의 단일 응답) */
export interface JobStatus {
  status: string;
  active_step: number;
  total_steps: number;
  job_id: string | null;
  lang: string;
  message: string;
  healing_history: string[];
  updated_at: string;
  logs: string[];
  logs_pos?: number;
  current_scf_step?: number;
  energy_history?: number[];
  scf_history?: number[];
  macro_energy_history?: number[];
  macro_conv_history?: number[];
  scf_progress?: number;
  macro_progress?: number;
  tddft_progress?: {
    step: number;
    conv: number;
    converged_states: number;
    total_states: number;
  } | null;
  expert_tip?: string | null;
  steps: PlanStep[];
  step_histories: Record<string, StepHistory>;
  suite_params?: Record<string, unknown>;
  job_key?: string;
  // 다중 집계(JobLiveStatusResponse)
  is_multi?: boolean;
  sub_jobs?: { filename: string; job_key: string; status: string }[];
}

/** 런타임 잡 상태 묶음 (persist 제외) */
export interface JobLive {
  byKey: Record<string, JobStatus>;
  finished?: boolean;
}

/** data-models.md §17 ReportData */
export interface ReportData {
  status?: string;
  report: string;
  summary: Record<string, unknown>;
  is_multi?: boolean;
  excitations?: {
    state: number;
    energy_ev: number;
    wavelength_nm: number;
    osc_strength: number;
    is_dark: boolean;
    region: string;
  }[];
  spectrum?: {
    wavelengths: number[];
    intensities: number[];
    sigma_ev: number;
  };
}

/** DFT 옵션 폼 값 (PlanRequest/InpRequest/SubmitRequest 공유 파라미터, f2가 채움) */
export interface InpOptions {
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
  eps_scf?: string;
  periodic?: string;
  max_scf?: number | null;
  ignore_scf_failure?: boolean;
  lsd?: boolean;
  added_mos?: string | null;
  custom_options?: Record<string, unknown>;
  optimizer?: string;
}

/** data-models.md §20 BenchmarkLevelReport (말단 폴링) */
export interface BenchmarkLevelReport {
  level: number;
  property?: string;
  status: string;
  agent_energy?: number | string;
  official_energy?: number | string;
  diff?: number | string;
  healing_count?: number;
  message?: string;
}

/** data-models.md §19 BenchmarkReport */
export interface BenchmarkReport {
  status: string;
  current_level?: number;
  reports: BenchmarkLevelReport[];
  message?: string;
  logs?: string[];
}
