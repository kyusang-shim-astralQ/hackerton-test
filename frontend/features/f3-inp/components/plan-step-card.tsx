"use client";
// features/f3-inp/components/plan-step-card.tsx — 가변 N-스텝 타임라인의 한 단계.
// 제외 토글은 store의 PlanStep.exclude를 직접 갱신(cross-feature 단일 소스 — step-5도 같은 규칙으로 필터).
import React from "react";
import { Lightbulb, Check } from "lucide-react";
import type { PlanStep } from "@/stores/types";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface PlanStepCardProps {
  step: PlanStep;
  /** 필터 후 1-based 순번(제외되지 않은 단계만). 제외된 단계는 undefined */
  activeIndex?: number;
  excluded: boolean;
  onToggleExclude: (excluded: boolean) => void;
}

export function PlanStepCard({ step, activeIndex, excluded, onToggleExclude }: PlanStepCardProps) {
  const { t } = useT();
  const tip = step.objective || step.physics_reason || step.description;

  return (
    <div
      className={cn(
        "relative rounded-lg border p-s4 transition-colors",
        excluded
          ? "border-hairline-soft bg-inset opacity-60"
          : "border-hairline bg-card shadow-card",
      )}
    >
      <div className="flex items-start gap-s3">
        {/* 순번 도트 */}
        <span
          className={cn(
            "mt-px inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill mono text-sm",
            excluded
              ? "bg-card text-ink-faint border border-hairline-2 line-through"
              : "bg-accent text-white",
          )}
          aria-hidden="true"
        >
          {excluded ? "—" : activeIndex}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-s2 flex-wrap">
            <h3
              className={cn(
                "font-serif text-title font-medium leading-tight",
                excluded ? "text-ink-faint" : "text-ink",
              )}
            >
              {step.step_name}
            </h3>
            <Badge variant="indigo" className="font-mono">
              {step.run_type ?? "ENERGY"}
            </Badge>
            {step.importance ? (
              <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
                {step.importance}
              </span>
            ) : null}
          </div>

          {/* 목표/근거 */}
          {step.objective ? (
            <p className="mt-s2 text-sm text-ink-soft">
              <span className="text-ink-faint">{t("f3.step.objective")}: </span>
              {step.objective}
            </p>
          ) : null}
          {step.physics_reason && step.physics_reason !== step.objective ? (
            <p className="mt-s1 text-sm text-ink-soft">
              <span className="text-ink-faint">{t("f3.step.reason")}: </span>
              {step.physics_reason}
            </p>
          ) : null}

          {/* 전문가 팁 (인라인) */}
          {tip ? (
            <div className="mt-s3 flex items-start gap-s2 rounded-md bg-accent-wash border border-accent-edge px-s3 py-s2">
              <Lightbulb size={15} strokeWidth={1.8} className="mt-px shrink-0 text-accent" />
              <span className="text-sm text-accent-ink">
                <span className="font-semibold">{t("f3.step.tip")}: </span>
                {tip}
              </span>
            </div>
          ) : null}
        </div>

        {/* 제외 토글 — store.exclude 직접 갱신 */}
        <button
          type="button"
          role="switch"
          aria-checked={!excluded}
          aria-label={excluded ? t("f3.step.toggleInclude") : t("f3.step.toggleExclude")}
          onClick={() => onToggleExclude(!excluded)}
          className={cn(
            "shrink-0 inline-flex items-center gap-s1 rounded-pill border px-s2 py-s1 text-meta font-semibold transition-colors",
            excluded
              ? "bg-card text-ink-faint border-hairline-2 hover:border-ink-faint"
              : "bg-ok-wash text-ok border-[#c2d4bf] hover:bg-ok-wash",
          )}
        >
          {excluded ? (
            t("f3.step.excluded")
          ) : (
            <>
              <Check size={12} strokeWidth={2.4} />
              {t("f3.step.include")}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
