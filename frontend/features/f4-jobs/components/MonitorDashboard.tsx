// features/f4-jobs/components/MonitorDashboard.tsx
// 단일 잡(또는 하나의 서브잡) 라이브 모니터: 8초 폴링 → RunBar + LogTerminal + 스텝별 차트 + 자가치유 + TDDFT.
// 실제 폴링 코드 경로 = 목 스트림 경로(둘 다 fetchJobLiveStatus → JobStatus).
"use client";

import * as React from "react";
import { Terminal, LineChart, Wand2 } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { LogTerminal, type LogLine, type LogTone } from "@/components/ui/log-terminal";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";
import { usePolling } from "../hooks/usePolling";
import { fetchJobLiveStatus, stopJob, isTerminalStatus } from "../api";
import { MOCK_TICK_MS } from "../lib/mock-stream";
import { IS_MOCK } from "@/lib/api";
import { RunBar } from "./RunBar";
import { StepCharts } from "./StepCharts";
import type { JobStatus } from "@/stores/types";

const POLL_MS = IS_MOCK ? MOCK_TICK_MS : 8000;

/** 로그 한 줄의 톤 분류(타임스탬프/AI Fix/SCF/done). */
function toneOf(line: string): LogTone {
  if (/\[AI Fix\]|\[Heal/.test(line)) return "y";
  if (/converged|all stages finished|completed|Done/i.test(line)) return "g";
  if (/qsub|coordinates chained|qdel|Step \d/.test(line)) return "b";
  return "default";
}

export function MonitorDashboard({
  jobKey,
  lang,
}: {
  jobKey: string;
  lang: string;
}) {
  const { t } = useT();
  const setJobLive = useWizardStore((s) => s.setJobLive);
  const [stopping, setStopping] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const startRef = React.useRef(Date.now());

  // 키가 바뀌면 경과 타이머 리셋
  React.useEffect(() => {
    startRef.current = Date.now();
    setElapsed(0);
  }, [jobKey]);

  const { data, error } = usePolling<JobStatus>({
    queryKey: ["job-live", jobKey, lang],
    queryFn: () => fetchJobLiveStatus(jobKey, lang),
    intervalMs: POLL_MS,
    stopWhen: (d) => isTerminalStatus(d.status),
    onData: (d) => {
      // 우측 SummaryPanel 라이브 미러로 진행 상태를 흘려보냄(store 의 jobLive 구독).
      setJobLive({
        byKey: { [jobKey]: d },
        finished: isTerminalStatus(d.status),
      });
    },
  });

  // 경과 시간 — 종료되면 멈춤
  React.useEffect(() => {
    const terminal = data ? isTerminalStatus(data.status) : false;
    if (terminal) return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [data?.status]);

  const handleStop = React.useCallback(async () => {
    if (!window.confirm(t("f4.monitor.stopConfirm"))) return;
    setStopping(true);
    try {
      await stopJob(jobKey, lang);
    } finally {
      setStopping(false);
    }
  }, [jobKey, lang, t]);

  if (!data) {
    return (
      <Card>
        <CardContent className="text-ink-faint">
          {error ? `${t("f4.submit.error")}: ${error.message}` : t("f4.submit.submitting")}
        </CardContent>
      </Card>
    );
  }

  const logLines: LogLine[] = (data.logs ?? []).map((line, i, arr) => ({
    id: i,
    html: line,
    tone: toneOf(line),
    cursor: i === arr.length - 1 && !isTerminalStatus(data.status),
  }));

  const target = 1.0e-6;
  const tddft = data.tddft_progress;

  return (
    <div className="flex flex-col gap-s4">
      <RunBar
        job={data}
        elapsedSec={elapsed}
        onStop={handleStop}
        stopping={stopping}
      />

      {/* 자가치유 이력 — "AI가 에러를 읽고 스스로 고쳤다" 하이라이트 */}
      {data.healing_history && data.healing_history.length > 0 && (
        <Card variant="accent">
          <CardHead icon={<Wand2 />} title={t("f4.monitor.healing")} />
          <CardContent>
            <ul className="flex flex-col gap-s1 font-mono text-sm text-accent-ink">
              {data.healing_history.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 좌: 로그 터미널 / 우: 스텝별 수렴 차트 */}
      <div className="grid grid-cols-1 gap-s4 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardHead icon={<Terminal />} title={t("f4.monitor.logTitle")} />
          <LogTerminal
            lines={logLines}
            header={t("f4.monitor.sub")}
            height={300}
            maxLines={40}
          />
        </Card>

        <Card className="flex flex-col">
          <CardHead
            icon={<LineChart />}
            title={t("f4.monitor.chartTitle")}
            sub={t("f4.monitor.chartLog", { target: target.toExponential(0) })}
          />
          <StepCharts job={data} height={264} />
        </Card>
      </div>

      {/* TDDFT 여기상태 그리드(해당 시) */}
      {tddft && (
        <Card>
          <CardHead
            icon={<LineChart />}
            title={t("f4.monitor.tddft")}
            sub={t("f4.monitor.tddftConverged", {
              c: tddft.converged_states,
              t: tddft.total_states,
            })}
          />
          <CardContent>
            <div className="grid grid-cols-4 gap-s2 sm:grid-cols-6">
              {Array.from({ length: tddft.total_states }).map((_, i) => (
                <div
                  key={i}
                  className={
                    i < tddft.converged_states
                      ? "rounded-md border border-[#c2d4bf] bg-ok-wash px-s2 py-s1 text-center font-mono text-sm text-ok"
                      : "rounded-md border border-hairline-2 bg-inset px-s2 py-s1 text-center font-mono text-sm text-ink-faint"
                  }
                >
                  {t("f4.monitor.tddftState", { i: i + 1 })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
