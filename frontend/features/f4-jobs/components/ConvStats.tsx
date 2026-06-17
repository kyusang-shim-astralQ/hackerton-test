// features/f4-jobs/components/ConvStats.tsx — 수렴 통계 3열 (현재 스텝 기준).
"use client";

import * as React from "react";
import { useT } from "@/lib/i18n/use-t";
import type { StepHistory } from "@/stores/types";

export function ConvStats({ hist }: { hist?: StepHistory }) {
  const { t } = useT();
  const scf = hist?.scf ?? [];
  const scfSteps = scf.length;
  const minDelta = scf.length ? Math.min(...scf) : null;
  const target = 1.0e-6;
  const progress =
    minDelta && minDelta > 0
      ? Math.min(99.9, (Math.log10(minDelta) / Math.log10(target)) * 100)
      : 0;

  const cell = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col gap-s1">
      <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </span>
      <span className="font-mono num text-base text-ink">{value}</span>
    </div>
  );

  return (
    <div className="grid grid-cols-3 gap-s4 rounded-md border border-hairline bg-card px-s4 py-s3">
      {cell(t("f4.stats.scfSteps"), scfSteps)}
      {cell(
        t("f4.stats.minDelta"),
        minDelta != null ? `${minDelta.toExponential(1)} Ha` : "—"
      )}
      {cell(t("f4.stats.progress"), `${progress.toFixed(0)}%`)}
    </div>
  );
}
