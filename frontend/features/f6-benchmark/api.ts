// features/f6-benchmark/api.ts — f6-benchmark fetch 래퍼 + NEXT_PUBLIC_MOCK 폴백.
// 단일 소스: docs/features/f6-benchmark/api.md + docs/contracts/data-models.md.
//   POST /api/benchmark/run   body {levels, ...DFT params}  → {status, message}
//   GET  /api/benchmark/status                              → BenchmarkReport
//   POST /api/benchmark/stop                                → {status, message}
// 실제 백엔드가 1순위. IS_MOCK 일 때만 가짜 진행 스트림으로 대체(클러스터/백엔드 없이 시연).
"use client";

import { apiFetch, IS_MOCK } from "@/lib/api";
import type { BenchmarkReport, BenchmarkLevelReport } from "@/stores/types";

/** 레벨→물성 매핑 (api.md / 프롬프트: 1 geo_opt … 12 hirshfeld). UI 표시·폴백용. */
export const LEVEL_TO_PROPERTY: Record<number, string> = {
  1: "geo_opt",
  2: "energy",
  3: "dos",
  4: "band",
  5: "aimd",
  6: "vibrational",
  7: "neb",
  8: "adsorption",
  9: "absorption",
  10: "emission",
  11: "work_function",
  12: "hirshfeld",
};

export const ALL_LEVELS: number[] = Object.keys(LEVEL_TO_PROPERTY).map(Number);
export const TOTAL_LEVELS = ALL_LEVELS.length;

/**
 * BenchmarkRequest 필수 DFT 파라미터 기본값 (f2 DEFAULT_OPTIONS 동등 상수).
 * ★ 벤치마크는 flow 독립 — atom_info/steps 는 보내지 않는다(레벨별 공식 CIF 는 백엔드가 로드).
 * 공식 INP 추출값이 있으면 백엔드가 그쪽을 우선(SSOT)하므로 여기 값은 폴백 기본값.
 */
export const DEFAULT_OPTIONS = {
  basis_set: "DZVP-MOLOPT-GTH",
  cutoff: 400.0,
  rel_cutoff: 50.0,
  functional: "PBE",
  method: "GPW",
  scf_algo: "OT",
  charge: 0,
  multiplicity: 1,
  use_smear: false,
  smear_temp: 300.0,
  eps_scf: "1.0E-6",
  periodic: "XYZ",
} as const;

export interface BenchmarkRunRequest {
  levels: number[];
  [key: string]: unknown;
}

export interface BenchmarkActionResponse {
  status: string; // "success" | "error"
  message: string;
}

/** POST /api/benchmark/run — 백그라운드 기동(fire-and-forget). 본문의 status 를 반드시 확인. */
export async function runBenchmark(
  levels: number[]
): Promise<BenchmarkActionResponse> {
  if (IS_MOCK) return mockRun(levels);
  return apiFetch<BenchmarkActionResponse>("/api/benchmark/run", {
    json: { levels, ...DEFAULT_OPTIONS },
  });
}

/** GET /api/benchmark/status — 실시간 폴링 소스. IS_MOCK 이면 가짜 진행 스트림. */
export async function getBenchmarkStatus(
  lang?: string
): Promise<BenchmarkReport> {
  if (IS_MOCK) return mockStatus();
  return apiFetch<BenchmarkReport>("/api/benchmark/status", {
    query: lang ? { lang } : undefined,
  });
}

/** POST /api/benchmark/stop — 진행 중 루프에 중지 요청. */
export async function stopBenchmark(): Promise<BenchmarkActionResponse> {
  if (IS_MOCK) return mockStop();
  return apiFetch<BenchmarkActionResponse>("/api/benchmark/stop", {
    method: "POST",
  });
}

/**
 * 종료 상태 판정 — 폴링 중단 기준. (api.md 라이프사이클 + stop 후 Stopped)
 * Idle 은 run 전 초기 상태이므로 종료로 보지 않는다(폴링은 run 직후에만 시작).
 */
export function isTerminalStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "finished" || s === "stopped" || s === "failure";
}

// ───────────────────────────── MOCK STREAM ─────────────────────────────
// NEXT_PUBLIC_MOCK === "1": 클러스터/백엔드 없이 6단계 흐름을 끝까지 시연.
// 모듈 수준 가변 상태로 current_level 을 1→12 진행시키고 reports 를 채우다 Finished.
// stop 요청 시 현재 레벨 Aborted + 남은 레벨 Skipped 로 즉시 종결.

interface MockState {
  running: boolean;
  stopped: boolean;
  startedAt: number;
  levels: number[];
  reports: BenchmarkLevelReport[];
  logs: string[];
}

let MOCK: MockState | null = null;

const MS_PER_LEVEL = 1200; // 데모용 짧은 주기 — 레벨당 ~1.2s

function freshReports(): BenchmarkLevelReport[] {
  return ALL_LEVELS.map((level) => ({
    level,
    property: LEVEL_TO_PROPERTY[level],
    status: "Pending",
    agent_energy: undefined,
    official_energy: undefined,
    diff: undefined,
    healing_count: 0,
    message: "대기 중...",
  }));
}

// 레벨별 그럴듯한 공식값/오차/치유 시드(결정적, 데모 일관성).
const MOCK_SEED: Record<
  number,
  { official: number; diffPct: number; healing: number; fail?: boolean }
