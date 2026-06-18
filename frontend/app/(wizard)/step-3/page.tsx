"use client";
// app/(wizard)/step-3/page.tsx — 3단계 DFT 옵션 + AI 계산 플랜 (f2-plan).
import { useEffect } from "react";
import { useWizardStore } from "@/stores/wizard-store";
import "@/lib/i18n/f2-plan"; // registerDict side-effect
import { DftOptionCards } from "@/features/f2-plan/components/dft-option-cards";
import { AiPlanPanel } from "@/features/f2-plan/components/ai-plan-panel";

export default function Step3Page() {
  const setStep = useWizardStore((s) => s.setStep);
  useEffect(() => {
    setStep(3);
  }, [setStep]);

  return (
    <div className="max-w-[1040px]">
      {/* 두 설정 카드(동일 높이 — design-system §4.5) */}
      <DftOptionCards />
      {/* 전체 폭 AI 계산 플랜 (두 카드 아래) */}
      <AiPlanPanel />
    </div>
  );
}
