// app/(wizard)/step-3/page.tsx — 3단계 DFT 옵션 + AI 계산 플랜 (f2-plan).
"use client";

import { useSyncStep } from "@/lib/use-sync-step";
import { ElectronicStructureCard } from "@/features/f2-plan/components/electronic-structure-card";
import { ScfConvergenceCard } from "@/features/f2-plan/components/scf-convergence-card";
import { AiPlanCard } from "@/features/f2-plan/components/ai-plan-card";

export default function Step3Page() {
  useSyncStep(3);
  return (
    <div className="flex flex-col gap-s4">
      {/* 두 설정 카드 — 동일 높이로 나란히 (§4.5 b·c: height 금지·stretch, 그리드 카드 margin-top:0) */}
      <div className="cards-stretch grid grid-cols-1 gap-s4 lg:grid-cols-2">
        <ElectronicStructureCard />
        <ScfConvergenceCard />
      </div>

      {/* 전체 폭 AI 계산 플랜 (두 카드 아래) */}
      <AiPlanCard />
    </div>
  );
}
