// features/f6-benchmark/api.ts — 벤치마크 fetch 래퍼 + 목 스트림 폴백
// 실제 백엔드(MOCK=0)가 1순위. NEXT_PUBLIC_MOCK==="1" 일 때만 목 진행 스트림으로 대체.
// 계약: docs/features/f6-benchmark/api.md, data-models §18·19·20.
import { apiFetch, MOCK } from "@/lib/api";
import {
  type BenchmarkReport,
  type BenchmarkLevelReport,
  type BenchmarkRequest,
  type BenchmarkActionResponse,
  type LevelStatus,
  LEVEL_TO_PROPERTY,
  TOTAL_LEVELS,
} from "./types";

const RUN_PATH = "/api/benchmark/run";
const STATUS_PATH = "/api/benchmark/status";
const STOP_PATH = "/api/benchmark/stop";

// ============================================================
// 실제 백엔드 호출 (MOCK=0, 1순위)
// ============================================================

export async function runBenchmark(
  req: BenchmarkRequest,
): Promise<BenchmarkActionResponse> {
  if (MOCK) return mockRun(req);
  return apiFetch<BenchmarkActionResponse>(RUN_PATH, { json: req });
}

export async function getBenchmarkStatus(
  lang = "ko",
): Promise<BenchmarkReport> {
  if (MOCK) return mockStatus();
  return apiFetch<BenchmarkReport>(STATUS_PATH, { query: { lang } });
}

export async function stopBenchmark(): Promise<BenchmarkActionResponse> {
  if (MOCK) return mockStop();
  return apiFetch<BenchmarkActionResponse>(STOP_PATH, { method: "POST" });
}

// ============================================================
// 목 폴백 (NEXT_PUBLIC_MOCK === "1") — 클러스터/백엔드 없이 시연
// /run 즉시 성공 → /status 폴링 시마다 current_level 1→12 진행, 각 레벨 reports 채워지다 Finished.
// ============================================================

interface MockState {
  active: boolean;
  startedLevels: number[]; // 선택된 레벨(정렬)
  cursor: number; // startedLevels 내 진행 인덱스
  status: "Idle" | "Running" | "Finished" | "Stopped";
  reports: BenchmarkLevelReport[]; // 항상 12 슬롯
  logs: string[];
  stopRequested: boolean;
  ticksOnCurrent: number; // 같은 레벨에서 머문 폴링 횟수(Running→결과 전환 지연용)
}

let mock: MockState | null = null;

function emptyReports(): BenchmarkLevelReport[] {
  return Array.from({ length: TOTAL_LEVELS }, (_, i) => ({
    level: i + 1,
    status: "Pending" as LevelStatus,
    agent_energy: null,
    official_energy: null,
    diff: null,
    message: "대기 중...",
    healing_count: 0,
  }));
}

/** 레벨별 그럴듯한 결과를 결정적으로 생성(데모 안정성). 일부 레벨에 치유/오답 섞기. */
function finalizeLevel(level: number): BenchmarkLevelReport {
  const prop = LEVEL_TO_PROPERTY[level] ?? "energy";
  // 레벨 의미별 라벨 + 기준값(데모용 결정적 값)
  const isExcitation = prop === "absorption" || prop === "emission";
  const isVib = prop === "vibrational";
  const label = isExcitation
    ? "Excitation (eV)"
    : isVib
      ? "Frequency (cm^-1)"
      : "Energy (Ha)";

  const official = isExcitation
    ? 3.4 + level * 0.05
    : isVib
      ? 1500 + level * 12
      : -(100 + level * 73.21);
  // 레벨 7(neb)은 INCORRECT, 레벨 5(aimd)는 FAILURE 시연용
  if (level === 7) {
    const agent = official * 1.031;
    const diff = Math.abs((agent - official) / official) * 100;
    return {
      level,
      status: "INCORRECT",
      agent_energy: round(agent),
      official_energy: round(official),
      diff: round(diff, 4),
      message: `[${label}] Error: ${diff.toFixed(4)}% (오차 1.0% 초과)`,
      healing_count: 1,
      last_diag: "GEOMETRY_DIVERGED",
    };
  }
  if (level === 5) {
    return {
      level,
      status: "FAILURE",
      agent_energy: null,
      official_energy: round(official),
      diff: null,
      message: `[${label}] 자가치유 3회 실패 (수치 추출 실패)`,
      healing_count: 3,
      last_diag: "SCF_NOT_CONVERGED",
    };
  }
  // 레벨 2·9는 치유 1회 후 SUCCESS
  const healed = level === 2 || level === 9;
  const agent = official * (1 + (level % 2 === 0 ? 1 : -1) * 0.00008 * level);
  const diff = Math.abs((agent - official) / official) * 100;
  return {
    level,
    status: "SUCCESS",
    agent_energy: round(agent),
    official_energy: round(official),
    diff: round(diff, 4),
    message: healed
      ? `[${label}] Error: ${diff.toFixed(4)}% (Healed 1x via SCF_NOT_CONVERGED)`
      : `[${label}] Error: ${diff.toFixed(4)}%`,
    healing_count: healed ? 1 : 0,
    ...(healed ? { last_diag: "SCF_NOT_CONVERGED" } : {}),
  };
}

