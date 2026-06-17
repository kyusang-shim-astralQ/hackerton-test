// app/(wizard)/step-6/page.tsx — 6단계: AI 분석 리포트 + 결과 다운로드 (f5-report).
"use client";

import { useSyncStep } from "@/lib/use-sync-step";
import { ReportView } from "@/features/f5-report/components/report-view";

export default function Step6Page() {
  useSyncStep(6);
  return <ReportView />;
}
