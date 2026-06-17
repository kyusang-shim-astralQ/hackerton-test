// components/layout/step-rail.tsx — 좌측 세로 레일 (design-system §3.5·§4.1)
// ★ store 골격/공유 컴포넌트 — 기능 프롬프트는 수정하지 않는다.
"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Check, Lock, FlaskConical, RotateCcw } from "lucide-react";
import {
  STEPS,
  BENCHMARK_META,
  stepStatus,
  isStepReachable,
} from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function StepRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();

  const currentStep = useWizardStore((s) => s.currentStep);
  const maxReached = useWizardStore((s) => s.maxReached);
  const goToStep = useWizardStore((s) => s.goToStep);
  const reset = useWizardStore((s) => s.reset);

  const benchmarkActive = pathname?.startsWith(BENCHMARK_META.path);

  const onStepClick = (index: number) => {
    if (!isStepReachable(index, maxReached)) return; // 잠금
    goToStep(index);
    const step = STEPS.find((s) => s.index === index);
    if (step) router.push(step.path);
  };

  const onNewCalc = () => {
    reset();
    router.push("/step-1");
  };

  return (
    <nav className="zone-scroll flex h-full flex-col border-r border-hairline bg-card">
      {/* brand: 회사 로고 + serif AstralQ 워드마크 (어두운 칩 위에 얹어 white 로고 대비 확보) */}
      <div className="flex items-center gap-s2 border-b border-hairline px-s4 py-s4">
        <span className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-md bg-ink">
          <Image
            src="/logo_white.png"
            alt="AstralQ"
            width={30}
            height={30}
            className="h-[30px] w-auto object-contain"
            priority
          />
        </span>
        <div className="font-serif text-brand font-medium text-ink">
          {t("brand.name")}
        </div>
      </div>

      {/* 6단계 목록 */}
      <ul className="flex-1 px-s2 py-s3">
        {STEPS.map((step) => {
          const status = stepStatus(step.index, currentStep, maxReached);
          const locked = status === "locked";
          const isCurrent = status === "current";
          const isDone = status === "done";
          return (
            <li key={step.index}>
              <button
                type="button"
                disabled={locked}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStepClick(step.index)}
                className={cn(
                  "mb-s1 grid w-full grid-cols-[28px_1fr] items-center gap-s2 rounded-md px-s2 py-s2 text-left transition-colors",
                  isCurrent && "border border-accent-edge bg-accent-wash",
                  !isCurrent && !locked && "hover:bg-inset",
                  locked && "cursor-not-allowed opacity-55"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-[26px] w-[26px] items-center justify-center rounded-pill font-mono text-sm num",
                    isCurrent && "bg-accent text-white",
                    isDone && "bg-ok-wash text-ok",
                    !isCurrent && !isDone && !locked && "bg-inset text-ink-soft",
                    locked && "bg-inset text-ink-faint"
                  )}
                >
                  {isDone ? (
                    <Check className="h-[14px] w-[14px]" />
                  ) : locked ? (
                    <Lock className="h-[13px] w-[13px]" />
                  ) : (
                    step.index
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-medium text-ink">
                    {t(`step.${step.index}.title`)}
                  </span>
                  <span className="block truncate font-mono text-meta uppercase tracking-[0.06em] text-ink-faint">
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}

        {/* 구분선 + 벤치마크 상시 진입 행 (flow 독립 — 항상 활성, §3.5) */}
        <li className="mt-s2 border-t border-hairline pt-s2">
          <button
            type="button"
            onClick={() => router.push(BENCHMARK_META.path)}
            aria-current={benchmarkActive ? "page" : undefined}
            className={cn(
              "grid w-full grid-cols-[28px_1fr] items-center gap-s2 rounded-md px-s2 py-s2 text-left transition-colors",
              benchmarkActive
                ? "border border-accent-edge bg-accent-wash"
                : "hover:bg-inset"
            )}
          >
            <span
              className={cn(
                "inline-flex h-[26px] w-[26px] items-center justify-center rounded-pill",
                benchmarkActive ? "bg-accent text-white" : "bg-inset text-accent"
              )}
            >
              <FlaskConical className="h-[15px] w-[15px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-medium text-ink">
                {t("rail.benchmark.title")}
              </span>
              <span className="block truncate font-mono text-meta uppercase tracking-[0.06em] text-ink-faint">
                {t("rail.benchmark.label")}
              </span>
            </span>
          </button>
        </li>
      </ul>

      {/* rail-foot: 세션 + 자동저장 + 새 계산 */}
      <div className="border-t border-hairline px-s4 py-s3">
        <div className="flex items-center justify-between gap-s2">
          <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
            {t("rail.autosaved")}
          </span>
          <button
            type="button"
            onClick={onNewCalc}
            className="inline-flex items-center gap-s1 rounded-md border border-hairline-2 bg-card px-s2 py-s1 text-meta font-semibold text-ink-soft hover:bg-inset"
          >
            <RotateCcw className="h-[12px] w-[12px]" />
            {t("rail.newCalc")}
          </button>
        </div>
      </div>
    </nav>
  );
}
