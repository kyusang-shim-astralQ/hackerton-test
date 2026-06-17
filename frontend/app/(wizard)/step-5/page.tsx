// app/(wizard)/step-5/page.tsx — 5단계: 제출 + 실시간 모니터링 (f4-jobs).
// 단일 소스: docs/features/f4-jobs/api.md · docs/contracts/data-models.md · docs/design-system.md §4.2(5단계)/§4.3/§4.4.
"use client";

import { useSyncStep } from "@/lib/use-sync-step";
import { JobsScreen } from "@/features/f4-jobs/components/JobsScreen";

export default function Step5Page() {
  useSyncStep(5);
  return <JobsScreen />;
}
