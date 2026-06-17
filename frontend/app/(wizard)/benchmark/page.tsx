// app/(wizard)/benchmark/page.tsx — 12-레벨 정확도 벤치마크 대시보드 (f6-benchmark).
// ★ flow 독립 — AppShell 재사용((wizard)/layout), 위저드 store 의존 없음.
//   구조 업로드/플랜 없이 단독 실행: DEFAULT_OPTIONS 로 BenchmarkRequest 채움(atom_info/steps 미전송).
//   실제 백엔드(MOCK=0)가 1순위, NEXT_PUBLIC_MOCK=1 일 때만 목 스트림 폴백.
"use client";

import * as React from "react";
import { Beaker } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { IS_MOCK } from "@/lib/api";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";

import {
  ALL_LEVELS,
  getBenchmarkStatus,
  isTerminalStatus,
  runBenchmark,
  stopBenchmark,
} from "@/features/f6-benchmark/api";
import { useBenchmarkPoll } from "@/features/f6-benchmark/hooks/use-benchmark-poll";
import { BenchmarkControls } from "@/features/f6-benchmark/components/benchmark-controls";
import { ProgressConsole } from "@/features/f6-benchmark/components/progress-console";
import { LevelGrid } from "@/features/f6-benchmark/components/level-grid";
import { ResultsTable } from "@/features/f6-benchmark/components/results-table";

export default function BenchmarkPage() {
  const { t, lang } = useT();

  // 폴링이 갱신하는 런타임 상태(persist 제외) — f6 슬라이스.
  const report = useWizardStore((s) => s.benchmarkStatus);
  const setBenchmarkStatus = useWizardStore((s) => s.setBenchmarkStatus);

  const [selected, setSelected] = React.useState<number[]>([...ALL_LEVELS]);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const { start, stop, polling, error } = useBenchmarkPoll(lang);

  // running 판정: 전역 status 가 Running 이거나 폴링 활성.
  const running = report?.status === "Running" || polling;

  // 레벨 토글/전체선택 (가동 중엔 비활성 처리는 컨트롤에서).
  const toggleLevel = React.useCallback((level: number) => {
    setSelected((prev) =>
      prev.includes(level)
        ? prev.filter((l) => l !== level)
        : [...prev, level].sort((a, b) => a - b)
    );
  }, []);
  const selectAll = React.useCallback(() => setSelected([...ALL_LEVELS]), []);
  const selectNone = React.useCallback(() => setSelected([]), []);

  const onRun = React.useCallback(async () => {
    if (selected.length === 0) {
      setNotice(t("f6.run.empty"));
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const res = await runBenchmark(selected);
      // api.md: HTTP 200 이라도 본문 status 가 error 일 수 있다(이미 실행 중) — 반드시 확인.
      if (res.status === "success") {
        setNotice(t("f6.run.started"));
        start(); // 폴링 시작(즉시 1회 + 2.5s 주기)
      } else {
        setNotice(res.message || t("f6.run.busy"));
        start(); // 이미 실행 중이어도 폴링해 현재 진행을 따라잡음
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("f6.error.load"));
    } finally {
      setBusy(false);
    }
  }, [selected, start, t]);

  const onStop = React.useCallback(async () => {
    setBusy(true);
    try {
      const res = await stopBenchmark();
      setNotice(
        res.status === "success"
          ? t("f6.stop.requested")
          : res.message || t("f6.stop.none")
      );
      // 중지 후에도 종료 상태(Stopped/Finished)까지 폴링을 계속해 마지막 reports 갱신.
      if (!polling) start();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : t("f6.error.load"));
    } finally {
      setBusy(false);
    }
  }, [polling, start, t]);

  // 마운트 시 한 번 현재 상태를 가져와 그리드/테이블을 채운다(이미 진행 중인 벤치마크 따라잡기).
  // 진행 중이면 폴링 유지, 아니면 1회 스냅샷 후 정지.
  React.useEffect(() => {
    let cancelled = false;
    getBenchmarkStatus(lang)
      .then((r) => {
        if (cancelled) return;
        setBenchmarkStatus(r);
        if (r.status === "Running" && !isTerminalStatus(r.status)) start();
      })
      .catch(() => {
        /* 초기 스냅샷 실패는 무시(가동 시 다시 시도) */
      });
    return () => {
      cancelled = true;
      stop(); // 언마운트 시 폴링 정리(누수 방지)
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reports = report?.reports ?? [];

  return (
    <div className="flex flex-col gap-s4">
      {/* 소개 헤더 */}
      <div className="flex items-start gap-s3">
        <span className="mt-px inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-md bg-accent-wash text-accent">
          <Beaker className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-s2">
            <h2 className="font-serif text-title font-medium text-ink">
              {t("rail.benchmark.title")}
            </h2>
            <Badge variant="indigo">{t("f6.badge.standalone")}</Badge>
            <Badge variant={IS_MOCK ? "neutral" : "green"}>
              {IS_MOCK ? t("f6.badge.mock") : t("f6.badge.live")}
            </Badge>
          </div>
          <p className="mt-s1 max-w-[70ch] text-sm text-ink-soft">
            {t("f6.subtitle")}
          </p>
        </div>
      </div>

      {/* 알림(가동/중지/에러 메시지) */}
      {(notice || error) && (
        <div className="rounded-md border border-accent-edge bg-accent-wash px-s4 py-s2 text-sm text-accent-ink">
          {notice ?? error}
        </div>
      )}

      <BenchmarkControls
        selected={selected}
        onToggleLevel={toggleLevel}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
        running={running}
        busy={busy}
        onRun={onRun}
        onStop={onStop}
      />

      <ProgressConsole report={report} selectedCount={selected.length} />

      <LevelGrid reports={reports} currentLevel={report?.current_level} />

      <ResultsTable reports={reports} />
    </div>
  );
}
