"use client";
// components/layout/step-rail.tsx — 좌측 세로 레일 (design-system §3.5, §4.1)
// brand = 로고(/logo_white.png) + serif "AstralQ" / 6단계 상태 / 벤치마크 상시 진입 / rail-foot
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Check, Lock, FlaskConical, RotateCcw } from "lucide-react";
import { STEPS, stepStatus, canEnter, type StepStatus } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export function StepRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();
  const currentStep = useWizardStore((s) => s.currentStep);
  const maxReached = useWizardStore((s) => s.maxReached);
  const setStep = useWizardStore((s) => s.setStep);
  const reset = useWizardStore((s) => s.reset);

  const onBenchmark = pathname?.startsWith("/benchmark");
  // /benchmark에 있을 땐 flow의 current 강조를 끄고 벤치마크 행만 강조
  const effectiveCurrent = onBenchmark ? -1 : currentStep;

  function handleStep(index: number) {
    if (!canEnter(index, maxReached)) return; // 잠금
    setStep(index);
    router.push(`/step-${index}`);
  }

  function handleNewCalc() {
    if (typeof window !== "undefined" && !window.confirm(t("newcalc.confirm"))) return;
    reset();
    router.push("/step-1");
  }

  return (
    <nav className="rail flex flex-col" aria-label={t("rail.heading.steps")}>
      {/* === brand === */}
      <div className="flex items-center gap-s2 px-s4 py-s4 border-b border-hairline-soft">
        <span className="inline-flex items-center justify-center rounded-md bg-ink px-s2 py-s1">
          <Image src="/logo_white.png" alt="AstralQ" width={24} height={24} priority />
        </span>
        <span className="font-serif text-brand font-medium text-ink">{t("brand.name")}</span>
      </div>

      {/* === steps === */}
      <div className="flex-1 overflow-y-auto px-s3 py-s4">
        <div className="text-label uppercase tracking-[0.10em] text-ink-faint px-s2 mb-s2">
          {t("rail.heading.steps")}
        </div>
        <ul className="flex flex-col gap-px">
          {STEPS.map((s) => {
            const status = stepStatus(s.index, effectiveCurrent, maxReached);
            return (
              <li key={s.index}>
                <StepItem
                  index={s.index}
                  title={s.title}
                  label={s.label}
                  status={status}
                  onClick={() => handleStep(s.index)}
                />
              </li>
            );
          })}
        </ul>

        {/* === divider + 벤치마크 상시 진입 (flow와 독립 — 항상 활성) === */}
        <div className="border-t border-hairline-soft my-s4" />
        <button
          type="button"
          onClick={() => router.push("/benchmark")}
          className={cn(
            "w-full grid grid-cols-[28px_1fr] items-center gap-s2 rounded-md px-s2 py-s2 text-left transition-colors",
            onBenchmark
              ? "bg-accent-wash border border-accent-edge"
              : "border border-transparent hover:bg-inset",
          )}
        >
          <span className="inline-flex items-center justify-center text-accent">
            <FlaskConical size={18} strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-medium text-ink">{t("rail.benchmark.title")}</span>
            <span className="mono text-meta text-ink-faint">{t("rail.benchmark.label")}</span>
          </span>
        </button>
      </div>

      {/* === rail-foot === */}
      <div className="border-t border-hairline-soft px-s4 py-s3 flex items-center justify-between gap-s2">
        <span className="flex flex-col leading-tight">
          <span className="text-meta text-ink-faint uppercase tracking-[0.08em]">
            {t("rail.foot.session")}
          </span>
          <span className="text-sm text-ink-soft">{t("rail.foot.autosave")}</span>
        </span>
        <button
          type="button"
          onClick={handleNewCalc}
          className="inline-flex items-center gap-s1 rounded-md border border-hairline-2 bg-card px-s2 py-s1 text-sm text-ink-soft hover:bg-inset hover:border-ink-faint transition-colors"
        >
          <RotateCcw size={13} strokeWidth={1.8} aria-hidden="true" />
          {t("rail.foot.newcalc")}
        </button>
      </div>
    </nav>
  );
}

function StepItem({
  index,
  title,
  label,
  status,
  onClick,
}: {
  index: number;
  title: string;
  label: string;
  status: StepStatus;
  onClick: () => void;
}) {
  const locked = status === "locked";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-current={status === "current" ? "step" : undefined}
      className={cn(
        "w-full grid grid-cols-[28px_1fr] items-center gap-s2 rounded-md px-s2 py-s2 text-left transition-colors",
        status === "current" && "bg-accent-wash border border-accent-edge",
        status !== "current" && "border border-transparent",
        status === "reachable" && "hover:bg-inset",
        status === "done" && "hover:bg-inset",
        locked && "opacity-55 cursor-not-allowed",
      )}
    >
      {/* step-dot 26px 원형 */}
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-pill mono text-sm",
          "h-[26px] w-[26px]",
          status === "done" && "bg-ok-wash text-ok",
          status === "current" && "bg-accent text-white",
          status === "reachable" && "bg-card border border-hairline-2 text-ink-soft",
          locked && "bg-card border border-hairline-2 text-ink-faint",
        )}
      >
        {status === "done" ? (
          <Check size={14} strokeWidth={2.4} aria-hidden="true" />
        ) : locked ? (
          <Lock size={12} strokeWidth={2} aria-hidden="true" />
        ) : (
          index
        )}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-base font-medium text-ink">{title}</span>
        <span className="mono text-meta text-ink-faint">{label}</span>
      </span>
    </button>
  );
}
