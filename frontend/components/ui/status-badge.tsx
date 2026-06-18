"use client";
// components/ui/status-badge.tsx — RunState 펄스 배지 (design-system §3.4)
import React from "react";
import { cn } from "@/lib/utils";

export type RunStatus = "running" | "converged" | "done" | "stopped" | "pending";

export interface StatusBadgeProps {
  status: RunStatus;
  withPulse?: boolean;
  label?: string;
  className?: string;
}

// 색 매핑: running/converged/done = ok, stopped = oxblood, pending = ink-faint
const dotColor: Record<RunStatus, string> = {
  running: "var(--ok)",
  converged: "var(--ok)",
  done: "var(--ok)",
  stopped: "var(--oxblood)",
  pending: "var(--ink-faint)",
};

const textColor: Record<RunStatus, string> = {
  running: "text-ok",
  converged: "text-ok",
  done: "text-ok",
  stopped: "text-oxblood",
  pending: "text-ink-faint",
};

const defaultLabel: Record<RunStatus, string> = {
  running: "실행 중",
  converged: "수렴",
  done: "완료",
  stopped: "중지됨",
  pending: "대기",
};

export function StatusBadge({ status, withPulse = true, label, className }: StatusBadgeProps) {
  const color = dotColor[status];
  const showPulse = withPulse && (status === "running" || status === "converged");
  return (
    <span className={cn("inline-flex items-center gap-s2 text-sm font-medium", textColor[status], className)}>
      <span className="relative inline-flex" style={{ width: 9, height: 9 }}>
        <span
          className="absolute inset-0 rounded-pill"
          style={{ background: color }}
          aria-hidden="true"
        />
        {showPulse ? (
          <span
            className="absolute inset-0 rounded-pill"
            style={{ border: `1px solid ${color}`, animation: "ring 1.6s ease-out infinite" }}
            aria-hidden="true"
          />
        ) : null}
      </span>
      <span>{label ?? defaultLabel[status]}</span>
    </span>
  );
}
