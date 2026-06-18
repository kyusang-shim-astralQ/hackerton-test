// features/f3-inp/api.ts — f3-inp 도메인 fetch 래퍼 + MOCK 시드. 소유: f3 담당.
// 계약 단일 소스: docs/features/f3-inp/api.md, docs/contracts/data-models.md (InpRequest / GenerateInpResult)
import { apiFetch, MOCK } from "@/lib/api";
import type { AtomInfo, PlanStep, InpOptions, GeneratedFile } from "@/stores/types";

/** InpRequest (data-models §6). `lang` 없음. 필수 7필드 + 선택 필드. */
export interface InpRequest {
  atom_info: AtomInfo;
  steps: PlanStep[];
  property: string;
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
  custom_options?: Record<string, unknown>;
  eps_scf?: string;
  periodic?: string;
  max_scf?: number | null;
  ignore_scf_failure?: boolean;
  basis_file?: string | null;
  pot_file?: string | null;
  lsd?: boolean;
  added_mos?: string | null;
  /** len > 1 이면 구조별 개별 .inp 생성 분기 */
  multi_atom_info?: AtomInfo[] | null;
}

/** GenerateInpResult (data-models §8). */
export interface GenerateInpResult {
  status: string;
  generated_files: GeneratedFile[];
}

/**
 * POST /generate-inp — 선택 스텝 각각의 .inp 텍스트를 생성한다.
 *
 * ★ 반드시 POST. method를 명시하지 않으면 본문-기반 자동 POST(lib/api.ts)가 안전망이지만,
 *   계약(api.md)대로 method를 명시해 GET+body 에러("Request with GET/HEAD method cannot have body")를 원천 차단한다.
 */
export async function generateInp(req: InpRequest): Promise<GenerateInpResult> {
  if (MOCK) return mockGenerateInp(req);
  return apiFetch<GenerateInpResult>("/generate-inp", { method: "POST", json: req });
}

// ───────────────────────── MOCK (NEXT_PUBLIC_MOCK=1) ─────────────────────────

/** filename에서 .cif 제거 + 공백→_ 치환 (api.md base 규칙) */
function baseName(filename: string): string {
  return filename.replace(/\.cif$/i, "").replace(/\s+/g, "_");
}

/** 활성 스텝 필터: selected !== false && exclude !== true (api.md 생성 규칙 1) */
export function activeSteps(steps: PlanStep[]): PlanStep[] {
  return steps.filter((s) => s.selected !== false && s.exclude !== true);
}

/** 단일 스텝 .inp 텍스트 렌더(목). 실제 백엔드 schema_engine 렌더를 흉내낸 결정론적 텍스트. */
function renderMockInp(
  struct: AtomInfo,
  step: PlanStep,
  idx: number,
  req: InpRequest,
): string {
  const runType = step.run_type ?? "ENERGY";
  const project = `step${idx}`;
  const cell = struct.full_cell_text?.trim()
    ? struct.full_cell_text
    : `ABC ${(struct.cell ?? [10, 10, 10]).join(" ")}`;
  const coord = struct.full_coord_text?.trim()
    ? struct.full_coord_text
    : (struct.atoms ?? [])
        .map((a) => `${a.element} ${a.x} ${a.y} ${a.z}`)
        .join("\n      ") || `${(struct.elements ?? ["X"])[0]} 0.0 0.0 0.0`;
  // 다중 분기 구조별 우선 키(use_smear/smear_temp)는 AtomInfo 계약상 선택적이며 타입에 없을 수 있어
  // 방어적으로 읽는다(api.md: struct["use_smear"]가 존재하면 req 값보다 우선).
  const sx = struct as unknown as { use_smear?: boolean; smear_temp?: number };
  const useSmear = typeof sx.use_smear === "boolean" ? sx.use_smear : req.use_smear ?? false;
  const smearTemp = sx.smear_temp ?? req.smear_temp ?? 300.0;
  const motion =
    runType === "GEO_OPT" || runType === "CELL_OPT"
      ? `&MOTION\n  &GEO_OPT\n    OPTIMIZER BFGS\n    MAX_ITER 200\n  &END GEO_OPT\n&END MOTION\n`
      : "";
  return (
    `&GLOBAL\n` +
    `  PROJECT ${project}\n` +
    `  RUN_TYPE ${runType}\n` +
    `&END GLOBAL\n` +
    `&FORCE_EVAL\n` +
    `  METHOD QS\n` +
    `  &DFT\n` +
    `    BASIS_SET_FILE_NAME ${req.basis_file ?? "BASIS_MOLOPT"}\n` +
    `    POTENTIAL_FILE_NAME ${req.pot_file ?? "GTH_POTENTIALS"}\n` +
    `    &QS\n      METHOD ${req.method ?? "GPW"}\n    &END QS\n` +
    `    &MGRID\n      CUTOFF ${req.cutoff}\n      REL_CUTOFF ${req.rel_cutoff}\n    &END MGRID\n` +
    `    &XC\n      &XC_FUNCTIONAL ${req.functional}\n      &END XC_FUNCTIONAL\n    &END XC\n` +
    `    &SCF\n      SCF_GUESS ATOMIC\n      EPS_SCF ${req.eps_scf ?? "1.0E-6"}\n      MAX_SCF ${req.max_scf ?? 50}\n` +
    (useSmear
      ? `      &SMEAR\n        METHOD FERMI_DIRAC\n        ELECTRONIC_TEMPERATURE ${smearTemp}K\n      &END SMEAR\n`
      : "") +
    `    &END SCF\n` +
    `  &END DFT\n` +
    `  &SUBSYS\n` +
    `    &CELL\n      ${cell}\n      PERIODIC ${req.periodic ?? "XYZ"}\n    &END CELL\n` +
    `    &COORD\n      ${coord}\n    &END COORD\n` +
    `  &END SUBSYS\n` +
    `&END FORCE_EVAL\n` +
    motion
  );
}

