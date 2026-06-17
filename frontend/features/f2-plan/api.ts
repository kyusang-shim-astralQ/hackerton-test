// features/f2-plan/api.ts — f2-plan fetch 래퍼 + 목 폴백.
// 단일 소스: docs/features/f2-plan/api.md (POST /generate-plan), docs/contracts/data-models.md.
// 실제 백엔드(:8000)로 호출. NEXT_PUBLIC_MOCK=1 또는 키 없음/에러 시 PlanResult 목으로 흐름 유지.

import { apiFetch, IS_MOCK, ApiError } from "@/lib/api";
import type { AtomInfo, InpOptions, PlanResult, PlanStep } from "@/stores/types";

/** PlanRequest 본문 (api.md 필수 6필드 + 선택). active_tokens 는 동적 속성이라 넣지 않음. */
export interface PlanRequestBody {
  atom_info: AtomInfo;
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
  lang?: string;
  eps_scf?: string;
  periodic?: string;
  max_scf?: number | null;
  ignore_scf_failure?: boolean;
  basis_file?: string | null;
  pot_file?: string | null;
  lsd?: boolean;
  added_mos?: string | null;
}

/**
 * store 의 구조/물성/DFT옵션을 PlanRequest 로 조립.
 * 대용량 본문(CIF content 등)은 비용 절약 위해 제거 후 전송(api.md 지침).
 * atom_info 정규 키는 그대로 보내 SSOT 에코를 보존한다.
 */
export function buildPlanRequest(args: {
  atomInfo: AtomInfo;
  property: string;
  opts: InpOptions;
  lang: string;
}): PlanRequestBody {
  const { atomInfo, property, opts, lang } = args;

  // 비계약/대용량 키 방어 제거(content, cif_content 등) — atom_info 정규 키는 유지.
  const atom_info = stripHeavy(atomInfo);

  const custom_options: Record<string, unknown> = {
    ...(opts.custom_options ?? {}),
  };
  // 폼의 최적화기 선택을 custom_options 로 전달(스텝 옵션 보강용).
  if (opts.optimizer) custom_options.optimizer = opts.optimizer;

  return {
    atom_info,
    property,
    basis_set: opts.basis_set,
    cutoff: opts.cutoff,
    rel_cutoff: opts.rel_cutoff,
    functional: opts.functional,
    method: opts.method ?? "GPW",
    scf_algo: opts.scf_algo ?? "OT",
    charge: opts.charge ?? 0,
    multiplicity: opts.multiplicity ?? 1,
    use_smear: opts.use_smear ?? false,
    smear_temp: opts.smear_temp ?? 300.0,
    custom_options,
    lang,
    eps_scf: opts.eps_scf ?? "1.0E-6",
    periodic: opts.periodic ?? atomInfo.periodic ?? "XYZ",
    max_scf: opts.max_scf ?? null,
    ignore_scf_failure: opts.ignore_scf_failure ?? false,
    basis_file: null,
    pot_file: null,
    lsd: opts.lsd ?? false,
    added_mos: opts.added_mos ?? null,
  };
}

/** atom_info 에서 대용량/비계약 키 제거(전송 비용 절약). 정규 키는 보존. */
function stripHeavy(info: AtomInfo): AtomInfo {
  const clone = { ...info } as AtomInfo & Record<string, unknown>;
  for (const k of ["content", "cif_content", "raw", "raw_text"]) {
    if (k in clone) delete clone[k];
  }
  return clone;
}

/**
 * POST /generate-plan. 실패/목 모드 시 PlanResult 목으로 폴백(흐름 유지).
 * graceful degradation: api.md 상 파싱 실패도 200 + steps:[] 이므로, 네트워크/키 에러만 목으로 대체.
 */
export async function generatePlan(
  req: PlanRequestBody
): Promise<PlanResult> {
  if (IS_MOCK) return mockPlanResult(req);
  try {
    const data = await apiFetch<PlanResult>("/generate-plan", { json: req });
    // 계약: atom_info 는 요청 에코. 누락 시 SSOT 보존을 위해 보강.
    if (!data.atom_info) data.atom_info = req.atom_info;
    return data;
  } catch (e) {
    // 키 없음/500/네트워크 → 목으로 폴백(데모 흐름 끊김 방지).
    if (e instanceof ApiError || e instanceof TypeError) {
      return mockPlanResult(req);
    }
    throw e;
  }
}

