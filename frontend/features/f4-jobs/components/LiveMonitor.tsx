"use client";
// features/f4-jobs/components/LiveMonitor.tsx — 한 서브잡의 라이브 모니터(상태바 + 로그 터미널 + 스텝별 차트 + 치유).
// 활성 서브잡의 라이브 요약을 store.jobLive 에 미러링(우측 SummaryPanel/외부 소비용).
import React, { useEffect, useMemo, useRef, useState } from "react";
import { LogTerminal, tone, type LogLine } from "@/components/ui/log-terminal";
import { Card, CardHead } from "@/components/ui/card";
import { Activity, Terminal as TerminalIcon } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { useWizardStore } from "@/stores/wizard-store";
import type { PlanStep } from "@/stores/types";
import { useJobMonitor } from "../hooks/useJobMonitor";
import { RunBar } from "./RunBar";
import { StepChartTabs } from "./StepChartTabs";
import { HealingHistory } from "./HealingHistory";
import { stopJob, type JobLiveStatusResponse } from "../api";

export interface LiveMonitorProps {
  jobKey: string;
  steps: PlanStep[];
  baseEnergy: number;
  /** 이 서브잡이 현재 화면에 보이는(활성) 탭인지 — 미러링은 활성만 */
  isActive: boolean;
  /** 종료 콜백(서브잡 상태 집계용) */
  onStatus?: (jobKey: string, status: string) => void;
}

/** cp2k 로그 라인을 톤(타임스탬프/녹/인디고/노랑)으로 색칠 */
function colorize(line: string): React.ReactNode {
  if (line.startsWith("[Suite]") || /all_finished|completed/i.test(line)) return tone("g", line);
  if (line.startsWith("[Step")) return tone("b", line);
  if (/converged/i.test(line)) return tone("g", line);
  if (/conv\s+[\d.eE+-]+/.test(line)) {
    // " SCF run | iter 03 | -245.83 | conv 9.8e-04"  → 수치 노랑 강조
    return <span>{line.replace(/(conv\s+)([\d.eE+-]+)/, "$1")}{tone("y", line.match(/conv\s+([\d.eE+-]+)/)?.[1] ?? "")}</span>;
  }
  return line;
}

export function LiveMonitor({ jobKey, steps, baseEnergy, isActive, onStatus }: LiveMonitorProps) {
  const { t } = useT();
  const setJobLive = useWizardStore((s) => s.setJobLive);

  const [stopped, setStopped] = useState(false);
  const [stopping, setStopping] = useState(false);
  const startRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  const { data, isTerminal } = useJobMonitor({ jobKey, steps, baseEnergy, stopped });

  // 경과 타이머(종료 시 정지)
  useEffect(() => {
    if (isTerminal) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isTerminal]);

  // 서브잡 상태를 부모로 보고(집계 탭 배지)
  useEffect(() => {
    if (data?.status) onStatus?.(jobKey, data.status);
  }, [data?.status, jobKey, onStatus]);

  // 활성 서브잡만 store.jobLive에 미러링(우측 패널/요약 소비)
  useEffect(() => {
    if (!isActive || !data) return;
    const mirror: JobLiveStatusResponse = data;
    setJobLive({
      status: mirror.status,
      active_step: mirror.active_step,
      total_steps: mirror.total_steps,
      message: mirror.message,
      healing_history: mirror.healing_history,
      logs: mirror.logs,
      step_histories: mirror.step_histories,
    });
  }, [isActive, data, setJobLive]);

  async function handleStop() {
    setStopping(true);
    try {
      await stopJob(jobKey);
      setStopped(true);
    } finally {
      setStopping(false);
    }
  }

  const logLines: LogLine[] = useMemo(() => {
    const logs = data?.logs ?? [];
    return logs.map((l, i) => ({
      id: i,
      html: colorize(l),
      cursor: !isTerminal && i === logs.length - 1,
    }));
  }, [data?.logs, isTerminal]);

  return (
    <div className="flex flex-col gap-s4">
      <RunBar data={data} elapsedSec={elapsed} terminal={isTerminal} onStop={handleStop} stopping={stopping} />

      <div className="grid-2 cards">
        <Card>
          <CardHead
            icon={<TerminalIcon size={16} strokeWidth={1.8} />}
            title={t("f4.term.header")}
          />
          <div className="mt-s3">
            <LogTerminal lines={logLines} height={300} maxLines={40} header={`${jobKey} · live`} />
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<Activity size={16} strokeWidth={1.8} />}
            title={t("f4.chart.title")}
            sub={t("f4.chart.sub")}
          />
          <div className="mt-s3">
            <StepChartTabs
              stepHistories={data?.step_histories ?? {}}
              activeStep={data?.active_step}
              height={260}
            />
          </div>
        </Card>
      </div>

      <HealingHistory history={data?.healing_history} />
    </div>
  );
}
