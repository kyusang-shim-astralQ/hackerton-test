// components/ui/status-badge.tsx — Lab Paper StatusBadge + pulse dot (design-system §3.4)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type RunStatus =
  | "running"
  | "converged"
  | "done"
  | "stopped"
  | "pending";

export interface StatusBadgeProps {
  status: RunStatus;
  withPulse?: boolean;
  label?: string;
  className?: string;
}

// 색 매핑(Lab Paper): running/converged/done = ok 펄스, stopped = oxblood, pending = ink-faint.
const DOT: Record<RunStatus, string> = {
  running: "bg-ok",
  converged: "bg-ok",
  done: "bg-ok",
  stopped: "bg-oxblood",
  pending: "bg-ink-faint",
};
const RING: Record<RunStatus, string> = {
  running: "border-ok",
  converged: "border-ok",
  done: "border-ok",
  stopped: "border-oxblood",
  pending: "border-ink-faint",
};
const TEXT: Record<RunStatus, string> = {
  running: "text-ok",
  converged: "text-ok",
  done: "text-ok",
  stopped: "text-oxblood",
  pending: "text-ink-faint",
};

const DEFAULT_LABEL: Record<RunStatus, string> = {
  running: "실행 중",
  converged: "수렴",
  done: "완료",
  stopped: "중지됨",
  pending: "대기",
};

export function StatusBadge({
  status,
  withPulse = false,
  label,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-s2 text-sm font-medium",
        TEXT[status],
        className
      )}
    >
      <span className="relative inline-flex h-[9px] w-[9px]">
        <span className={cn("h-[9px] w-[9px] rounded-pill", DOT[status])} />
        {withPulse && (status === "running" || status === "converged") && (
          <span
            className={cn(
              "absolute inset-0 rounded-pill border",
              RING[status]
            )}
            style={{ animation: "ring 1.6s ease-out infinite" }}
          />
        )}
      </span>
      {label ?? DEFAULT_LABEL[status]}
    </span>
  );
}
