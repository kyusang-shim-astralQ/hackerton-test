"use client";
// features/f6-benchmark/hooks/useBenchmarkPolling.ts — /status 폴링 훅
// - 2.5초 주기 폴링, status가 Finished/Stopped/Failure 면 폴링 종료.
// - 언마운트/완료 시 정리(폴링 누수 없음).
import { useCallback, useEffect, useRef, useState } from "react";
import { getBenchmarkStatus } from "../api";
import { type BenchmarkReport } from "../types";

const POLL_MS = 2500;
const TERMINAL_STATES = new Set(["Finished", "Stopped", "Failure"]);

export interface UseBenchmarkPolling {
  report: BenchmarkReport | null;
  /** 폴링 활성 여부(타이머가 돌고 있는지) */
  polling: boolean;
  error: string | null;
  /** 폴링 시작(중복 호출 안전). 즉시 1회 fetch 후 주기 시작 */
  start: () => void;
  /** 폴링 강제 중단(타이머 정리만 — 상태는 유지) */
  stop: () => void;
}

export function useBenchmarkPolling(lang = "ko"): UseBenchmarkPolling {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const r = await getBenchmarkStatus(lang);
      if (!mountedRef.current) return;
      setReport(r);
      setError(null);
      if (TERMINAL_STATES.has(String(r.status))) {
        // 종료 상태 → 폴링 정지
        clearTimer();
        setPolling(false);
        return;
      }
      // 다음 폴링 예약
      clearTimer();
      timerRef.current = setTimeout(tick, POLL_MS);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      // 일시 오류여도 폴링은 계속(백엔드 기동 지연 등 회복 가능)
      clearTimer();
      timerRef.current = setTimeout(tick, POLL_MS);
    } finally {
      inFlightRef.current = false;
    }
  }, [lang, clearTimer]);

  const start = useCallback(() => {
    setPolling(true);
    clearTimer();
    void tick();
  }, [tick, clearTimer]);

  const stop = useCallback(() => {
    clearTimer();
    setPolling(false);
  }, [clearTimer]);

  // 언마운트 정리(폴링 누수 방지)
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  return { report, polling, error, start, stop };
}
