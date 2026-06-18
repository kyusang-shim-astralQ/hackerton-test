"use client";
// app/(wizard)/benchmark/page.tsx — 정확도 벤치마크 대시보드 (독립 라우트 /benchmark, f6-benchmark)
// flow와 무관 — AppShell 재사용. StepRail 상시 행 / step-6 하단에서 진입. 둘 다 같은 /benchmark.
// 실제 백엔드(MOCK=0) 1순위, NEXT_PUBLIC_MOCK=1 일 때만 목 스트림 폴백.
// 계약: docs/features/f6-benchmark/api.md, data-models §18·19·20.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import "@/lib/i18n/f6-benchmark"; // 사전 등록(import 시점)

import { LevelSelector } from "@/features/f6-benchmark/components/LevelSelector";
import { LevelGrid } from "@/features/f6-benchmark/components/LevelGrid";
import { ResultTable } from "@/features/f6-benchmark/components/ResultTable";
import { BenchmarkLog } from "@/features/f6-benchmark/components/BenchmarkLog";
import { ParamsCard } from "@/features/f6-benchmark/components/ParamsCard";
import { useBenchmarkPolling } from "@/features/f6-benchmark/hooks/useBenchmarkPolling";
import { runBenchmark, stopBenchmark } from "@/features/f6-benchmark/api";
import {
  DEFAULT_OPTIONS,
  TOTAL_LEVELS,
  type BenchmarkLevelReport,
} from "@/features/f6-benchmark/types";

const ALL_LEVELS = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

function emptyReports(): BenchmarkLevelReport[] {
  return Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
    level: i + 1,
    status: "Pending" as const,
    agent_energy: null,
    official_energy: null,
    diff: null,
    message: "대기 중...",
    healing_count: 0,
  }));
}

export default function BenchmarkPage() {
  const { lang, t } = useT();

  // 선택 레벨(영속 입력) — 내 슬라이스
  const selectedLevels = useWizardStore((s) => s.selectedLevels);
  const setSelectedLevels = useWizardStore((s) => s.setSelectedLevels);
  const setBenchmarkReport = useWizardStore((s) => s.setBenchmarkReport);

  const selected = useMemo(() => new Set(selectedLevels), [selectedLevels]);

  const { report, start } = useBenchmarkPolling(lang);
  const startingRef = useRef(false);

  // 폴링 결과를 store에도 반영(요약/대시보드 공유)
  useEffect(() => {
    if (report) setBenchmarkReport(report);
  }, [report, setBenchmarkReport]);

  // 페이지 진입 시 이미 백엔드가 Running일 수 있으므로 즉시 1회 폴링 시작.
  // (Idle/Finished면 hook이 자동으로 폴링을 멈춘다.)
  useEffect(() => {
    start();
    // 언마운트 정리는 hook 내부에서 처리.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = report?.status === "Running";

  const toggleLevel = useCallback(
    (lv: number) => {
      const next = new Set(selectedLevels);
      if (next.has(lv)) next.delete(lv);
      else next.add(lv);
      setSelectedLevels(Array.from(next).sort((a, b) => a - b));
    },
    [selectedLevels, setSelectedLevels],
  );

  const selectAll = useCallback(() => setSelectedLevels([...ALL_LEVELS]), [setSelectedLevels]);
  const clearAll = useCallback(() => setSelectedLevels([]), [setSelectedLevels]);

  const handleRun = useCallback(async () => {
    if (startingRef.current || selectedLevels.length === 0) return;
    startingRef.current = true;
    try {
      const res = await runBenchmark({
        levels: [...selectedLevels].sort((a, b) => a - b),
        session_id: `bench_${Date.now()}`,
        ...DEFAULT_OPTIONS,
      });
      // status==="error"(이미 실행 중 등)여도 폴링은 시작해 현재 진행을 반영.
      if (res.status === "error") {
        // eslint-disable-next-line no-console
        console.warn("[benchmark] run rejected:", res.message);
      }
      start();
    } finally {
      startingRef.current = false;
    }
  }, [selectedLevels, start]);

  const handleStop = useCallback(async () => {
    await stopBenchmark();
    // 중지 후에도 종료 상태(Stopped/Finished)까지 폴링을 이어가 마지막 reports 갱신.
    start();
  }, [start]);

  const reports = report?.reports?.length ? report.reports : emptyReports();
  const currentLevel = report?.current_level ?? 0;
  const globalStatus = report?.status ?? "Idle";
  const logs = report?.logs ?? [];

  return (
    <div className="cards-stack max-w-[1080px]">
      <p className="text-sm text-ink-soft max-w-[80ch]">{t("bench.lead")}</p>

      {/* 레벨 선택 + 가동/중지 */}
      <LevelSelector
        selected={selected}
        onToggle={toggleLevel}
        onSelectAll={selectAll}
        onClear={clearAll}
        running={!!running}
        starting={false}
        onRun={handleRun}
        onStop={handleStop}
        locked={!!running}
      />

      {/* 상태 그리드 + 진행률 / 기본 파라미터 */}
      <div className="grid-2 cards">
        <LevelGrid reports={reports} currentLevel={currentLevel} globalStatus={globalStatus} />
        <ParamsCard />
      </div>

      {/* 레벨별 정확도 테이블 */}
      <ResultTable reports={reports} />

      {/* 실시간 로그 */}
      <BenchmarkLog logs={logs} />
    </div>
  );
}
