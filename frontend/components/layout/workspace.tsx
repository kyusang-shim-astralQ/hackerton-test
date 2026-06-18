"use client";
// components/layout/workspace.tsx — 가운데 존 (work-head 고정 + work-body 내부 스크롤, design-system §4.1)
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { STEPS, TOTAL_STEPS, getStep, canEnter } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";

function stepFromPath(pathname: string | null): number | null {
  if (!pathname) return null;
  const m = pathname.match(/step-(\d)/);
  return m ? Number(m[1]) : null;
}

export function Workspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const setStep = useWizardStore((s) => s.setStep);
  const maxReached = useWizardStore((s) => s.maxReached);

  const isBenchmark = pathname?.startsWith("/benchmark");
  const stepNum = stepFromPath(pathname);
  const meta = stepNum ? getStep(stepNum) : undefined;

  function go(index: number) {
    if (index < 1 || index > TOTAL_STEPS) return;
    if (!canEnter(index, maxReached)) return;
    setStep(index);
    router.push(`/step-${index}`);
  }

  return (
    <main className="work">
      {/* work-head (고정) */}
      <header className="work-head px-s8 pt-s6 pb-s4 border-b border-hairline-soft">
        {isBenchmark ? (
          <div className="flex items-end justify-between gap-s4">
            <div>
              <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s1">
                {t("rail.benchmark.label")}
              </div>
              <h1 className="font-serif text-h1 font-medium text-ink leading-tight">
                {t("rail.benchmark.title")}
              </h1>
            </div>
          </div>
        ) : meta ? (
          <div className="flex items-end justify-between gap-s4">
            <div className="min-w-0">
              <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s1">
                {meta.eyebrow}
              </div>
              <h1 className="font-serif text-h1 font-medium text-ink leading-tight">{meta.h1}</h1>
              <p className="text-sm text-ink-soft mt-s1 max-w-[60ch]">{meta.desc}</p>
            </div>
            {/* head-nav: 이전 아이콘 / pager / 다음 primary */}
            <div className="flex items-center gap-s2 shrink-0">
              <Button
                variant="icon"
                aria-label={t("nav.prev")}
                disabled={stepNum === 1}
                onClick={() => stepNum && go(stepNum - 1)}
              >
                <ChevronLeft size={18} strokeWidth={1.8} />
              </Button>
              <span className="mono text-sm text-ink-faint px-s1">
                {stepNum}/{TOTAL_STEPS}
              </span>
              <Button
                variant="primary"
                disabled={stepNum === TOTAL_STEPS}
                onClick={() => stepNum && go(stepNum + 1)}
              >
                {t("nav.next")}
                <ChevronRight size={16} strokeWidth={2} />
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {/* work-body (내부 스크롤) */}
      <div className="work-body px-s8 py-s6">
        <div className="panel-fade" key={pathname}>
          {children}
        </div>
      </div>
    </main>
  );
}

// 단계 메타가 필요할 때 외부에서 재사용
export { STEPS };
