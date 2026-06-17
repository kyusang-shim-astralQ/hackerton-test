// features/f4-jobs/components/StepCharts.tsx
// ★ fe/05 — 수렴 차트를 step_histories 기준 *스텝별로 분리*해서 그린다(단일 통합 차트 금지).
//   스텝 탭으로 각 스텝의 SCF/에너지 수렴(로그축)을 따로 보여준다.
"use client";

import * as React from "react";
import { ConvergenceChart } from "@/components/ui/convergence-chart";
import { ConvStats } from "./ConvStats";
import { cn } from "@/lib/utils";
import type { JobStatus, StepHistory } from "@/stores/types";

const SCF_TARGET = 1.0e-6;

/** step_histories 키를 숫자 오름차순으로 정렬해 [stepIndex, history] 배열로. */
function sortedSteps(
  histories: Record<string, StepHistory>
): { idx: number; key: string; hist: StepHistory }[] {
  return Object.keys(histories)
    .map((k) => ({ idx: Number(k), key: k, hist: histories[k] }))
    .sort((a, b) => a.idx - b.idx);
}

function stepLabel(idx: number, hist: StepHistory, names?: string[]): string {
  const circled = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"][idx - 1] ?? `${idx}`;
  const name =
    names?.[idx - 1]?.replace(/^Step\s*\d+:\s*/i, "") || hist.run_type || "";
  return `${circled} ${name}`.trim();
}

export function StepCharts({
  job,
  height = 280,
}: {
  job: JobStatus;
  height?: number;
}) {
  const entries = React.useMemo(
    () => sortedSteps(job.step_histories ?? {}),
    [job.step_histories]
  );
  const names = React.useMemo(
    () => (job.steps ?? []).map((s) => s.step_name),
    [job.steps]
  );

  // 활성(진행 중) 스텝을 기본 선택 — 데이터가 쌓이는 스텝을 보여줌
  const [activeIdx, setActiveIdx] = React.useState<number>(job.active_step ?? 1);

  // 진행 스텝이 바뀌면 자동으로 따라가되, 사용자가 다른 탭을 누른 흔적이 없을 때만.
  const followRef = React.useRef(true);
  React.useEffect(() => {
    if (followRef.current && job.active_step) setActiveIdx(job.active_step);
  }, [job.active_step]);

  if (entries.length === 0) {
    return (
      <ConvergenceChart
        stepIndex={1}
        labels={[]}
        delta={[]}
        target={SCF_TARGET}
        height={height}
      />
    );
  }

  const current =
    entries.find((e) => e.idx === activeIdx) ?? entries[entries.length - 1];

  return (
    <div className="flex flex-col gap-s3">
      {/* 스텝 탭 — 스텝마다 개별 차트로 전환(합치지 않음) */}
      {entries.length > 1 && (
        <div className="flex flex-wrap gap-s2" role="tablist">
          {entries.map((e) => {
            const isActive = e.idx === current.idx;
            const isRunning = e.idx === job.active_step;
            return (
              <button
                key={e.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  followRef.current = false;
                  setActiveIdx(e.idx);
                }}
                className={cn(
                  "inline-flex items-center gap-s1 rounded-md border px-s3 py-s1 text-sm transition-colors",
                  isActive
                    ? "border-accent bg-accent text-white"
                    : "border-hairline-2 bg-card text-ink-soft hover:bg-inset"
                )}
              >
                {stepLabel(e.idx, e.hist, names)}
                {isRunning && !isActive && (
                  <span className="h-[6px] w-[6px] rounded-pill bg-ok" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <ConvergenceChart
        key={current.key}
        stepIndex={current.idx}
        stepLabel={
          entries.length === 1
            ? stepLabel(current.idx, current.hist, names)
            : undefined
        }
        labels={current.hist.scf.map((_, i) => i + 1)}
        delta={current.hist.scf}
        target={SCF_TARGET}
        height={height}
      />

      <ConvStats hist={current.hist} />
    </div>
  );
}
