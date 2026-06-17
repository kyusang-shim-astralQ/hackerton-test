// lib/use-sync-step.ts — 단계 페이지 진입 시 store 의 currentStep/maxReached 를 동기화.
// 각 step-N 페이지가 마운트 시 useSyncStep(N) 으로 호출(기능 페이지도 재사용 가능).
"use client";

import { useEffect } from "react";
import { useWizardStore } from "@/stores/wizard-store";

export function useSyncStep(step: number) {
  useEffect(() => {
    const { currentStep, maxReached, setStep } = useWizardStore.getState();
    if (currentStep !== step) setStep(step);
    if (maxReached < step) {
      useWizardStore.setState({ maxReached: step });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
}