/** 목 /generate-inp — 단일/다중 분기 + 필터 후 1-based 재인덱싱을 백엔드와 동일하게 흉내. */
export function mockGenerateInp(req: InpRequest): GenerateInpResult {
  const steps = activeSteps(req.steps ?? []);
  const multi =
    Array.isArray(req.multi_atom_info) && req.multi_atom_info.length > 1
      ? req.multi_atom_info
      : null;

  const generated_files: GeneratedFile[] = [];
  if (multi) {
    for (const struct of multi) {
      const base = baseName(struct.filename ?? "structure.cif");
      steps.forEach((step, i) => {
        generated_files.push({
          filename: `${base}_step${i + 1}.inp`,
          content: renderMockInp(struct, step, i + 1, req),
        });
      });
    }
  } else {
    steps.forEach((step, i) => {
      generated_files.push({
        filename: `step${i + 1}.inp`,
        content: renderMockInp(req.atom_info, step, i + 1, req),
      });
    });
  }

  return { status: "success", generated_files };
}

// ──────────────────── 상류(f1/f2) 미완성 시 단독 개발용 시드 ────────────────────
// f2가 없으면 store.planResult가 비어있다. 이 시드로 화면을 단독 구동한다(idle 금지).
// data-models §1/§4 목업(정상 경로 + 선택/제외/경로옵션)을 그대로 따른다.

export const SEED_ATOM_INFO: AtomInfo = {
  filename: "Si.cif",
  atom_count: 2,
  atoms: [
    { element: "Si", x: 0.0, y: 0.0, z: 0.0 },
    { element: "Si", x: 1.3575, y: 1.3575, z: 1.3575 },
  ],
  elements: ["Si"],
  element_counts: { Si: 2 },
  element_indices: { Si: [1, 2] },
  cell: [5.43, 5.43, 5.43],
  cell_angles: [90.0, 90.0, 90.0],
  volume: 160.1,
  full_coord_text: "Si 0.0 0.0 0.0\n      Si 1.3575 1.3575 1.3575",
  full_cell_text: "ABC 5.43 5.43 5.43\n      ALPHA_BETA_GAMMA 90.0 90.0 90.0",
  use_scaled: false,
  smear_recommended: false,
  periodic: "XYZ",
  formula: "Si2",
};

export const SEED_STEPS: PlanStep[] = [
  {
    step_idx: 1,
    step_name: "구조 최적화 (Geometry Optimization)",
    importance: "필수",
    run_type: "GEO_OPT",
    objective: "바닥 상태 평형 구조 확보",
    physics_reason: "초기 CIF 좌표는 실험적 불확실성을 포함하므로 힘이 수렴하도록 원자 위치를 완화합니다.",
    inp_options: [
      "FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6",
      "FORCE_EVAL/DFT/SCF/MAX_SCF 50",
      "MOTION/GEO_OPT/OPTIMIZER BFGS",
      "MOTION/GEO_OPT/MAX_ITER 200",
    ],
    selected: true,
    exclude: false,
  },
  {
    step_idx: 2,
    step_name: "단일점 에너지 (Single Point)",
    importance: "권장",
    run_type: "ENERGY",
    objective: "정밀 전자 구조/총에너지 산출",
    physics_reason: "최적화된 구조에서 더 엄격한 SCF 수렴으로 정확한 에너지를 얻습니다.",
    inp_options: ["FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-7"],
    selected: true,
  },
  {
    step_idx: 3,
    step_name: "상태밀도 (DOS)",
    importance: "선택",
    run_type: "ENERGY",
    objective: "전자 상태밀도 분석",
    inp_options: ["FORCE_EVAL/DFT/PRINT/PDOS/NLUMO -1"],
    selected: true,
  },
];

export const SEED_OPTIONS: InpOptions = {
  property: "geo_opt",
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
  eps_scf: "1.0E-6",
  periodic: "XYZ",
};
