"use client";
// features/f4-jobs/components/RunBar.tsx — step-5 상태바: 상태 펄스 + 단계/SCF반복/경과/현재에너지 + STOP.
// design-system §3.4(StatusBadge), §4.2 step-5 RunBar.
import React from "react";
import { Square } from "lucide-react";
import { StatusBadge, type RunStatus } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import type { JobLiveStatusResponse } from "../api";

export function statusToRun(status: string | undefined): RunStatus {
  if (!status) return "pending";
  const s = status.toLowerCase();
  if (s === "all_finished" || s === "success" || s === "completed") return "done";
  if (s === "aborted" || s === "stopped") return "stopped";
  if (s === "failed" || s === "error" || s.startsWith("submission failed") || s.startsWith("system error"))
    return "stopped";
  return "running";
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export interface RunBarProps {
  data?: JobLiveStatusResponse;
  elapsedSec: number;
  terminal: boolean;
  onStop: () => void;
  stopping?: boolean;
}

export function RunBar({ data, elapsedSec, terminal, onStop, stopping }: RunBarProps) {
  const { t } = useT();
  const run = statusToRun(data?.status);
  const lastEnergy = data?.energy_history?.[data.energy_history.length - 1];
  const statusLabel =
    run === "done"
      ? t("f4.status.done")
      : run === "stopped"
        ? data?.status?.toLowerCase() === "failed" || data?.status?.toLowerCase() === "error"
          ? t("f4.status.failed")
          : t("f4.status.stopped")
        : t("f4.status.running");

  return (
    <div className="flex flex-wrap items-center gap-s4 rounded-lg border border-accent-edge bg-accent-wash px-s4 py-s3">
      <StatusBadge status={run} label={statusLabel} />
      <Meta label={t("f4.run.stage")} value={`${data?.active_step ?? 1}/${data?.total_steps ?? 1}`} />
      <Meta label={t("f4.run.scf")} value={String(data?.current_scf_step ?? 0)} />
      <Meta label={t("f4.run.elapsed")} value={fmtElapsed(elapsedSec)} />
      <Meta
        label={t("f4.run.energy")}
        value={lastEnergy != null ? `${lastEnergy.toFixed(4)} Ha` : "—"}
      />
      <div className="ml-auto">
        <Button variant="danger" disabled={terminal || stopping} onClick={onStop}>
          <Square size={14} strokeWidth={2} fill="currentColor" />
          {stopping ? t("f4.run.stopping") : t("f4.run.stop")}
        </Button>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      <span className="mono text-sm text-ink">{value}</span>
    </div>
  );
}
