// features/f6-benchmark/hooks/use-benchmark-poll.ts
// /api/benchmark/status 를 2.5초 주기 폴링. 종료 상태(Finished/Stopped/Failure)면 중단.
// 폴링 누수 없음: 언마운트/종료 시 타이머·in-flight 가드 정리. status 는 f6 store 슬라이스에 반영.
"use client";

import * as React from "react";
import { useWizardStore } from "@/stores/wizard-store";
import { getBenchmarkStatus, isTerminalStatus } from "../api";

const POLL_MS = 2500;

export interface UseBenchmarkPoll {
  /** 폴링 시작(run 성공 후 호출). 이미 폴링 중이면 무시. */
  start: () => void;
  /** 폴링 강제 중단(수동/언마운트). */
  stop: () => void;
  /** 현재 폴링 활성 여부. */
  polling: boolean;
  /** 마지막 폴링 에러(있으면). */
  error: string | null;
}

export function useBenchmarkPoll(lang?: string): UseBenchmarkPoll {
  const setBenchmarkStatus = useWizardStore((s) => s.setBenchmarkStatus);

  const [polling, setPolling] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 타이머/생존 가드: ref 로 들고 effect/콜백 사이에서 안전하게 정리.
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = React.useRef(false);
  const inFlightRef = React.useRef(false);
  const langRef = React.useRef(lang);
  langRef.current = lang;

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stop = React.useCallback(() => {
    aliveRef.current = false;
    clearTimer();
    setPolling(false);
  }, [clearTimer]);

  // 한 번 폴링 후 종료가 아니면 다음 tick 예약.
  const tick = React.useCallback(async () => {
    if (!aliveRef.current || inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const report = await getBenchmarkStatus(langRef.current);
      if (!aliveRef.current) return; // 언마운트/중단됨
      setBenchmarkStatus(report);
      setError(null);
      if (isTerminalStatus(report.status)) {
        stop(); // 종료 상태 → 폴링 중단(마지막 reports 는 이미 반영)
        return;
      }
    } catch (e) {
      if (!aliveRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      // 일시 오류는 계속 재시도(종료로 보지 않음).
    } finally {
      inFlightRef.current = false;
    }
    if (aliveRef.current) {
      timerRef.current = setTimeout(tick, POLL_MS);
    }
  }, [setBenchmarkStatus, stop]);

  const start = React.useCallback(() => {
    if (aliveRef.current) return; // 이미 폴링 중
    aliveRef.current = true;
    setPolling(true);
    setError(null);
    void tick(); // 즉시 1회 + 이후 주기
  }, [tick]);

  // 언마운트 정리 — 누수 방지.
  React.useEffect(() => {
    return () => {
      aliveRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return { start, stop, polling, error };
}