/** data-models.md PlanResult 형태의 목 — 물성에 맞춰 다단계 steps + expert_tip. */
export function mockPlanResult(req: PlanRequestBody): PlanResult {
  const en = req.lang === "en";
  const prop = (req.property || "geo_opt").toLowerCase();
  const elements = req.atom_info?.elements ?? [];
  const sys = elements.join("") || req.atom_info?.filename || "system";

  const eps = req.eps_scf ?? "1.0E-6";
  const optimizer = (req.custom_options?.optimizer as string) || "BFGS";

  const initStep: PlanStep = {
    step_idx: 1,
    step_name: en ? "Wavefunction Initialization (SCF)" : "단일점 파동함수 초기화",
    importance: en ? "Required" : "필수",
    run_type: "ENERGY",
    physics_reason: en
      ? "Obtain a stable initial density before geometry/property steps to avoid SCF divergence."
      : "후속 단계 전에 안정적인 초기 밀도를 확보해 SCF 발산을 방지합니다.",
    objective: en ? "Initial SCF convergence" : "초기 SCF 수렴",
    description: en
      ? `${req.scf_algo ?? "OT"} with target EPS_SCF=${eps}.`
      : `${req.scf_algo ?? "OT"} 알고리즘으로 EPS_SCF=${eps} 까지 수렴.`,
    inp_options: [
      "FORCE_EVAL/DFT/SCF/SCF_GUESS ATOMIC",
      `FORCE_EVAL/DFT/SCF/EPS_SCF ${eps}`,
      `FORCE_EVAL/DFT/SCF/MAX_SCF ${req.max_scf ?? 50}`,
    ],
    selected: true,
    exclude: false,
  };

  // 물성별 메인 스텝.
  const mainByProp: Record<string, PlanStep> = {
    geo_opt: {
      step_idx: 2,
      step_name: en ? "Geometry Optimization" : "기하 구조 최적화",
      importance: en ? "Required" : "필수",
      run_type: "GEO_OPT",
      physics_reason: en
        ? "Relax atomic forces to find the equilibrium ground-state geometry."
        : "원자에 작용하는 힘을 최소화해 평형 바닥상태 구조를 찾습니다.",
      objective: en ? "Energy-minimized structure" : "에너지 최소 구조 탐색",
      description: en
        ? `${optimizer} optimizer until forces converge.`
        : `${optimizer} 옵티마이저로 힘이 임계값 이하로 수렴할 때까지 이완.`,
      inp_options: [
        `MOTION/GEO_OPT/OPTIMIZER ${optimizer}`,
        "MOTION/GEO_OPT/MAX_ITER 200",
        "MOTION/GEO_OPT/MAX_FORCE 4.5E-4",
      ],
      selected: true,
      exclude: false,
    },
    single_point: {
      step_idx: 2,
      step_name: en ? "Single Point Energy" : "단일점 에너지",
      importance: en ? "Required" : "필수",
      run_type: "ENERGY",
      physics_reason: en
        ? "Evaluate total energy at the fixed input geometry."
        : "입력 구조에서 총에너지를 평가합니다.",
      objective: en ? "Total energy" : "총에너지 산출",
      description: en
        ? "Converged SCF total energy at fixed geometry."
        : "고정 구조에서 수렴된 SCF 총에너지.",
      inp_options: [`FORCE_EVAL/DFT/SCF/EPS_SCF ${eps}`],
      selected: true,
      exclude: false,
    },
  };

  const dosStep: PlanStep = {
    step_idx: 3,
    step_name: en ? "DOS / PDOS" : "상태밀도(DOS/PDOS)",
    importance: en ? "Recommended" : "권장",
    run_type: "ENERGY",
    physics_reason: en
      ? "Project density of states to analyze electronic structure."
      : "상태밀도를 투영해 전자 구조를 분석합니다.",
    objective: en ? "Electronic DOS" : "전자 상태밀도",
    description: en ? "Print PDOS per element." : "원소별 PDOS 출력.",
    inp_options: ["FORCE_EVAL/DFT/PRINT/PDOS/NLUMO -1"],
    selected: true,
    exclude: false,
  };

  const opticalStep: PlanStep = {
    step_idx: 2,
    step_name: en ? "TDDFPT Excitations" : "TDDFPT 들뜸 상태",
    importance: en ? "Required" : "필수",
    run_type: "TDDFPT",
    physics_reason: en
      ? "Compute excited states via linear-response TDDFPT (requires DIAGONALIZATION)."
      : "선형응답 TDDFPT 로 들뜸 상태를 계산(DIAGONALIZATION 필요).",
    objective: en ? "Absorption/emission spectrum" : "흡수/방출 스펙트럼",
    description: en
      ? "DIAGONALIZATION SCF + TDDFPT Davidson solver."
      : "DIAGONALIZATION SCF + TDDFPT Davidson 솔버.",
    inp_options: [
      "FORCE_EVAL/DFT/SCF/SCF_GUESS ATOMIC",
      "FORCE_EVAL/DFT/SCF/MAX_SCF 100",
      "FORCE_EVAL/PROPERTIES/TDDFPT/NSTATES 20",
    ],
    selected: true,
    exclude: false,
  };

  let steps: PlanStep[];
  if (prop === "absorption" || prop === "emission") {
    steps = [initStep, opticalStep];
  } else if (prop === "dos" || prop === "band") {
    steps = [initStep, mainByProp.geo_opt, dosStep];
  } else if (prop === "single_point") {
    steps = [initStep, mainByProp.single_point];
  } else {
    steps = [initStep, mainByProp[prop] ?? mainByProp.geo_opt];
  }

  const tipKo =
    elements.length && /(Ti|Fe|Co|Ni|Cu|Mn|Cr|V|W|Mo)/.test(elements.join(""))
      ? `${sys} 는 전이금속을 포함해 SCF 수렴이 까다롭습니다. SMEAR 활성화와 충분한 cutoff(${req.cutoff} Ry)를 권장합니다.`
      : `${sys} 시스템은 ${req.functional} / ${req.basis_set} 조합으로 안정적으로 수렴할 것으로 보입니다. 다단계 플랜으로 초기 밀도를 먼저 확보합니다.`;
  const tipEn =
    elements.length && /(Ti|Fe|Co|Ni|Cu|Mn|Cr|V|W|Mo)/.test(elements.join(""))
      ? `${sys} contains transition metals; SCF can be tricky. Enable SMEAR and use a sufficient cutoff (${req.cutoff} Ry).`
      : `${sys} should converge stably with ${req.functional} / ${req.basis_set}. The multi-step plan secures the initial density first.`;

  return {
    expert_tip: en ? tipEn : tipKo,
    steps,
    atom_info: req.atom_info, // SSOT 에코
  };
}

