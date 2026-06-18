"use client";
// features/f4-jobs/hooks/usePolling.ts — 공유 폴링 훅 (design-system §5.3).
// React Query refetchInterval로 폴링하고, stopWhen 충족 시 정확히 멈춘다(setInterval 누수 없음 — 언마운트 시 RQ가 정리).
import { useQuery } from "@tanstack/react-query";

export interface UsePollingOptions<T> {
  queryKey: unknown[];
  queryFn: () => Promise<T>;
  intervalMs: number; // job-live-status: 8000
  stopWhen: (data: T) => boolean; // all_finished|Success|error|aborted
  enabled?: boolean;
}

export function usePolling<T>(opts: UsePollingOptions<T>) {
  return useQuery({
    queryKey: opts.queryKey,
    queryFn: opts.queryFn,
    enabled: opts.enabled ?? true,
    refetchInterval: (q) =>
      q.state.data && opts.stopWhen(q.state.data as T) ? false : opts.intervalMs,
    refetchOnWindowFocus: false,
  });
}
