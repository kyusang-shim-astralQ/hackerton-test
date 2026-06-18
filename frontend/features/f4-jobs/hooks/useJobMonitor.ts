"use client";
// features/f4-jobs/hooks/useJobMonitor.ts — 서브잡 1개의 라이브 상태 소스.
// MOCK이면 클라이언트 타이머 스트림(실제 폴링과 동일한 JobLiveStatusResponse 렌더), 아니면 usePolling(8초).
// 종료 상태에서 멈추고 언마운트/키 변경 시 타이머·쿼리를 정리한다(setInterval 누수 방지, fe/05 DoD).
import { useEffect, useRef, useState } from "react";
import { MOCK } from "@/lib/api";
import { useT } from "@/lib/i18n/provider";
import type { PlanStep } from "@/stores/types";
import { usePolling } from "./usePolling";
import {
  fetchLiveStatus,
  isTerminal,
  mockJobStatusAtTick,
  mockBaseEnergy,
  type JobLiveStatusResponse,
} from "../api";

const MOCK_TICK_MS = 700; // 목은 8초보다 짧게(데모 속도)
const REAL_INTERVAL_MS = 8000; // 계약: 8초 폴링

export interface JobMonitorInput {
  jobKey: string;
  steps: PlanStep[];
  baseEnergy: number;
  /** STOP 누른 뒤 강제 중지 상태로 표시(스트림 정지) */
  stopped?: boolean;
  enabled?: boolean;
}

export interface JobMonitorResult {
  data?: JobLiveStatusResponse;
  isTerminal: boolean;
  error?: unknown;
}

/** MOCK 전용: 클라이언트 타이머로 tick을 증가시키며 가짜 JobLiveStatusResponse 생성. */
function useMockMonitor(input: JobMonitorInput): JobMonitorResult {
  const { lang } = useT();
  const { jobKey, steps, baseEnergy, stopped, enabled = true } = input;
  const [data, setData] = useState<JobLiveStatusResponse>();
  const tickRef = useRef(0);

  useEffect(() => {
    // 키/스텝이 바뀌면 처음부터(새 서브잡)
    tickRef.current = 0;
    setData(undefined);
    if (!enabled) return;

    let cancelled = false;
    // 즉시 1틱(빈 화면 방지) 후 인터벌
    const emit = () => {
      if (cancelled) return;
      const r = mockJobStatusAtTick(jobKey, steps, baseEnergy, tickRef.current, lang);
      setData(r.status);
      if (r.done) {
        clearInterval(id);
        return;
      }
      tickRef.current += 1;
    };
    emit();
    const id = setInterval(emit, MOCK_TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // jobKey/steps 길이/lang 변화 시 재시작
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobKey, steps.length, baseEnergy, lang, enabled]);

  // STOP: 마지막 스냅샷을 aborted로 동결
  if (stopped && data) {
    return {
      data: {
        ...data,
        status: "aborted",
        message: lang === "en" ? "Aborted by user (qdel)" : "사용자에 의해 중단됨 (qdel)",
      },
      isTerminal: true,
    };
  }

  return { data, isTerminal: isTerminal(data?.status) };
}

/** 실제 백엔드: usePolling(8초). 종료 상태에서 자동 정지. */
function useRealMonitor(input: JobMonitorInput): JobMonitorResult {
  const { lang } = useT();
  const { jobKey, stopped, enabled = true } = input;
  const q = usePolling<JobLiveStatusResponse>({
    queryKey: ["job-live-status", jobKey, lang],
    queryFn: () => fetchLiveStatus(jobKey, lang),
    intervalMs: REAL_INTERVAL_MS,
    stopWhen: (d) => isTerminal(d.status),
    enabled: enabled && !!jobKey && !stopped,
  });

  const data = q.data;
  if (stopped && data) {
    return { data: { ...data, status: "aborted" }, isTerminal: true, error: q.error };
  }
  return { data, isTerminal: isTerminal(data?.status), error: q.error };
}

export function useJobMonitor(input: JobMonitorInput): JobMonitorResult {
  // MOCK은 빌드 타임 상수이므로 훅 호출 순서가 렌더 간 안정적이다.
  const mock = useMockMonitor(MOCK ? input : { ...input, enabled: false });
  const real = useRealMonitor(MOCK ? { ...input, enabled: false } : input);
  return MOCK ? mock : real;
}

export { mockBaseEnergy };
