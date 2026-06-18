// features/f4-jobs/api.ts — f4-jobs HTTP 래퍼 + MOCK 라이브 스트림.
// 단일 소스: docs/features/f4-jobs/api.md, docs/contracts/data-models.md.
// 계약: POST /submit-job, GET /job-live-status/{job_key}?lang, POST /job-stop, GET /download-job/{job_name}.
import { apiFetch, API, MOCK } from "@/lib/api";
import type {
  AtomInfo,
  PlanStep,
  GeneratedFile,
  StepHistory,
  SubJob,
  InpOptions,
} from "@/stores/types";

/* ───────────────────────── 응답 타입 (data-models §10/§15) ───────────────────────── */

export interface SubmitJobResponse {
  status: string;
  directory: string;
  is_multi?: boolean;
  sub_jobs?: { filename: string; job_key: string }[];
  message: string;
}

/** 단일 응답은 JobStatus 전체 키 + 다중 집계 키를 합친 형태(JobLiveStatusResponse, data-models §11/§15) */
export interface JobLiveStatusResponse {
  status: string;
  active_step?: number;
  total_steps?: number;
  job_id?: string | null;
  lang?: string;
  message?: string;
  healing_history?: string[];
  updated_at?: string;
  logs?: string[];
  current_scf_step?: number;
  energy_history?: number[];
  scf_history?: number[];
  scf_progress?: number;
  macro_progress?: number;
  steps?: PlanStep[];
  step_histories?: Record<string, StepHistory>;
  job_key?: string;
  // 다중
  is_multi?: boolean;
  sub_jobs?: SubJob[];
}

export interface SubmitJobBody {
  files?: GeneratedFile[] | null;
  atom_info: AtomInfo;
  steps: PlanStep[];
  job_name?: string | null;
  multi_atom_info?: AtomInfo[] | null;
  cutoff?: number;
  rel_cutoff?: number;
  functional?: string;
  basis_set?: string;
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
  lsd?: boolean;
  added_mos?: string | null;
}

/** 종료 상태 판정(폴링 중단 기준, fe/05 DoD). */
export function isTerminal(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "all_finished" ||
    s === "success" ||
    s === "completed" ||
    s === "error" ||
    s === "aborted" ||
    s === "failed" ||
    s.startsWith("submission failed") ||
    s.startsWith("system error")
  );
}

/* ─────────────────────────────── 실제 호출 ─────────────────────────────── */

export async function submitJob(body: SubmitJobBody): Promise<SubmitJobResponse> {
  if (MOCK) return mockSubmitJob(body);
  return apiFetch<SubmitJobResponse>("/submit-job", { json: body });
}

export async function fetchLiveStatus(jobKey: string, lang: string): Promise<JobLiveStatusResponse> {
  // MOCK은 폴링 대신 클라이언트 타이머 스트림(useMockLiveStream)으로 대체되므로 여기 도달하지 않는다.
  return apiFetch<JobLiveStatusResponse>(`/job-live-status/${encodeURI(jobKey)}`, {
    query: { lang },
  });
}

export async function stopJob(jobKey: string): Promise<{ status: string; message: string }> {
  if (MOCK) return { status: "success", message: "작업 중단 요청 완료 (mock)" };
  return apiFetch<{ status: string; message: string }>("/job-stop", { json: { job_key: jobKey } });
}

/** 다운로드 URL (blob → .tar.gz). MOCK이면 다운로드 비활성(null). */
export function downloadJobUrl(jobName: string): string | null {
  if (MOCK) return null;
  return `${API}/download-job/${encodeURIComponent(jobName)}`;
}

/* ─────────────────────────────── MOCK 제출 ─────────────────────────────── */

function safeName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "_");
}

function mockSubmitJob(body: SubmitJobBody): Promise<SubmitJobResponse> {
  const directory = body.job_name || `job_${mockTimestamp()}`;
  const multi = body.multi_atom_info && body.multi_atom_info.length > 1;
  if (multi) {
    const sub_jobs = (body.multi_atom_info ?? []).map((s) => ({
      filename: s.filename,
      job_key: `${directory}_${safeName(s.filename)}`,
    }));
    return Promise.resolve({
      status: "success",
      is_multi: true,
      directory,
      sub_jobs,
      message: `총 ${sub_jobs.length}개의 구조에 대한 병렬 계산 제출이 시작되었습니다. (mock)`,
    });
  }
  return Promise.resolve({
    status: "success",
    directory,
    message: "시뮬레이션 오케스트레이션이 시작되었습니다 (mock 스트림)",
  });
}

function mockTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes(),
  )}${p(d.getSeconds())}`;
}

/* ───────────────────── MOCK 라이브 스트림 시뮬레이터 ─────────────────────
   data-models §11/§12 형태(JobStatus / StepHistory)를 따라 SCF가 점진 수렴(ΔE 1e-2→1e-6),
   로그가 쌓이고 스텝이 진행되다 all_finished로 종료. step_histories를 스텝마다 따로 채워
   스텝별 차트가 각각 그려지게 한다. 실제 폴링 코드 경로와 동일한 JobLiveStatusResponse를 생성. */

const SCF_PER_STEP = 14; // 스텝당 SCF 반복 수
const TARGET = 1.0e-6;

/** 한 스텝의 SCF |ΔE| 시퀀스: 1e-2 → 1e-6 로그선형 + 약한 노이즈(결정론적) */
function scfDeltaSeq(seed: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const frac = i / Math.max(1, SCF_PER_STEP - 1);
    const logv = -2 + frac * -4; // -2 → -6
    const wobble = 1 + 0.18 * Math.sin(seed * 1.7 + i * 0.9);
    out.push(Math.pow(10, logv) * wobble);
  }
  return out;
}

/** 한 스텝의 에너지 시퀀스: 점근 수렴 */
function energySeq(base: number, count: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(base - 0.5 * Math.exp(-i / 4));
  }
  return out;
}

export interface MockTickResult {
  done: boolean;
  status: JobLiveStatusResponse;
}

/** 한 서브잡의 결정론적 진행 상태. tick은 0부터 증가하는 정수. */
export function mockJobStatusAtTick(
  jobKey: string,
  steps: PlanStep[],
  baseEnergy: number,
  tick: number,
  lang: string,
): MockTickResult {
  const total = Math.max(1, steps.length);
  const totalTicks = total * SCF_PER_STEP;
  const t = Math.min(tick, totalTicks);

  const stepIdx0 = Math.min(total - 1, Math.floor(t / SCF_PER_STEP)); // 0-based 현재 스텝
  const within = t - stepIdx0 * SCF_PER_STEP; // 현재 스텝 내 SCF 진행 수
  const finished = tick >= totalTicks;

  // step_histories: 완료 스텝은 전체, 현재 스텝은 within까지
  const step_histories: Record<string, StepHistory> = {};
  for (let s = 0; s < total; s++) {
    const run_type = String(steps[s]?.run_type ?? "ENERGY");
    let n: number;
    if (s < stepIdx0) n = SCF_PER_STEP;
    else if (s === stepIdx0) n = finished ? SCF_PER_STEP : Math.max(1, within);
    else n = 0;
    const scf = scfDeltaSeq(s + 1, n);
    const energy = energySeq(baseEnergy - s * 1.4, n);
    step_histories[String(s + 1)] = {
      run_type,
      energy,
      scf,
      macro_energy: run_type.includes("OPT") ? energy.slice(-1) : [],
      macro_conv: run_type.includes("OPT") ? [0.002 / (s + 1)] : [],
    };
  }

  const curHist = step_histories[String(stepIdx0 + 1)];
  const curScf = curHist.scf;
  const lastDelta = curScf[curScf.length - 1] ?? 1e-2;
  const lastEnergy = curHist.energy[curHist.energy.length - 1] ?? baseEnergy;
  const scfProgress = Math.min(
    99.9,
    (Math.log10(lastDelta) / Math.log10(TARGET)) * 100,
  );

  // 로그 라인 누적
  const logs: string[] = [];
  logs.push(`[Step 1] qsub submitted (job_id=99${jobKey.length}21)`);
  for (let s = 0; s <= stepIdx0; s++) {
    const rt = String(steps[s]?.run_type ?? "ENERGY");
    logs.push(`[Step ${s + 1}] ${rt} 시작 — ${steps[s]?.step_name ?? "step"}`);
    const upTo = s < stepIdx0 ? SCF_PER_STEP : finished ? SCF_PER_STEP : Math.max(1, within);
    const seq = step_histories[String(s + 1)].scf;
    for (let i = 0; i < upTo; i++) {
      logs.push(
        ` SCF run | iter ${String(i + 1).padStart(2, "0")} | ${step_histories[String(s + 1)].energy[i]?.toFixed(5)} | conv ${seq[i]?.toExponential(2)}`,
      );
    }
    if (s < stepIdx0 || finished) logs.push(`[Step ${s + 1}] SCF converged (|ΔE| < ${TARGET.toExponential(0)})`);
  }
  if (finished) logs.push("[Suite] simulation_completed — all_finished");

  const status = finished ? "all_finished" : "Running";
  const message = finished
    ? lang === "en"
      ? "All steps finished."
      : "모든 스텝이 완료되었습니다."
    : lang === "en"
      ? `Step ${stepIdx0 + 1}/${total} running (SCF converging)`
      : `Step ${stepIdx0 + 1}/${total} 실행 중 (SCF 수렴 중)`;

  return {
    done: finished,
    status: {
      status,
      active_step: stepIdx0 + 1,
      total_steps: total,
      job_id: `99${jobKey.length}21`,
      lang,
      message,
      healing_history:
        stepIdx0 >= 1 && !finished
          ? ["[AI Fix] 느린 수렴 감지 → MAX_SCF 50→100 상향, OT 프리컨디셔너 강화"]
          : finished
            ? ["[AI Fix] 느린 수렴 감지 → MAX_SCF 50→100 상향 (성공 후 KB 기록)"]
            : [],
      updated_at: new Date().toLocaleTimeString("en-GB"),
      logs,
      current_scf_step: curScf.length,
      energy_history: curHist.energy,
      scf_history: curScf,
      scf_progress: scfProgress,
      macro_progress: finished ? 100 : (stepIdx0 / total) * 100,
      steps,
      step_histories,
      job_key: jobKey,
    },
  };
}

/** mock 에너지 베이스: 구조 원자수 기반(결정론적, 보기 좋은 음수) */
export function mockBaseEnergy(atom: AtomInfo | undefined): number {
  const n = atom?.atom_count ?? 6;
  return -40.9 * Math.max(1, n);
}

/** InpOptions → SubmitJobBody DFT 필드 매핑(undefined는 백엔드 기본값에 맡김) */
export function inpOptionsToBody(o: InpOptions | undefined): Partial<SubmitJobBody> {
  if (!o) return {};
  return {
    cutoff: o.cutoff,
    rel_cutoff: o.rel_cutoff,
    functional: o.functional,
    basis_set: o.basis_set,
    method: o.method,
    scf_algo: o.scf_algo,
    charge: o.charge,
    multiplicity: o.multiplicity,
    use_smear: o.use_smear,
    smear_temp: o.smear_temp,
    property: o.property,
    eps_scf: o.eps_scf,
    periodic: o.periodic,
    max_scf: o.max_scf,
    lsd: o.lsd,
    added_mos: o.added_mos,
  };
}
