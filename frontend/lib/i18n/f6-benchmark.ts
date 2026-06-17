// lib/i18n/f6-benchmark.ts — f6-benchmark 사전 (prefix: f6.*)
// 12-레벨 정확도 벤치마크 대시보드: 컨트롤·그리드 상태·결과 테이블·로그·물성명.
import type { Dict } from "./index";

export const f6Dict: Dict = {
  ko: {
    "f6.placeholder": "정확도 벤치마크(독립 라우트) — f6-benchmark 가 채웁니다.",

    // 헤더 / 소개
    "f6.subtitle":
      "공식 결과(test/level1~12) 대비 에이전트 계산 정확도를 12개 케이스로 검증합니다. 구조 업로드/플랜 없이 단독 실행됩니다.",
    "f6.badge.standalone": "Flow 독립",
    "f6.badge.mock": "목 모드",
    "f6.badge.live": "실제 백엔드",

    // 레벨 선택 카드
    "f6.select.title": "벤치마크 레벨 선택",
    "f6.select.hint": "기본 1~12 전체. 데모용으로 가벼운 레벨만 부분 선택할 수 있습니다.",
    "f6.select.all": "전체 선택",
    "f6.select.none": "전체 해제",
    "f6.select.count": "{n}개 선택",

    // 컨트롤 (가동/중지)
    "f6.run": "통합 벤치마크 가동",
    "f6.running": "벤치마크 진행 중…",
    "f6.stop": "벤치마크 중지",
    "f6.run.empty": "레벨을 1개 이상 선택하세요.",
    "f6.run.started": "벤치마크 루프가 기동되었습니다.",
    "f6.run.busy": "이미 벤치마크가 진행 중입니다.",
    "f6.stop.requested": "벤치마크 중지를 요청했습니다.",
    "f6.stop.none": "진행 중인 벤치마크가 없습니다.",

    // 진행
    "f6.progress.title": "진행 상황",
    "f6.progress.level": "레벨 {cur} / {total}",
    "f6.progress.idle": "대기 중 — 가동 버튼을 누르세요.",
    "f6.progress.finished": "완료 — 모든 레벨 처리됨.",
    "f6.progress.stopped": "중지됨 — 폴링 종료.",
    "f6.progress.done": "{done}/{total} 처리",

    // 상태 그리드
    "f6.grid.title": "레벨 상태",

    // 결과 테이블
    "f6.table.title": "정확도 결과",
    "f6.table.level": "레벨",
    "f6.table.property": "물성",
    "f6.table.agent": "Agent 값",
    "f6.table.official": "공식 값",
    "f6.table.diff": "오차 %",
    "f6.table.healing": "치유",
    "f6.table.message": "메시지",
    "f6.table.empty": "아직 결과가 없습니다.",
    "f6.healed": "Healed {n}x",

    // 로그 콘솔
    "f6.logs.title": "실시간 로그",
    "f6.logs.header": "benchmark · live",
    "f6.logs.empty": "— 로그 없음 —",

    // 레벨 상태값 (reports[i].status)
    "f6.status.Pending": "대기",
    "f6.status.Running": "실행 중",
    "f6.status.Recovering": "자가치유 중",
    "f6.status.SUCCESS": "정확",
    "f6.status.INCORRECT": "불일치",
    "f6.status.FAILURE": "실패",
    "f6.status.Skipped": "건너뜀",
    "f6.status.Aborted": "중단됨",

    // 레벨→물성 (LEVEL_TO_PROPERTY)
    "f6.prop.geo_opt": "구조 최적화",
    "f6.prop.energy": "단일점 에너지",
    "f6.prop.dos": "상태밀도(DOS)",
    "f6.prop.band": "밴드 구조",
    "f6.prop.aimd": "AIMD",
    "f6.prop.vibrational": "진동(포논)",
    "f6.prop.neb": "NEB 경로",
    "f6.prop.adsorption": "흡착 에너지",
    "f6.prop.absorption": "흡수 스펙트럼",
    "f6.prop.emission": "방출 스펙트럼",
    "f6.prop.work_function": "일함수",
    "f6.prop.hirshfeld": "Hirshfeld 전하",

    "f6.error.load": "상태를 불러오지 못했습니다.",
  },
  en: {
    "f6.placeholder": "Accuracy benchmark (standalone route) — owned by f6-benchmark.",

    "f6.subtitle":
      "Validates agent accuracy against official results (test/level1–12) across 12 cases. Runs standalone — no structure upload or plan required.",
    "f6.badge.standalone": "Flow-independent",
    "f6.badge.mock": "Mock mode",
    "f6.badge.live": "Live backend",

    "f6.select.title": "Select benchmark levels",
    "f6.select.hint": "Defaults to all 1–12. For demos you may pick only the lighter levels.",
    "f6.select.all": "Select all",
    "f6.select.none": "Clear all",
    "f6.select.count": "{n} selected",

    "f6.run": "Run combined benchmark",
    "f6.running": "Benchmark running…",
    "f6.stop": "Stop benchmark",
    "f6.run.empty": "Select at least one level.",
    "f6.run.started": "Benchmark loop started.",
    "f6.run.busy": "A benchmark is already running.",
    "f6.stop.requested": "Stop requested.",
    "f6.stop.none": "No benchmark in progress.",

    "f6.progress.title": "Progress",
    "f6.progress.level": "Level {cur} / {total}",
    "f6.progress.idle": "Idle — press Run to start.",
    "f6.progress.finished": "Finished — all levels processed.",
    "f6.progress.stopped": "Stopped — polling ended.",
    "f6.progress.done": "{done}/{total} processed",

    "f6.grid.title": "Level status",

    "f6.table.title": "Accuracy results",
    "f6.table.level": "Level",
    "f6.table.property": "Property",
    "f6.table.agent": "Agent",
    "f6.table.official": "Official",
    "f6.table.diff": "Error %",
    "f6.table.healing": "Healing",
    "f6.table.message": "Message",
    "f6.table.empty": "No results yet.",
    "f6.healed": "Healed {n}x",

    "f6.logs.title": "Live log",
    "f6.logs.header": "benchmark · live",
    "f6.logs.empty": "— no logs —",

    "f6.status.Pending": "Pending",
    "f6.status.Running": "Running",
    "f6.status.Recovering": "Self-healing",
    "f6.status.SUCCESS": "Correct",
    "f6.status.INCORRECT": "Mismatch",
    "f6.status.FAILURE": "Failure",
    "f6.status.Skipped": "Skipped",
    "f6.status.Aborted": "Aborted",

    "f6.prop.geo_opt": "Geometry opt.",
    "f6.prop.energy": "Single-point energy",
    "f6.prop.dos": "Density of states",
    "f6.prop.band": "Band structure",
    "f6.prop.aimd": "AIMD",
    "f6.prop.vibrational": "Vibrational (phonon)",
    "f6.prop.neb": "NEB path",
    "f6.prop.adsorption": "Adsorption energy",
    "f6.prop.absorption": "Absorption spectrum",
    "f6.prop.emission": "Emission spectrum",
    "f6.prop.work_function": "Work function",
    "f6.prop.hirshfeld": "Hirshfeld charges",

    "f6.error.load": "Failed to load status.",
  },
};
