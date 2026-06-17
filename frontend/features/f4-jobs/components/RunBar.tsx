// features/f4-jobs/components/RunBar.tsx — step-5 상태바 (단계 n/m·SCF 반복·경과·현재 에너지 + STOP).
"use client";

import * as React from "react";
import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, type RunStatus } from "@/components/ui/status-badge";
import { useT } from "@/lib/i18n/use-t";
import { isTerminalStatus } from "../api";
import type { JobStatus } from "@/stores/types";

/** JobStatus.status → StatusBadge 상태. */
function toRunStatus(status: string): RunStatus {
  const s = status.toLowerCase();
  if (s === "aborted" || s.startsWith("submission failed") || s.startsWith("system error"))
    return "stopped";
  if (s === "failed" || s === "error") return "stopped";
  if (s === "all_finished" || s === "success" || s === "completed") return "done";
  return "running";
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RunBar({
  job,
  elapsedSec,
  onStop,
  stopping,
}: {
  job: JobStatus;
  elapsedSec: number;
  onStop: () => void;
  stopping?: boolean;
}) {
  const { t } = useT();
  const runStatus = toRunStatus(job.status);
  const terminal = isTerminalStatus(job.status);
  const energy =
    (job as JobStatus & { energy_value?: number }).energy_value ??
    job.energy_history?.[job.energy_history.length - 1];

  const statusLabel =
    runStatus === "done"
      ? t("f4.status.done")
      : runStatus === "stopped"
        ? job.status.toLowerCase() === "aborted"
          ? t("f4.status.stopped")
          : t("f4.status.failed")
        : `${t("f4.status.running")} · SCF`;

  const meta = (label: string, value: React.ReactNode) => (
    <div className="flex flex-col">
      <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
        {label}
      </span>
      <span className="font-mono num text-base text-ink">{value}</span>
    </div>
  );

  return (
    <div className="flex flex-wrap items-center gap-s6 rounded-lg border border-accent-edge bg-accent-wash px-s4 py-s3">
      <StatusBadge
        status={runStatus}
        withPulse={runStatus === "running"}
        label={statusLabel}
      />
      <div className="flex flex-wrap items-center gap-s6">
        {meta(
          t("f4.monitor.stage"),
          `${job.active_step}/${job.total_steps}`
        )}
        {meta(t("f4.monitor.scfIter"), job.current_scf_step ?? 0)}
        {meta(t("f4.monitor.elapsed"), fmtElapsed(elapsedSec))}
        {meta(
          t("f4.monitor.energy"),
          energy != null ? `${energy.toFixed(4)} Ha` : "—"
        )}
        {meta(t("f4.monitor.jobId"), job.job_id ?? "—")}
      </div>
      <div className="ml-auto">
        {!terminal && (
          <Button
            variant="danger"
            onClick={onStop}
            loading={stopping}
            aria-label={t("f4.monitor.stop")}
          >
            <Square className="h-[14px] w-[14px]" />
            {t("f4.monitor.stop")}
          </Button>
        )}
      </div>
    </div>
  );
}
