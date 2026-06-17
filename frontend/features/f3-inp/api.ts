// features/f3-inp/api.ts — f3-inp HTTP 래퍼 + 목/시드.
// 단일 소스: docs/features/f3-inp/api.md (POST /generate-inp), docs/contracts/data-models.md.
// ★ 호출은 반드시 POST — apiFetch 에 method:"POST" 명시(본문-기반 자동 POST 가 안전망이지만 명시).

import { apiFetch, IS_MOCK } from "@/lib/api";
import type {
  AtomInfo,
  GeneratedFile,
  InpOptions,
  PlanStep,
} from "@/stores/types";

/** data-models.md §6 InpRequest — /generate-inp 요청 본문(계약 그대로, lang 없음). */
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
  multi_atom_info?: AtomInfo[] | null;
}

/** data-models.md §8 GenerateInpResult — /generate-inp 응답. */
export interface GenerateInpResult {
  status: string;
  generated_files: GeneratedFile[];
}

/** 단일 규칙(data-models §4): selected !== false && exclude !== true 인 스텝만 통과. */
export function isStepActive(step: PlanStep): boolean {
  return step.selected !== false && step.exclude !== true;
}

/**
 * InpRequest 조립 헬퍼 — store 의 옵션/구조/스텝을 계약 본문으로 변환.
 * 필수 7필드(atom_info/steps/property/basis_set/cutoff/rel_cutoff/functional) + 선택 필드.
 * 다중-CIF면 multi_atom_info 로 함께 전달(백엔드가 구조별 × 스텝별 .inp 생성).
 */
export function buildInpRequest(args: {
  atomInfo: AtomInfo;
  steps: PlanStep[];
  property: string;
  options: InpOptions;
  multiAtomInfo?: AtomInfo[] | null;
}): InpRequest {
  const { atomInfo, steps, property, options, multiAtomInfo } = args;
  const multi =
    multiAtomInfo && multiAtomInfo.length > 1 ? multiAtomInfo : null;
  return {
    atom_info: atomInfo,
    steps,
    property,
    basis_set: options.basis_set,
    cutoff: options.cutoff,
    rel_cutoff: options.rel_cutoff,
    functional: options.functional,
    method: options.method,
    scf_algo: options.scf_algo,
    charge: options.charge,
    multiplicity: options.multiplicity,
    use_smear: options.use_smear,
    smear_temp: options.smear_temp,
    custom_options: options.custom_options ?? {},
    eps_scf: options.eps_scf,
    periodic: options.periodic,
    max_scf: options.max_scf ?? null,
    ignore_scf_failure: options.ignore_scf_failure,
    // basis_file/pot_file 는 공유 InpOptions 에 없는 선택 필드 — 계약 기본값 null.
    basis_file: null,
    pot_file: null,
    lsd: options.lsd,
    added_mos: options.added_mos ?? null,
    multi_atom_info: multi,
  };
}

/** 다중 분기 base 파일명 규칙(api.md §생성규칙 3): .cif 제거 + 공백→_. */
function baseName(filename: string): string {
  return filename.replace(/\.cif$/i, "").replace(/\s+/g, "_");
}

/** NEXT_PUBLIC_MOCK=1 일 때 GenerateInpResult 형태 목 생성(백엔드 build_full_inp 흉내, 결정론적). */
function mockGenerateInp(req: InpRequest): GenerateInpResult {
  const active = req.steps.filter(isStepActive);
  const renderOne = (step: PlanStep, i: number, struct: AtomInfo): string => {
    const runType = step.run_type || "ENERGY";
    const project = `step${i}`;
    const cellText =
      struct.full_cell_text?.trim() ||
      `ABC ${(struct.cell ?? [10, 10, 10]).join(" ")}`;
    const coordText = struct.full_coord_text?.trim() || "# (no coords)";
    return [
      "&GLOBAL",
      `  PROJECT ${project}`,
      `  RUN_TYPE ${runType}`,
      "&END GLOBAL",
      "&FORCE_EVAL",
      `  METHOD ${req.method || "QS"}`,
      "  &DFT",
      `    BASIS_SET_FILE_NAME ${req.basis_file || "BASIS_MOLOPT"}`,
      "    &MGRID",
      `      CUTOFF ${req.cutoff}`,
      `      REL_CUTOFF ${req.rel_cutoff}`,
      "    &END MGRID",
      "    &SCF",
      `      EPS_SCF ${req.eps_scf || "1.0E-6"}`,
      "    &END SCF",
      "    &XC",
      "      &XC_FUNCTIONAL " + (req.functional || "PBE"),
      "      &END XC_FUNCTIONAL",
      "    &END XC",
      "  &END DFT",
      "  &SUBSYS",
      "    &CELL",
      `      ${cellText.replace(/\n/g, "\n      ")}`,
      "    &END CELL",
      "    &COORD",
      `      ${coordText.replace(/\n/g, "\n      ")}`,
      "    &END COORD",
      "  &END SUBSYS",
      "&END FORCE_EVAL",
      "",
      `# [MOCK] basis_set=${req.basis_set} · property=${req.property}`,
    ].join("\n");
  };

  const files: GeneratedFile[] = [];
  const multi = req.multi_atom_info;
  if (multi && multi.length > 1) {
    for (const struct of multi) {
      const base = baseName(struct.filename ?? "structure");
      active.forEach((step, idx) => {
        files.push({
          filename: `${base}_step${idx + 1}.inp`,
          content: renderOne(step, idx + 1, struct),
        });
      });
    }
  } else {
    active.forEach((step, idx) => {
      files.push({
        filename: `step${idx + 1}.inp`,
        content: renderOne(step, idx + 1, req.atom_info),
      });
    });
  }
  return { status: "success", generated_files: files };
}

