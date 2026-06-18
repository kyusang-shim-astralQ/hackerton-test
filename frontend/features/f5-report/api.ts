// features/f5-report/api.ts — f5-report fetch 래퍼 + 다운로드 + MOCK 시드
// 단일 소스: docs/features/f5-report/api.md, docs/contracts/data-models.md §16/§17
import { API, MOCK, apiFetch } from "@/lib/api";
import type { ReportResponse } from "./types";
import { mockReport, type MockReport } from "./mock";

export interface GenerateReportArgs {
  job_dir: string;
  property?: string;
  lang?: string;
}

/**
 * POST /generate-report — 완료 작업 디렉토리 분석 → ReportData(마크다운+summary).
 * NEXT_PUBLIC_MOCK===1 또는 job_dir 미지정(완료 결과 없음) 시 시드 응답으로 대체.
 */
export async function generateReport(args: GenerateReportArgs): Promise<MockReport> {
  const property = args.property ?? "geo_opt";
  const lang = args.lang ?? "ko";

  // 완료 결과가 없거나 MOCK이면 시드 (idle 금지)
  if (MOCK || !args.job_dir) {
    // 살짝 지연을 줘 "생성 중" 스피너가 보이도록(데모 연출)
    await new Promise((r) => setTimeout(r, 450));
    return mockReport(args.job_dir ?? "MOCK_JOB", property, lang);
  }

  const res = await apiFetch<ReportResponse>("/generate-report", {
    json: { job_dir: args.job_dir, property, lang },
  });
  return res as MockReport;
}

/**
 * GET /download-job/{job_name} — 전체 결과 .tar.gz blob 저장.
 * MOCK 모드에서는 다운로드를 비활성(호출부에서 disabled 처리)하므로 호출되지 않음.
 */
export async function downloadJob(jobName: string): Promise<void> {
  const url = `${API}/download-job/${encodeURIComponent(jobName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download failed: ${res.status} ${res.statusText}`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${jobName}.tar.gz`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}
