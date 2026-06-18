"use client";
// features/f4-jobs/components/ConvStats.tsx — 수렴 통계 3열(SCF 스텝 수 · 마지막 |ΔE| · 최종 에너지).
// design-system §3.10 말미 ConvStats. 모든 수치 mono + tabular-nums.
import React from "react";
import { useT } from "@/lib/i18n/provider";
import type { StepHistory } from "@/stores/types";
import { SCF_TARGET } from "@/lib/tokens";

export function ConvStats({ history }: { history?: StepHistory }) {
  const { t } = useT();
  const scf = history?.scf ?? [];
  const energy = history?.energy ?? [];
  const lastDelta = scf[scf.length - 1];
  const lastEnergy = energy[energy.length - 1];
  const converged = lastDelta != null && lastDelta <= SCF_TARGET;

  return (
    <div className="grid grid-cols-3 gap-s2">
      <Stat label={t("f4.conv.scfSteps")} value={String(scf.length)} />
      <Stat
        label={t("f4.conv.lastDelta")}
        value={lastDelta != null ? lastDelta.toExponential(1) : "—"}
        tone={converged ? "ok" : undefined}
      />
      <Stat label={t("f4.conv.energy")} value={lastEnergy != null ? lastEnergy.toFixed(5) : "—"} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="rounded-md border border-hairline-soft bg-inset/50 px-s3 py-s2">
      <div className="text-meta uppercase tracking-[0.08em] text-ink-faint">{label}</div>
      <div className={`mono text-sm ${tone === "ok" ? "text-ok" : "text-ink"}`}>{value}</div>
    </div>
  );
}