/** 데모/시드용 atom_info (f1 미완성이어도 단독 동작 — api.md 정상 경로 목업). */
export const SEED_ATOM_INFO: AtomInfo = {
  filename: "TiO2_anatase.cif",
  atom_count: 6,
  atoms: [
    { element: "Ti", x: 0.0, y: 0.0, z: 0.0 },
    { element: "Ti", x: 1.8965, y: 1.8965, z: 4.7795 },
    { element: "O", x: 0.0, y: 0.0, z: 2.0762 },
    { element: "O", x: 0.0, y: 0.0, z: -2.0762 },
    { element: "O", x: 1.8965, y: 1.8965, z: 2.7033 },
    { element: "O", x: 1.8965, y: 1.8965, z: 6.8557 },
  ],
  elements: ["Ti", "O"],
  element_counts: { Ti: 2, O: 4 },
  element_indices: { Ti: [1, 2], O: [3, 4, 5, 6] },
  cell: [3.793, 3.793, 9.559],
  cell_angles: [90.0, 90.0, 90.0],
  volume: 137.52,
  full_coord_text: "Ti 0.0 0.0 0.0\nO 1.9 0.0 0.0",
  full_cell_text: "ABC 3.793 3.793 9.559\nALPHA_BETA_GAMMA 90 90 90",
  use_scaled: false,
  smear_recommended: true,
  smear_reason_en: "Contains transition metal; SMEAR recommended.",
  smear_reason_ko: "전이금속 포함 — SMEAR 권장.",
  periodic: "XYZ",
};
