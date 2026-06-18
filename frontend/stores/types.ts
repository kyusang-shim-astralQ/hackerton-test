// stores/types.ts — wizard-store 공유 타입 (계약: docs/contracts/data-models.md)
// 공유 골격: 기능은 자기 슬라이스 필드만 읽고 쓰며 이 파일/슬라이스 골격은 수정하지 않는다.

/** AtomInfo (data-models §1) — 선택적 키는 .get/?. 으로 방어적으로 읽을 것 */
export interface AtomInfo {
  filename: string;
  atom_count: number;
  atoms: { element: string; x: number; y: number; z: number }[];
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
  // 표시 편의용(파생) — 백엔드 계약 외, 프런트 로컬 표시
  formula?: string;
  spacegroup?: string;
  phase?: string;
  density?: number;
}

/** PlanStep (data-models §4) */
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

/** PlanResult (data-models §5) */
export interface PlanResult {
  expert_tip: string;
  steps: PlanStep[];
  atom_info: AtomInfo;
}

/** DFT 옵션 (PlanRequest/InpRequest 공통 필드, data-models §3/§6) */
export interface InpOptions {
  property?: string;
  basis_set?: string;
  cutoff?: number;
  rel_cutoff?: number;
  functional?: string;
  method?: string;
  scf_algo?: string;
  charge?: number;
  multiplicity?: number;
  use_smear?: boolean;
  smear_temp?: number;
  eps_scf?: string;
  periodic?: string;
  max_scf?: number | null;
  lsd?: boolean;
  added_mos?: string | null;
  custom_options?: Record<string, unknown>;
}

/** GeneratedFile (data-models §7) */
export interface GeneratedFile {
  filename: string;
  content: string;
  validation_logs?: unknown[] | null;
}

/** StepHistory (data-models §12) — 차트/모니터용 시계열 */
export interface StepHistory {
  run_type: string;
  energy: number[];
  scf: number[];
  change?: number[];
  macro_energy?: number[];
  macro_conv?: number[];
  property?: string;
}

/** 단일 하위작업 상태 (다중구조 집계용) */
export interface SubJob {
  filename: string;
  job_key: string;
  status?: string;
}

/** 실시간 잡 상태 (JobStatus/JobLiveStatusResponse 축약, data-models §11/§15) */
export interface JobLive {
  status: string;
  active_step?: number;
  total_steps?: number;
  message?: string;
  healing_history?: string[];
  logs?: string[];
  step_histories?: Record<string, StepHistory>;
  is_multi?: boolean;
  sub_jobs?: SubJob[];
}

/** 벤치마크 상태 (f6) */
export interface BenchmarkStatus {
  status: string;
  reports: unknown[];
}
