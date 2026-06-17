// features/f5-report/components/step-convergence.tsx
// 수렴 차트는 step_histories 기준 스텝별로 분리(스텝 탭) — 여러 스텝을 한 차트에 합치지 않는다.
// (design-system §3.10 / 빌드 프롬프트 DoD: 스텝별 분리)
"use client";

import * as React from "react";
import { Segmented } from "@/components/ui/segmented";
import { ConvergenceChart } from "@/components/ui/convergence-chart";
import { useT } from "@/lib/i18n/use-t";
import type { MockStepSeries } from "./mock-histories";

export function StepConvergence({
  series,
  height = 280,
}: {
  series: MockStepSeries[];
  height?: number;
}) {
  const { t } = useT();
  const [active, setActive] = React.useState(0);

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-hairline bg-card p-s6 text-sm text-ink-faint">
        {t("f5.steps.none")}
      </div>
    );
  }

  const items = series.map((s, i) => ({
    value: String(i),
    label: s.stepLabel || `${t("f5.steps.tab")} ${s.stepIndex}`,
  }));
  const cur = series[Math.min(active, series.length - 1)];

  return (
    <div className="space-y-s3">
      {series.length > 1 && (
        <Segmented
          aria-label={t("f5.steps.head")}
          value={String(active)}
          onValueChange={(v) => setActive(Number(v))}
          items={items}
        />
      )}
      {/* 한 차트 = 한 스텝(step_histories[stepIndex])만 그린다 */}
      <ConvergenceChart
        key={cur.stepIndex}
        stepIndex={cur.stepIndex}
        stepLabel={cur.stepLabel}
        labels={cur.labels}
        delta={cur.delta}
        height={height}
      />
    </div>
  );
}
