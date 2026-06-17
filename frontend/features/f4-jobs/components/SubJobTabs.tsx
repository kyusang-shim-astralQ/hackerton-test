// features/f4-jobs/components/SubJobTabs.tsx
// ★ 다중-CIF: 서브잡(=구조)별 탭으로 전환. 활성 탭만 전체 모니터(MonitorDashboard) 렌더.
//   각 탭은 가벼운 상태 폴링으로 진행/완료 배지를 갱신(서브잡 전체를 한눈에).
//   (동시에 무거운 차트/터미널을 N개 띄우지 않아 리소스 누수 최소화 — design-system §3.11 취지.)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import { usePolling } from "../hooks/usePolling";
import { fetchJobLiveStatus, isTerminalStatus } from "../api";
import { MOCK_TICK_MS } from "../lib/mock-stream";
import { IS_MOCK } from "@/lib/api";
import { MonitorDashboard } from "./MonitorDashboard";
import type { JobStatus } from "@/stores/types";

const POLL_MS = IS_MOCK ? MOCK_TICK_MS : 8000;

/** 한 탭 버튼 — 자기 서브잡 상태를 폴링해 진행/완료 점을 표시.
 *  (활성 탭은 MonitorDashboard 가 같은 키를 폴링하지만, 목 스트림은 tick 마다 진행하므로
 *   비활성 탭의 가벼운 폴링이 서브잡을 끝까지 진행시켜 탭 전환이 항상 동작한다.) */
function SubJobTabButton({
  filename,
  jobKey,
  lang,
  active,
  onClick,
}: {
  filename: string;
  jobKey: string;
  lang: string;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useT();
  const { data } = usePolling<JobStatus>({
    queryKey: ["subjob-tab", jobKey, lang],
    queryFn: () => fetchJobLiveStatus(jobKey, lang),
    intervalMs: POLL_MS,
    stopWhen: (d) => isTerminalStatus(d.status),
  });

  const status = data?.status?.toLowerCase();
  const done = isTerminalStatus(data?.status);
  const failed =
    status === "failed" ||
    status === "error" ||
    status === "aborted" ||
    (status?.startsWith("submission failed") ?? false);

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-s2 rounded-md border px-s3 py-s2 text-sm transition-colors",
        active
          ? "border-accent bg-accent text-white"
          : "border-hairline-2 bg-card text-ink-soft hover:bg-inset"
      )}
    >
      <span className="font-mono">{filename}</span>
      <span
        className={cn(
          "h-[8px] w-[8px] rounded-pill",
          failed ? "bg-oxblood" : done ? "bg-ok" : "bg-accent-edge",
          !done && !failed && "animate-pulse"
        )}
        title={done ? t("f4.status.done") : t("f4.status.running")}
      />
    </button>
  );
}

export function SubJobTabs({
  subJobs,
  lang,
}: {
  subJobs: { filename: string; job_key: string }[];
  lang: string;
}) {
  const { t } = useT();
  const [activeKey, setActiveKey] = React.useState(subJobs[0]?.job_key);

  React.useEffect(() => {
    if (!subJobs.some((s) => s.job_key === activeKey)) {
      setActiveKey(subJobs[0]?.job_key);
    }
  }, [subJobs, activeKey]);

  if (subJobs.length === 0) return null;

  return (
    <div className="flex flex-col gap-s4">
      <div className="flex flex-col gap-s2">
        <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
          {t("f4.subjob.tabs")}
        </span>
        <div className="flex flex-wrap gap-s2" role="tablist">
          {subJobs.map((sj) => (
            <SubJobTabButton
              key={sj.job_key}
              filename={sj.filename}
              jobKey={sj.job_key}
              lang={lang}
              active={sj.job_key === activeKey}
              onClick={() => setActiveKey(sj.job_key)}
            />
          ))}
        </div>
      </div>

      {/* 활성 서브잡만 전체 모니터(서브잡 안에서 다시 스텝별 차트) */}
      {activeKey && <MonitorDashboard key={activeKey} jobKey={activeKey} lang={lang} />}
    </div>
  );
}
