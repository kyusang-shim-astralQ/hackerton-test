// features/f4-jobs/hooks/usePolling.ts
// 공유 폴링 훅(도메인 훅). design-system §5.3 의 계약을 네이티브 setInterval 로 구현
// (TanStack Query 미설치 환경 — refetchInterval 대신 타이머 + stopWhen 으로 동일 동작).
//
// ★ 종료 상태에서 정확히 멈추고, 언마운트/키 변경 시 인터벌 정리(누수 없음, fe/05 DoD).
"use client";

import * as React from "react";

export interface UsePollingOptions<T> {
  /** 폴링 식별 키들(바뀌면 재시작 + 데이터 리셋) */
  queryKey: unknown[];
  queryFn: () => Promise<T>;
  /** job-live-status: 8000(목은 더 짧게), benchmark: 3000 */
  intervalMs: number;
  /** 종료 판정 — true 면 폴링 중단(job: all_finished|Success|error|aborted) */
  stopWhen: (data: T) => boolean;
  enabled?: boolean;
  /** 매 성공 응답마다(즉시 fetch 포함) 호출 */
  onData?: (data: T) => void;
}

export interface UsePollingResult<T> {
  data: T | undefined;
  error: Error | null;
  isFetching: boolean;
  /** stopWhen 충족으로 폴링이 멈췄는지 */
  stopped: boolean;
}

export function usePolling<T>(opts: UsePollingOptions<T>): UsePollingResult<T> {
  const { queryFn, intervalMs, stopWhen, enabled = true, onData } = opts;

  const [data, setData] = React.useState<T | undefined>(undefined);
  const [error, setError] = React.useState<Error | null>(null);
  const [isFetching, setIsFetching] = React.useState(false);
  const [stopped, setStopped] = React.useState(false);

  // 최신 콜백을 ref 로 잡아 effect 의존성을 queryKey/interval/enabled 로만 한정.
  const queryFnRef = React.useRef(queryFn);
  const stopWhenRef = React.useRef(stopWhen);
  const onDataRef = React.useRef(onData);
  queryFnRef.current = queryFn;
  stopWhenRef.current = stopWhen;
  onDataRef.current = onData;

  const keyStr = JSON.stringify(opts.queryKey);

  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 키가 바뀌면 새 폴링 — 이전 데이터/상태 리셋
    setData(undefined);
    setError(null);
    setStopped(false);

    const run = async () => {
      if (cancelled) return;
      setIsFetching(true);
      try {
        const result = await queryFnRef.current();
        if (cancelled) return;
        setData(result);
        setError(null);
        onDataRef.current?.(result);
        if (stopWhenRef.current(result)) {
          setStopped(true);
          setIsFetching(false);
          return; // 종료 — 다음 tick 예약하지 않음(누수 방지)
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
      }
      if (cancelled) return;
      setIsFetching(false);
      timer = setTimeout(run, intervalMs);
    };

    // 즉시 1회 + 이후 주기 폴링
    run();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyStr, intervalMs, enabled]);

  return { data, error, isFetching, stopped };
}