/**
 * POST /generate-inp — 실제 백엔드(:8000) 또는 목.
 * ★ method:"POST" 명시(GET+body 에러 방지). 결정론적·클러스터 불필요.
 */
export async function generateInp(
  req: InpRequest
): Promise<GenerateInpResult> {
  if (IS_MOCK) {
    // 약간의 지연으로 로딩 UX 유지
    await new Promise((r) => setTimeout(r, 350));
    return mockGenerateInp(req);
  }
  return apiFetch<GenerateInpResult>("/generate-inp", {
    method: "POST",
    json: req,
  });
}

/** f2 미완성/단독 개발용 시드 플랜(data-models.md PlanStep 목업). */
export const SEED_STEPS: PlanStep[] = [
  {
    step_idx: 1,
    step_name: "Geometry Optimization",
    importance: "필수",
    run_type: "GEO_OPT",
    objective: "바닥 상태 평형 구조 확보",
    physics_reason:
      "초기 CIF 좌표는 실험적 불확실성을 포함하므로 힘이 수렴하도록 원자 위치를 완화합니다.",
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
    step_name: "Single Point Energy (SCF)",
    importance: "권장",
    run_type: "ENERGY",
    objective: "최적 구조의 전자 에너지 계산",
    physics_reason: "수렴된 구조에서 정밀한 SCF 에너지를 얻습니다.",
    inp_options: ["FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-7"],
    selected: true,
  },
  {
    step_idx: 3,
    step_name: "Band Structure",
    importance: "선택",
    run_type: "ENERGY",
    objective: "밴드 구조 산출",
    inp_options: [],
    selected: true,
  },
  {
    step_idx: 4,
    step_name: "Density of States (DOS)",
    importance: "선택",
    run_type: "ENERGY",
    objective: "상태 밀도(DOS) 산출",
    inp_options: [],
    selected: true,
  },
];

/** f1 미완성/단독 개발용 시드 구조(AtomInfo 정상 경로 목업). */
export const SEED_ATOM_INFO: AtomInfo = {
  filename: "Si.cif",
  atom_count: 2,
  atoms: [
    { element: "Si", x: 0.0, y: 0.0, z: 0.0 },
    { element: "Si", x: 1.3575, y: 1.3575, z: 1.3575 },
  ],
  elements: ["Si"],
  element_counts: { Si: 2 },
  cell: [5.43, 5.43, 5.43],
  cell_angles: [90.0, 90.0, 90.0],
  full_coord_text: "Si 0.0 0.0 0.0\nSi 1.3575 1.3575 1.3575",
  full_cell_text: "ABC 5.43 5.43 5.43\nALPHA_BETA_GAMMA 90.0 90.0 90.0",
  use_scaled: false,
};

/** f2 미완성 시 옵션 시드(InpRequest 필수 DFT 파라미터). */
export const SEED_OPTIONS: InpOptions = {
  basis_set: "DZVP-MOLOPT-GTH",
  cutoff: 400.0,
  rel_cutoff: 50.0,
  functional: "PBE",
  method: "GPW",
  scf_algo: "OT",
  eps_scf: "1.0E-6",
  periodic: "XYZ",
};
