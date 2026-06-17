// features/f6-benchmark/components/progress-console.tsx
// 진행률 + 상태(StatusBadge) + 실시간 로그 콘솔(LogTerminal, 다크 표면 예외).
"use client";

import * as React from "react";
import { Activity } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { StatusBadge, type RunStatus } from "@/components/ui/status-badge";
import { LogTerminal, type LogLine, type LogTone } from "@/components/ui/log-terminal";
import { useT } from "@/lib/i18n/use-t";
import type { BenchmarkReport } from "@/stores/types";
import { TOTAL_LEVELS } from "../api";
import { normalizeStatus } from "../lib";

export interface ProgressConsoleProps {
  report?: BenchmarkReport;
  selectedCount: number;
}

/** 전역 status → StatusBadge 톤. */
function badgeStatus(status?: string): RunStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "running") return "running";
  if (s === "finished") return "done";
  if (s === "stopped" || s === "failure") return "stopped";
  return "pending";
}

/** 전역 status → 짧은 표시 라벨(i18n). 알 수 없으면 원문. */
function statusLabel(
  t: (k: string, p?: Record<string, string | number>) => string,
  status?: string
): string {
  const s = (status ?? "").toLowerCase();
  if (s === "running") return t("f6.status.Running");
  if (s === "finished") return t("f6.status.SUCCESS");
  if (s === "stopped") return t("f6.status.Aborted");
  if (s === "failure") return t("f6.status.FAILURE");
  return t("f6.status.Pending");
}

/** 로그 줄의 이모지/머리말로 톤 추정(LogTerminal 색 구분). */
function logTone(line: string): LogTone {
  if (line.includes("✅") || line.includes("SUCCESS")) return "g";
  if (line.includes("■") || line.includes("FAIL") || line.includes("Aborted"))
    return "y";
  if (line.includes("🚀") || line.includes("[BENCHMARK]")) return "b";
  return "default";
}

export function ProgressConsole({ report, selectedCount }: ProgressConsoleProps) {
  const { t } = useT();

  const status = report?.status ?? "Idle";
  const running = status === "Running";
  const finished = status === "Finished";
  const stopped = status === "Stopped";

  // 처리 완료 레벨 수(Pending/Running 이외) — 진행률.
  const reports = report?.reports ?? [];
  const doneCount = reports.filter((r) => {
    const k = normalizeStatus(r.status);
    return (
      k === "SUCCESS" ||
      k === "INCORRECT" ||
      k === "FAILURE" ||
      k === "Skipped" ||
      k === "Aborted"
    );
  }).length;

  // 분모: 선택 레벨 수(있으면) 아니면 전체 12.
  const denom = selectedCount > 0 ? selectedCount : TOTAL_LEVELS;
  const pct = Math.min(100, Math.round((doneCount / denom) * 100));

  const lines: LogLine[] = React.useMemo(() => {
    const logs = report?.logs ?? [];
    return logs.map((line, i) => ({
      id: i,
      html: line,
      tone: logTone(line),
      cursor: running && i === logs.length - 1,
    }));
  }, [report?.logs, running]);

  const caption = running
    ? t("f6.progress.level", {
        cur: report?.current_level ?? 0,
        total: TOTAL_LEVELS,
      })
    : finished
      ? t("f6.progress.finished")
      : stopped
        ? t("f6.progress.stopped")
        : t("f6.progress.idle");

  return (
    <Card>
      <CardHead
        icon={<Activity />}
        title={t("f6.progress.title")}
        sub={
          <StatusBadge
            status={badgeStatus(status)}
            withPulse={running}
            label={statusLabel(t, status)}
          />
        }
      />
      <CardContent>
        <div className="mb-s3 flex items-center justify-between gap-s4">
          <span className="text-sm text-ink-soft">{caption}</span>
          <span className="font-mono num text-sm text-ink-faint">
            {t("f6.progress.done", { done: doneCount, total: denom })}
          </span>
        </div>

        {/* 진행 바 */}
        <div className="mb-s4 h-[8px] w-full overflow-hidden rounded-pill bg-inset">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-500 ease-smooth"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* 실시간 로그 콘솔 */}
        <LogTerminal
          lines={lines}
          header={t("f6.logs.header")}
          height={240}
          maxLines={60}
        />
      </CardContent>
    </Card>
  );
}
