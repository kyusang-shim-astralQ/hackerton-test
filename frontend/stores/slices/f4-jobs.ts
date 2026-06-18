// stores/slices/f4-jobs.ts — 잡 제출/모니터 슬라이스. 소유: f4 담당.
// ⚠️ 런타임/잡 상태는 persist 제외 (죽은 잡 복원·"실행 중" 유령 방지, design-system §4.6).
import type { StateCreator } from "zustand";
import type { SubJob, JobLive } from "../types";

export interface F4Slice {
  jobName?: string;
  subJobs?: Record<string, SubJob>;
  activeSubJobKey?: string;
  jobLive?: JobLive;

  setJobName: (n: string) => void;
  setSubJobs: (j: Record<string, SubJob>) => void;
  setActiveSubJobKey: (k: string) => void;
  setJobLive: (l: JobLive) => void;
  clearJob: () => void;
}

export const F4_INITIAL = {
  jobName: undefined,
  subJobs: undefined,
  activeSubJobKey: undefined,
  jobLive: undefined,
};

// ✅ persist 제외 — 빈 배열 (런타임/잡 상태는 저장하지 않는다)
export const F4_PERSIST_KEYS = [] as const;

export const createF4Slice: StateCreator<F4Slice, [], [], F4Slice> = (set) => ({
  ...F4_INITIAL,
  setJobName: (jobName) => set({ jobName }),
  setSubJobs: (subJobs) => set({ subJobs }),
  setActiveSubJobKey: (activeSubJobKey) => set({ activeSubJobKey }),
  setJobLive: (jobLive) => set({ jobLive }),
  clearJob: () => set({ ...F4_INITIAL }),
});
