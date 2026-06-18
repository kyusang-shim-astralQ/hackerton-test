"use client";
// features/f5-report/components/step-convergence.tsx — step_histories 기준 스텝별 수렴 차트(탭)
// ★ 차트 하나 = 한 스텝(단일 통합 차트 금지, design-system §3.10/§4.2). 스텝 탭으로 분리.
import { useState } from "react";
import { Card, CardHead } from "@/components/ui/card";
import { ConvergenceChart } from "@/components/ui/convergence-chart";
import { LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import type { MockStepHistory } from "../mock";

export interface StepConvergenceProps {
  /** step_histories: 키 → {label, scf[], delta[]} */
  histories: Record<string, MockStepHistory>;
}

export function StepConvergence({ histories }: StepConvergenceProps) {
  const { t } = useT();
  const keys = Object.keys(histories);
  const [active, setActive] = useState(keys[0] ?? "");

  if (keys.length === 0) {
    return (
      <Card>
        <CardHead icon={<LineChart size={18} strokeWidth={1.8} />} title={t("f5.conv.title")} />
        <p className="text-sm text-ink-faint">{t("f5.conv.none")}</p>
      </Card>
    );
  }

  const current = histories[active] ?? histories[keys[0]];
  const activeIndex = Math.max(0, keys.indexOf(active));

  return (
    <Card>
      <CardHead
        icon={<LineChart size={18} strokeWidth={1.8} />}
        title={t("f5.conv.title")}
        sub={`${keys.length} steps`}
      />
      <p className="text-sm text-ink-faint mb-s3">{t("f5.conv.hint")}</p>

      {/* 스텝 탭 */}
      <div role="tablist" className="flex flex-wrap gap-s1 mb-s3">
        {keys.map((k) => {
          const on = k === active;
          return (
            <button
              key={k}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setActive(k)}
              className={cn(
                "h-[30px] px-s3 rounded-md text-sm font-medium transition-colors border",
                on
                  ? "bg-accent text-white border-accent"
                  : "bg-card text-ink-soft border-hairline-2 hover:bg-inset",
              )}
            >
              {histories[k].label}
            </button>
          );
        })}
      </div>

      {/* 활성 스텝만 그리는 단일-스텝 차트 */}
      <ConvergenceChart
        key={active}
        stepIndex={activeIndex + 1}
        stepLabel={current.label}
        labels={current.scf}
        delta={current.delta}
        height={260}
      />
    </Card>
  );
}
