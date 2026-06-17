// stores/slices/f4-jobs.ts — 잡 제출/모니터 런타임 슬라이스 (f4 담당이 사용·확장).
// ★ 런타임/잡 상태는 persist 제외(죽은 잡 복원·"실행 중" 유령 방지, design-system §4.6).
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { JobLive, SubmitJobResponse } from "../types";

export interface F4Slice {
  jobName?: string; // SubmitJobResponse.directory
  submitResponse?: SubmitJobResponse;
  subJobs?: { filename: string; job_key: string }[];
  activeSubJobKey?: string;
  jobLive?: JobLive;

  setJobName: (name?: string) => void;
  setSubmitResponse: (r?: SubmitJobResponse) => void;
  setActiveSubJobKey: (k?: string) => void;
  setJobLive: (live?: JobLive) => void;
  /** step-5 진입 시 이전 런타임 잡 상태 정리(새 제출 준비) */
  clearJobRuntime: () => void;
}

export const F4_INITIAL = {
  jobName: undefined,
  submitResponse: undefined,
  subJobs: undefined,
  activeSubJobKey: undefined,
  jobLive: undefined,
};

/** ✅ persist 제외 — PERSIST_KEYS 비움(런타임/잡 상태는 저장하지 않음). */
export const F4_PERSIST_KEYS: (keyof F4Slice)[] = [];

export const createF4Slice: StateCreator<WizardState, [], [], F4Slice> = (
  set
) => ({
  ...F4_INITIAL,
  setJobName: (jobName) => set({ jobName }),
  setSubmitResponse: (submitResponse) =>
    set({
      submitResponse,
      jobName: submitResponse?.directory,
      subJobs: submitResponse?.sub_jobs,
    }),
  setActiveSubJobKey: (activeSubJobKey) => set({ activeSubJobKey }),
  setJobLive: (jobLive) => set({ jobLive }),
  clearJobRuntime: () =>
    set({
      jobName: undefined,
      submitResponse: undefined,
      subJobs: undefined,
      activeSubJobKey: undefined,
      jobLive: undefined,
    }),
});
