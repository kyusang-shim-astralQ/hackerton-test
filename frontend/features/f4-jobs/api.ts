// features/f4-jobs/api.ts — f4-jobs HTTP 래퍼 (+ NEXT_PUBLIC_MOCK 클라이언트 스트림 폴백).
// 계약: docs/features/f4-jobs/api.md, docs/contracts/data-models.md.
//   POST /submit-job, GET /job-live-status/{job_key}?lang, POST /job-stop, GET /download-job/{job_name}

import { apiFetch, IS_MOCK } from "@/lib/api";
import type {
  AtomInfo,
  GeneratedFile,
  JobStatus,
  PlanStep,
  SubmitJobResponse,
} from "@/stores/types";
import { MockJobStream } from "./lib/mock-stream";

/** /submit-job 요청 본문 (SubmitRequest, data-models §9). 활성 스텝만 실어야 한다(§0). */
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
  ignore_scf_failure?: boolean;
  lsd?: boolean;
  added_mos?: string | null;
}

// ── MOCK 레지스트리 (클라이언트 스트림 — 실제 폴링과 동일 렌더 경로) ──────────────
const mockStreams = new Map<string, MockJobStream>();

function safeName(filename: string): string {
  // 백엔드 규칙: 파일명에서 비영숫자를 _ 로, 확장자 제거
  return filename.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "_");
}

/** POST /submit-job */
export async function submitJob(
  body: SubmitJobBody,
  lang = "ko"
): Promise<SubmitJobResponse> {
  if (IS_MOCK) {
    const isMulti = (body.multi_atom_info?.length ?? 0) > 1;
    const base =
      body.job_name?.trim() ||
      `job_${new Date()
        .toISOString()
        .replace(/[-:T]/g, "")
        .slice(0, 15)}`;

    if (isMulti) {
      const structs = body.multi_atom_info ?? [];
      const sub_jobs = structs.map((s) => ({
        filename: s.filename,
        job_key: `${base}_${safeName(s.filename)}`,
      }));
      // 서브잡마다 스트림 생성 (서로 다른 진행 페이스가 자연스럽도록 살짝 어긋나게)
      sub_jobs.forEach((sj) => {
        mockStreams.set(sj.job_key, new MockJobStream(body.steps, sj.job_key, lang));
      });
      return {
        status: "success",
        is_multi: true,
        directory: base,
        sub_jobs,
        message:
          lang === "en"
            ? `Submitted parallel calculations for ${sub_jobs.length} structures.`
            : `총 ${sub_jobs.length}개의 구조에 대한 병렬 계산 제출이 시작되었습니다.`,
      };
    }

    mockStreams.set(base, new MockJobStream(body.steps, base, lang));
    return {
      status: "success",
      directory: base,
      message:
        lang === "en"
          ? "Simulation orchestration started (mock SGE)."
          : "시뮬레이션 오케스트레이션이 시작되었습니다 (목 SGE).",
    };
  }

  return apiFetch<SubmitJobResponse>("/submit-job", { json: body });
}

/** GET /job-live-status/{job_key}?lang= */
export async function fetchJobLiveStatus(
  jobKey: string,
  lang = "ko"
): Promise<JobStatus> {
  if (IS_MOCK) {
    const stream = mockStreams.get(jobKey);
    if (!stream) {
      return {
        status: "Unknown",
        active_step: 1,
        total_steps: 1,
        job_id: null,
        lang,
        message: "Unknown job",
        healing_history: [],
        updated_at: "",
        logs: [],
        steps: [],
        step_histories: {},
        job_key: jobKey,
      };
    }
    return stream.tick();
  }

  // 실제 경로: job_key 는 path 파라미터(:path), / 포함 가능 → 인코딩하지 않고 그대로 붙임
  return apiFetch<JobStatus>(`/job-live-status/${jobKey}`, {
    query: { lang },
  });
}

/** POST /job-stop  body { job_key } */
export async function stopJob(
  jobKey: string,
  lang = "ko"
): Promise<{ status: string; message: string }> {
  if (IS_MOCK) {
    mockStreams.get(jobKey)?.abort();
    return {
      status: "success",
      message: lang === "en" ? "Stop requested" : "작업 중단 요청 완료",
    };
  }
  return apiFetch<{ status: string; message: string }>("/job-stop", {
    json: { job_key: jobKey },
  });
}

/** GET /download-job/{job_name} → blob (.tar.gz) */
export async function downloadJob(jobName: string): Promise<Blob> {
  if (IS_MOCK) {
    // 목: 작은 더미 blob (다운로드 흐름 확인용)
    const text = `# CP2K Agent mock results for ${jobName}\n(generated in NEXT_PUBLIC_MOCK mode)\n`;
    return new Blob([text], { type: "application/gzip" });
  }
  const res = await apiFetch<Response>(`/download-job/${jobName}`, { raw: true });
  return res.blob();
}

/** blob 을 파일로 저장하는 헬퍼. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** 종료 상태 판정(폴링 중단 조건). */
export function isTerminalStatus(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return (
    s === "all_finished" ||
    s === "success" ||
    s === "completed" ||
    s === "error" ||
    s === "failed" ||
    s === "aborted" ||
    s.startsWith("submission failed") ||
    s.startsWith("system error")
  );
}
