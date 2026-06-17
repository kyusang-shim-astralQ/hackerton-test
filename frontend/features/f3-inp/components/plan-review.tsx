// features/f3-inp/components/plan-review.tsx — AI 워크플로 검토(가변 N-스텝 타임라인 + 제외 토글).
// 제외 상태는 cross-feature: planResult.steps[i].exclude 를 직접 갱신(단일 규칙 selected!==false && exclude!==true)
// → step-5(f4) 제출/모니터도 같은 규칙으로 자동 반영(제외 스텝 부활 버그 방지, data-models §4 권장).
"use client";

import * as React from "react";
import { ListChecks, Lightbulb, Eye, EyeOff } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChipToggle } from "@/components/ui/chip-toggle";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { PlanStep } from "@/stores/types";
import { isStepActive } from "../api";

export interface PlanReviewProps {
  steps: PlanStep[];
  expertTip?: string;
  /** 원본 인덱스 i 의 제외 상태를 excluded 로 설정. */
  onToggleExclude: (i: number, excluded: boolean) => void;
}

/** 중요도 → 배지 톤. */
function importanceVariant(
  importance?: string
): "indigo" | "green" | "neutral" {
  if (importance === "필수" || importance === "Required") return "green";
  if (importance === "권장" || importance === "Recommended") return "indigo";
  return "neutral";
}

export function PlanReview({
  steps,
  expertTip,
  onToggleExclude,
}: PlanReviewProps) {
  const { t } = useT();
  const activeCount = steps.filter(isStepActive).length;

  return (
    <Card variant="aiplan">
      <CardHead
        icon={<ListChecks />}
        title={t("f3.review.title")}
        sub={t("f3.review.stages", { n: activeCount, total: steps.length })}
      />

      {expertTip && (
        <div className="mb-s4 flex items-start gap-s2 rounded-md border border-accent-edge bg-accent-wash px-s3 py-s2">
          <Lightbulb className="mt-px h-[16px] w-[16px] flex-none text-accent" />
          <p className="text-sm text-accent-ink">{expertTip}</p>
        </div>
      )}

      <ol className="flex flex-col gap-s3">
        {steps.map((step, i) => {
          const active = isStepActive(step);
          return (
            <li
              key={i}
              className={cn(
                "rounded-md border bg-card px-s4 py-s3 transition-colors",
                active
                  ? "border-hairline-2"
                  : "border-hairline-soft opacity-55"
              )}
            >
              <div className="flex items-start gap-s3">
                {/* step-dot: 활성=accent 채움, 제외=ink-faint */}
                <span
                  className={cn(
                    "mt-px inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-pill font-mono text-sm num",
                    active
                      ? "bg-accent text-white"
                      : "bg-inset text-ink-faint line-through"
                  )}
                  aria-hidden
                >
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-s2">
                    <span
                      className={cn(
                        "text-base font-medium",
                        active ? "text-ink" : "text-ink-faint"
                      )}
                    >
                      {step.step_name}
                    </span>
                    <Badge variant="indigo" className="font-mono">
                      {step.run_type || "ENERGY"}
                    </Badge>
                    {step.importance && (
                      <Badge variant={importanceVariant(step.importance)}>
                        {step.importance}
                      </Badge>
                    )}
                  </div>

                  {step.objective && (
                    <p className="mt-s1 text-sm text-ink-soft">
                      {step.objective}
                    </p>
                  )}

                  {step.physics_reason && (
                    <div className="mt-s2 flex items-start gap-s2">
                      <Lightbulb className="mt-px h-[14px] w-[14px] flex-none text-accent" />
                      <p className="text-sm text-ink-faint">
                        {step.physics_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* 제외 토글: on(active)=계산에 포함 / off=제외 */}
                <ChipToggle
                  checked={active}
                  onChange={(checked) => onToggleExclude(i, !checked)}
                  className="flex-none self-start"
                >
                  {active ? (
                    <>
                      <Eye className="h-[14px] w-[14px]" />
                      {t("f3.review.included")}
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-[14px] w-[14px]" />
                      {t("f3.review.excluded")}
                    </>
                  )}
                </ChipToggle>
              </div>
            </li>
          );
        })}
      </ol>

      {activeCount === 0 && (
        <p className="mt-s4 text-sm text-oxblood">{t("f3.review.noneActive")}</p>
      )}
    </Card>
  );
}
