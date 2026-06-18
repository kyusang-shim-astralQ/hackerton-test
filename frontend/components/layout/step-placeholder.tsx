"use client";
// components/layout/step-placeholder.tsx — 단계 플레이스홀더 (fe/02~07이 page.tsx를 교체)
// 현재 단계를 store에 동기화하고, 빈 상태로라도 의미 있는 안내를 렌더(idle 금지).
import React, { useEffect } from "react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWizardStore } from "@/stores/wizard-store";
import { getStep } from "@/lib/steps";

export function StepPlaceholder({
  step,
  icon,
  children,
}: {
  step: number;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const setStep = useWizardStore((s) => s.setStep);
  const meta = getStep(step);

  // 라우트 진입 시 현재 단계 동기화 (레일/요약 step-aware 반영)
  useEffect(() => {
    setStep(step);
  }, [step, setStep]);

  return (
    <div className="cards-stack max-w-[860px]">
      <Card>
        <CardHead icon={icon} title={meta?.h1 ?? `단계 ${step}`} sub={<Badge variant="indigo">placeholder</Badge>} />
        <CardContent>
          <p className="text-sm text-ink-soft">{meta?.desc}</p>
          <p className="mt-s4 text-sm text-ink-faint">
            이 화면은 파운데이션 스캐폴드의 플레이스홀더입니다. 기능 빌드(fe/02~07)가 이 페이지를 실제
            화면으로 교체합니다.
          </p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
}
