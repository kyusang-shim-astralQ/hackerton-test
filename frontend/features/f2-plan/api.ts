// features/f2-plan/api.ts — f2-plan fetch 래퍼 + 목/시드. 소유: f2 담당.
// 단일 소스: docs/features/f2-plan/api.md (POST /generate-plan), docs/contracts/data-models.md.
import { apiFetch, MOCK } from "@/lib/api";
import type { AtomInfo, PlanResult, InpOptions } from "@/stores/types";
import { isOptical } from "./constants";

/** PlanRequest 본문 (data-models §3). active_tokens 는 동적 속성이라 본문에 넣지 않음. */
export interface PlanRequest {
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
 * 대용량 좌표/셀 텍스트는 비용 절약을 위해 제거하고 전송한다(api.md §만들것3).
 * atom_info 의 다른 키(SSOT)는 그대로 둔다 — 응답에서 그대로 에코됨.
 */
function stripBulky(atom: AtomInfo): AtomInfo {
  const { full_coord_text: _c, full_cell_text: _f, ...rest } = atom;
  void _c;
  void _f;
  return rest as AtomInfo;
}

/** store 의 InpOptions + atom_info + property + lang 으로 PlanRequest 조립. */
export function buildPlanRequest(args: {
  atomInfo: AtomInfo;
  property: string;
  options: InpOptions & { pot_file?: string | null };
  lang: string;
}): PlanRequest {
  const { atomInfo, property, options, lang } = args;
  const optical = isOptical(property);
  return {
    atom_info: stripBulky(atomInfo),
    property,
    basis_set: options.basis_set ?? "DZVP-MOLOPT-GTH",
    cutoff: options.cutoff ?? 400.0,
    rel_cutoff: options.rel_cutoff ?? 50.0,
    functional: options.functional ?? "PBE",
    method: options.method ?? "GPW",
    // 광학(흡수/방출)은 TDDFPT → DIAGONALIZATION 고정(§만들것1)
    scf_algo: optical ? "DIAGONALIZATION" : options.scf_algo ?? "OT",
    charge: options.charge ?? 0,
    multiplicity: options.multiplicity ?? 1,
    use_smear: options.use_smear ?? false,
    smear_temp: options.smear_temp ?? 300.0,
    custom_options: options.custom_options ?? {},
    lang,
    eps_scf: options.eps_scf ?? "1.0E-6",
    periodic: options.periodic ?? atomInfo.periodic ?? "XYZ",
    max_scf: options.max_scf ?? null,
    lsd: options.lsd ?? false,
    added_mos: options.added_mos ?? null,
    pot_file: options.pot_file ?? null,
  };
}

/**
 * 시드 PlanResult (목 모드 / 키 없음 폴백).
 * data-models.md PlanResult 예시 형태(다단계 steps + expert_tip)를 따른다.
 * 응답의 atom_info 는 요청 atom_info 를 그대로 에코(SSOT 동기화 계약).
 */
export function seedPlanResult(req: PlanRequest): PlanResult {
  const en = req.lang === "en";
  const optical = isOptical(req.property);
  const sym = (req.atom_info.elements ?? []).join("") || "system";

  const baseSteps = [
    {
      step_idx: 1,
      step_name: en ? "Wavefunction initialization (single point)" : "단일점 파동함수 초기화",
      importance: en ? "Required" : "필수",
      run_type: "ENERGY",
      physics_reason: en
        ? "Secures a stable initial density before optimization to avoid divergence."
        : "구조 최적화 전 안정적인 초기 밀도를 확보해 발산을 방지합니다.",
      objective: en ? "Initial SCF convergence" : "초기 SCF 수렴",
      description: en
        ? "Converges the ground-state density with the chosen SCF algorithm and mixing."
        : "선택한 SCF 알고리즘과 혼합으로 기저 상태 밀도를 수렴시킵니다.",
      inp_options: [
        "FORCE_EVAL/DFT/SCF/SCF_GUESS ATOMIC",
        `FORCE_EVAL/DFT/SCF/EPS_SCF ${req.eps_scf ?? "1.0E-6"}`,
        `FORCE_EVAL/DFT/SCF/MAX_SCF ${req.max_scf ?? 50}`,
        "FORCE_EVAL/DFT/SCF/MIXING/METHOD BROYDEN_MIXING",
        "FORCE_EVAL/DFT/SCF/MIXING/ALPHA 0.3",
      ],
      selected: true,
      exclude: false,
    },
    {
      step_idx: 2,
      step_name: en ? "Geometry optimization" : "기하 구조 최적화",
      importance: en ? "Required" : "필수",
      run_type: "GEO_OPT",
      physics_reason: en
        ? "Minimizes forces on atoms to find the equilibrium structure."
        : "원자에 작용하는 힘을 최소화해 평형 구조를 찾습니다.",
      objective: en ? "Find minimum-energy structure" : "에너지 최소 구조 탐색",
      description: en
        ? "Relaxes the cell with the selected optimizer until forces converge."
        : "선택한 최적화기로 힘이 수렴할 때까지 셀을 이완합니다.",
      inp_options: [
        "MOTION/GEO_OPT/OPTIMIZER BFGS",
        "MOTION/GEO_OPT/MAX_ITER 200",
        "MOTION/GEO_OPT/MAX_FORCE 4.5E-4",
        "MOTION/GEO_OPT/RMS_FORCE 3.0E-4",
      ],
      selected: true,
      exclude: false,
    },
  ];

  const opticalStep = {
    step_idx: 3,
    step_name: en ? "TDDFPT excitations" : "TDDFPT 들뜸 계산",
    importance: en ? "Required" : "필수",
    run_type: "TDDFPT",
    physics_reason: en
      ? "Computes vertical excitation energies for the absorption/emission spectrum."
      : "흡수/방출 스펙트럼을 위한 수직 들뜸 에너지를 계산합니다.",
    objective: en ? "Excited-state spectrum" : "들뜬 상태 스펙트럼",
    description: en
      ? "Runs Davidson TDDFPT on the converged ground state (DIAGONALIZATION SCF)."
      : "수렴된 기저 상태에서 Davidson TDDFPT 를 수행합니다(DIAGONALIZATION SCF).",
    inp_options: [
      "FORCE_EVAL/DFT/SCF/SCF_GUESS RESTART",
      "FORCE_EVAL/PROPERTIES/TDDFPT/NSTATES 20",
      "FORCE_EVAL/PROPERTIES/TDDFPT/MAX_ITER 50",
      "FORCE_EVAL/PROPERTIES/TDDFPT/CONVERGENCE 1.0E-5",
    ],
    selected: true,
    exclude: false,
  };

  const steps = optical ? [...baseSteps, opticalStep] : baseSteps;

  const tip = en
    ? `Seeded plan for ${sym}: with ${req.functional}/${req.basis_set} at ${req.cutoff} Ry, stage the SCF before ${optical ? "TDDFPT" : "optimization"} to keep convergence robust.${optical ? " Optical path fixes SCF to DIAGONALIZATION." : ""}`
    : `${sym} 시드 플랜: ${req.functional}/${req.basis_set}, ${req.cutoff} Ry 조건에서 ${optical ? "TDDFPT" : "최적화"} 전에 SCF 를 먼저 수렴시켜 안정성을 확보하세요.${optical ? " 광학 경로는 SCF 를 DIAGONALIZATION 으로 고정합니다." : ""}`;

  return { expert_tip: tip, steps, atom_info: req.atom_info };
}

/**
 * AI 플랜 생성. 실제 백엔드(:8000) 호출. MOCK=1 이면 시드 응답.
 * 백엔드는 graceful degradation(200 + steps=[]) 계약이므로 호출부가 빈 steps 를 처리.
 */
export async function generatePlan(req: PlanRequest): Promise<PlanResult> {
  if (MOCK) {
    // 목 모드: 살짝 지연을 줘서 로딩/로그 스트림 UX 를 확인
    await new Promise((r) => setTimeout(r, 600));
    return seedPlanResult(req);
  }
  return apiFetch<PlanResult>("/generate-plan", { json: req });
}
