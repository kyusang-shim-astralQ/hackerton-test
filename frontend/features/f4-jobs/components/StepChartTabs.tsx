"use client";
// features/f4-jobs/components/StepChartTabs.tsx — step_histories 기준 스텝별 수렴 차트(스텝 탭으로 분리).
// ★ 단일 통합 차트 금지: 차트 하나는 한 스텝(step_histories[stepIndex])만 그린다(fe/05 §2, design-system §3.10/§4.3).
import React, { useMemo, useState } from "react";
import { ConvergenceChart } from "@/components/ui/convergence-chart";
import { useT } from "@/lib/i18n/provider";
import { SCF_TARGET } from "@/lib/tokens";
import type { StepHistory } from "@/stores/types";
import { TabBar, type TabItem } from "./TabBar";
import { ConvStats } from "./ConvStats";

export interface StepChartTabsProps {
  stepHistories: Record<string, StepHistory>;
  /** 현재 진행 중인 스텝(1-based) — 기본 활성 탭으로 따라간다 */
  activeStep?: number;
  height?: number;
}

function stepKeysSorted(h: Record<string, StepHistory>): string[] {
  return Object.keys(h).sort((a, b) => Number(a) - Number(b));
}

export function StepChartTabs({ stepHistories, activeStep, height = 260 }: StepChartTabsProps) {
  const { t } = useT();
  const keys = useMemo(() => stepKeysSorted(stepHistories), [stepHistories]);
  const [manual, setManual] = useState<string | null>(null);

  // 활성 탭: 사용자가 고른 게 있으면 그것, 없으면 현재 진행 스텝, 없으면 첫 스텝
  const fallback = String(activeStep ?? keys[0] ?? "1");
  const selected = manual && keys.includes(manual) ? manual : keys.includes(fallback) ? fallback : keys[0];

  if (keys.length === 0) {
    return (
      <ConvergenceChart stepIndex={1} stepLabel={`① ${t("f4.chart.title")}`} labels={[]} delta={[]} height={height} />
    );
  }

  const tabs: TabItem[] = keys.map((k) => {
    const rt = stepHistories[k]?.run_type ?? "";
    return { value: k, label: `${circled(Number(k))} ${rt}` };
  });

  const hist = stepHistories[selected];
  const delta = hist?.scf ?? [];
  const labels = delta.map((_, i) => i + 1);

  return (
    <div className="flex flex-col gap-s3">
      <TabBar items={tabs} value={selected} onValueChange={setManual} ariaLabel={t("f4.tab.step")} />
      <ConvergenceChart
        stepIndex={Number(selected)}
        stepLabel={`${circled(Number(selected))} ${hist?.run_type ?? ""}`}
        labels={labels}
        delta={delta}
        target={SCF_TARGET}
        height={height}
      />
      <ConvStats history={hist} />
    </div>
  );
}

function circled(n: number): string {
  const c = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];
  return c[n - 1] ?? `${n}.`;
}