> = {
  1: { official: -1029.4498, diffPct: 0.0002, healing: 0 },
  2: { official: -17.2011, diffPct: 0.0686, healing: 1 },
  3: { official: -54.7732, diffPct: 0.41, healing: 0 },
  4: { official: -132.5519, diffPct: 0.0091, healing: 0 },
  5: { official: -88.1043, diffPct: 0.0035, healing: 2 },
  6: { official: -210.6677, diffPct: 0.62, healing: 1 },
  7: { official: -301.2218, diffPct: 1.84, healing: 3, fail: true },
  8: { official: -45.9981, diffPct: 0.0008, healing: 0 },
  9: { official: -19.3344, diffPct: 0.27, healing: 0 },
  10: { official: -19.4102, diffPct: 0.0451, healing: 1 },
  11: { official: 4.7321, diffPct: 0.0099, healing: 0 },
  12: { official: 0.3187, diffPct: 0.073, healing: 0 },
};

function mockRun(levels: number[]): BenchmarkActionResponse {
  if (MOCK?.running) {
    return { status: "error", message: "이미 벤치마크가 진행 중입니다." };
  }
  const sel = levels.length > 0 ? [...levels].sort((a, b) => a - b) : ALL_LEVELS;
  MOCK = {
    running: true,
    stopped: false,
    startedAt: Date.now(),
    levels: sel,
    reports: freshReports(),
    logs: ["🚀 [BENCHMARK] (MOCK) 루프 기동 — 공식 결과 폴백 모드"],
  };
  return { status: "success", message: "벤치마크 루프가 기동되었습니다." };
}

function mockStop(): BenchmarkActionResponse {
  if (!MOCK?.running) {
    return { status: "error", message: "진행 중인 벤치마크가 없습니다." };
  }
  MOCK.stopped = true;
  return { status: "success", message: "벤치마크 중지를 요청했습니다." };
}

function finalizeLevel(level: number): BenchmarkLevelReport {
  const seed = MOCK_SEED[level];
  const prop = LEVEL_TO_PROPERTY[level];
  const diff = seed.diffPct;
  const agent = +(seed.official * (1 + (diff / 100) * (level % 2 ? 1 : -1))).toFixed(4);
  const healed =
    seed.healing > 0 ? ` (Healed ${seed.healing}x via SCF_NOT_CONVERGED)` : "";
  if (seed.fail) {
    return {
      level,
      property: prop,
      status: "FAILURE",
      agent_energy: undefined,
      official_energy: seed.official,
      diff: undefined,
      healing_count: seed.healing,
      message: `[Energy (Ha)] 자가치유 ${seed.healing}회 후에도 수렴 실패`,
    };
  }
  const ok = diff < 1.0;
  return {
    level,
    property: prop,
    status: ok ? "SUCCESS" : "INCORRECT",
    agent_energy: agent,
    official_energy: seed.official,
    diff,
    healing_count: seed.healing,
    message: `[Energy (Ha)] Error: ${diff}%${healed}`,
  };
}

function mockStatus(): BenchmarkReport {
  if (!MOCK) {
    return {
      status: "Idle",
      current_level: 0,
      reports: freshReports(),
      logs: [],
    };
  }
  const { levels, startedAt, reports } = MOCK;

  // 중지 요청 처리: 현재 진행 레벨 Aborted, 남은 선택 레벨 Skipped, 종결.
  if (MOCK.stopped && MOCK.running) {
    const idx = reports.findIndex((r) => r.status === "Running");
    if (idx >= 0) {
      reports[idx] = {
        ...reports[idx],
        status: "Aborted",
        message: "사용자 중지 요청으로 중단됨",
      };
    }
    for (const lv of levels) {
      const r = reports[lv - 1];
      if (r && r.status === "Pending") {
        reports[lv - 1] = { ...r, status: "Skipped", message: "중지로 건너뜀" };
      }
    }
    MOCK.running = false;
    MOCK.logs = [...MOCK.logs, "■ [BENCHMARK] 중지 요청 처리 — 폴링 종료"];
    return {
      status: "Stopped",
      current_level: idx >= 0 ? idx + 1 : 0,
      reports: [...reports],
      logs: [...MOCK.logs],
    };
  }

  // 경과 시간으로 처리한 선택 레벨 수 산출.
  const elapsed = Date.now() - startedAt;
  const processedCount = Math.min(
    levels.length,
    Math.floor(elapsed / MS_PER_LEVEL)
  );

  const logs = [...MOCK.logs];
  for (let i = 0; i < levels.length; i++) {
    const lv = levels[i];
    const slot = lv - 1;
    if (i < processedCount) {
      // 완료된 레벨 — 결과 확정(중복 로그 방지: 상태 전이 시에만 append).
      if (reports[slot].status === "Pending" || reports[slot].status === "Running") {
        reports[slot] = finalizeLevel(lv);
        logs.push(
          `✅ Level ${lv} (${LEVEL_TO_PROPERTY[lv]}) → ${reports[slot].status}`
        );
      }
    } else if (i === processedCount && MOCK.running) {
      // 현재 처리 중 레벨.
      if (reports[slot].status === "Pending") {
        reports[slot] = {
          ...reports[slot],
          status: "Running",
          message: "계산 및 수렴 감시 중...",
        };
        logs.push(`🚀 [BENCHMARK] Starting Level ${lv} / ${TOTAL_LEVELS}`);
      }
      break;
    }
  }
  MOCK.logs = logs;

  const finished = processedCount >= levels.length;
  if (finished) MOCK.running = false;
  const currentLevel = finished
    ? levels[levels.length - 1] ?? 0
    : levels[processedCount] ?? 0;

  return {
    status: finished ? "Finished" : "Running",
    current_level: currentLevel,
    reports: [...reports],
    logs: [...logs],
  };
}