function round(n: number, digits = 4): number {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

function mockRun(req: BenchmarkRequest): BenchmarkActionResponse {
  if (mock && mock.status === "Running") {
    return { status: "error", message: "이미 벤치마크가 진행 중입니다." };
  }
  const levels =
    req.levels && req.levels.length > 0
      ? [...req.levels].sort((a, b) => a - b)
      : Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

  const reports = emptyReports();
  // 선택되지 않은 레벨은 Skipped 로 표시
  for (const r of reports) {
    if (!levels.includes(r.level)) {
      r.status = "Skipped";
      r.message = "선택되지 않음";
    }
  }
  mock = {
    active: true,
    startedLevels: levels,
    cursor: 0,
    status: "Running",
    reports,
    logs: [`🚀 [BENCHMARK] 목 스트림 기동 — 레벨 ${levels.join(", ")}`],
    stopRequested: false,
    ticksOnCurrent: 0,
  };
  return { status: "success", message: "벤치마크 루프가 기동되었습니다." };
}

function mockStop(): BenchmarkActionResponse {
  if (!mock || mock.status !== "Running") {
    return { status: "error", message: "진행 중인 벤치마크가 없습니다." };
  }
  mock.stopRequested = true;
  mock.logs.push("🛑 [BENCHMARK] 중지 요청 수신 — 현재 레벨 Aborted, 남은 레벨 Skipped");
  return { status: "success", message: "벤치마크 중지를 요청했습니다." };
}

function mockStatus(): BenchmarkReport {
  if (!mock) {
    return {
      status: "Idle",
      current_level: 0,
      total_levels: TOTAL_LEVELS,
      reports: emptyReports(),
      logs: [],
      logs_pos: 0,
    };
  }

  if (mock.status === "Running") {
    const level = mock.startedLevels[mock.cursor];

    // 중지 요청 처리: 현재 레벨 Aborted, 남은 레벨 Skipped, 즉시 Stopped 종료.
    if (mock.stopRequested) {
      const idx = level - 1;
      if (idx >= 0 && idx < mock.reports.length) {
        mock.reports[idx] = {
          ...mock.reports[idx],
          status: "Aborted",
          message: "사용자 중지로 중단됨 (Aborted)",
        };
      }
      for (let c = mock.cursor + 1; c < mock.startedLevels.length; c++) {
        const li = mock.startedLevels[c] - 1;
        mock.reports[li] = {
          ...mock.reports[li],
          status: "Skipped",
          message: "중지로 건너뜀 (Skipped)",
        };
      }
      mock.status = "Stopped";
      mock.logs.push("⏹️ [BENCHMARK] 중지 완료 — Stopped");
      return snapshot(mock, 0);
    }

    const idx = level - 1;
    // 첫 폴링: 레벨 Running 표시
    if (mock.ticksOnCurrent === 0) {
      mock.reports[idx] = {
        ...mock.reports[idx],
        status: "Running",
        message: `계산 및 수렴 감시 중... (${LEVEL_TO_PROPERTY[level]})`,
      };
      mock.logs.push(`🚀 [BENCHMARK] Starting Level ${level} / ${TOTAL_LEVELS}`);
      mock.ticksOnCurrent = 1;
      return snapshot(mock, level);
    }
    // 두 번째 폴링: 일부 레벨은 Recovering 단계 노출
    if (mock.ticksOnCurrent === 1 && (level === 2 || level === 5 || level === 9)) {
      mock.reports[idx] = {
        ...mock.reports[idx],
        status: "Recovering...",
        message: "자가치유 재시도 중 (SCF_NOT_CONVERGED)",
      };
      mock.logs.push(`🔧 [HEAL] Level ${level} 자가치유 시도 1/3`);
      mock.ticksOnCurrent = 2;
      return snapshot(mock, level);
    }
    // 결과 확정 후 다음 레벨로 진행
    const finalized = finalizeLevel(level);
    mock.reports[idx] = finalized;
    mock.logs.push(resultLog(finalized));
    mock.cursor += 1;
    mock.ticksOnCurrent = 0;

    if (mock.cursor >= mock.startedLevels.length) {
      mock.status = "Finished";
      mock.logs.push("🏁 [BENCHMARK] 모든 레벨 완료 — Finished");
      return snapshot(mock, 0);
    }
    return snapshot(mock, mock.startedLevels[mock.cursor]);
  }

  // Finished / Stopped: 마지막 상태 고정 반환
  return snapshot(mock, 0);
}

function resultLog(r: BenchmarkLevelReport): string {
  const prop = LEVEL_TO_PROPERTY[r.level];
  if (r.status === "SUCCESS")
    return `✅ Level ${r.level} (${prop}) 통과 (오차 ${r.diff}%)`;
  if (r.status === "INCORRECT")
    return `⚠️ Level ${r.level} (${prop}) 오답 (오차 ${r.diff}%)`;
  return `❌ Level ${r.level} (${prop}) 실패`;
}

function snapshot(m: MockState, current: number): BenchmarkReport {
  return {
    status: m.status,
    current_level: current,
    total_levels: TOTAL_LEVELS,
    reports: m.reports.map((r) => ({ ...r })),
    logs: [...m.logs],
    logs_pos: m.logs.length,
  };
}
