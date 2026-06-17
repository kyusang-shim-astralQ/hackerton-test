// components/layout/workspace.tsx — 가운데 작업 영역 (work-head 고정 + work-body 내부 스크롤, §4.1)
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STEPS, stepByIndex, isStepReachable } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/use-t";
import { Button } from "@/components/ui/button";
import { LangSwitch } from "./lang-switch";

/** /step-N 경로에서 단계 번호 추출 (벤치마크 등은 null). */
function stepFromPath(pathname: string | null): number | null {
  if (!pathname) return null;
  const m = pathname.match(/\/step-(\d+)/);
  return m ? Number(m[1]) : null;
}

export function Workspace({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();

  const maxReached = useWizardStore((s) => s.maxReached);
  const goToStep = useWizardStore((s) => s.goToStep);

  const stepIndex = stepFromPath(pathname);
  const meta = stepIndex ? stepByIndex(stepIndex) : undefined;

  const go = React.useCallback(
    (index: number) => {
      if (index < 1 || index > STEPS.length) return;
      if (!isStepReachable(index, maxReached)) return;
      goToStep(index);
      const s = stepByIndex(index);
      if (s) router.push(s.path);
    },
    [goToStep, maxReached, router]
  );

  // 키보드 ←/→ (입력 포커스 시 제외)
  React.useEffect(() => {
    if (stepIndex == null) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "ArrowLeft") go(stepIndex - 1);
      if (e.key === "ArrowRight") go(stepIndex + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stepIndex, go]);

  return (
    <section className="work-zone bg-paper">
      {/* work-head (flex:none, 고정) */}
      <header className="flex-none border-b border-hairline bg-paper px-s8 py-s4">
        <div className="flex items-start gap-s4">
          <div className="min-w-0 flex-1">
            {meta ? (
              <>
                <div className="text-label font-semibold uppercase tracking-[0.10em] text-accent">
                  {meta.eyebrow}
                </div>
                <h1 className="mt-s1 font-serif text-h1 font-medium text-ink">
                  {meta.heading}
                </h1>
                <p className="mt-s1 max-w-[60ch] text-base text-ink-soft">
                  {meta.description}
                </p>
              </>
            ) : (
              <>
                <div className="text-label font-semibold uppercase tracking-[0.10em] text-accent">
                  Benchmark · 1–12
                </div>
                <h1 className="mt-s1 font-serif text-h1 font-medium text-ink">
                  {t("rail.benchmark.title")}
                </h1>
              </>
            )}
          </div>

          {/* head-nav: 이전 아이콘 / pager / 다음 primary (step 경로에서만) */}
          {stepIndex != null && (
            <div className="flex flex-none items-center gap-s2">
              <LangSwitch />
              <Button
                variant="icon"
                aria-label={t("nav.prev")}
                disabled={stepIndex <= 1}
                onClick={() => go(stepIndex - 1)}
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
              </Button>
              <span className="font-mono text-sm num text-ink-faint">
                {stepIndex} / {STEPS.length}
              </span>
              <Button
                variant="primary"
                disabled={stepIndex >= STEPS.length}
                onClick={() => go(stepIndex + 1)}
              >
                {t("nav.next")}
                <ChevronRight className="h-[16px] w-[16px]" />
              </Button>
            </div>
          )}
          {stepIndex == null && <LangSwitch />}
        </div>
      </header>

      {/* work-body (flex:1, 내부 스크롤) */}
      <div className="work-body px-s8 py-s6">
        <div className="panel-fade-in mx-auto max-w-[1100px]">{children}</div>
      </div>
    </section>
  );
}
