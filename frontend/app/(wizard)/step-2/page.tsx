"use client";
// app/(wizard)/step-2/page.tsx — 2단계 물성 선택 (f2-plan).
import { useEffect } from "react";
import { useWizardStore } from "@/stores/wizard-store";
import "@/lib/i18n/f2-plan"; // registerDict side-effect
import { PropertySelect } from "@/features/f2-plan/components/property-select";

export default function Step2Page() {
  const setStep = useWizardStore((s) => s.setStep);
  // 라우트 진입 시 현재 단계 동기화 (레일/요약 step-aware 반영)
  useEffect(() => {
    setStep(2);
  }, [setStep]);

  return <PropertySelect />;
}
