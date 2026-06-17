// lib/i18n/f5-report.ts — f5-report 사전 (6단계: AI 분석 리포트). prefix: f5.*
import type { Dict } from "./index";

export const f5Dict: Dict = {
  ko: {
    "f5.placeholder": "결과 리포트(6단계) — f5-report 가 채웁니다.",

    // 헤더/카드
    "f5.title": "결과 리포트",
    "f5.subtitle": "완료된 계산 산출물을 분석한 AI 연구 리포트입니다.",
    "f5.report.head": "AI 연구 리포트",
    "f5.summary.head": "핵심 요약",

    // 상태
    "f5.generating": "리포트 생성 중…",
    "f5.generating.hint": "계산 산출물을 분석하고 AI가 리포트를 작성하고 있습니다.",
    "f5.regenerate": "다시 생성",
    "f5.error.title": "리포트를 생성하지 못했습니다",
    "f5.error.noDir": "시뮬레이션 디렉토리를 찾을 수 없습니다.",
    "f5.error.noData": "추출된 물리 데이터가 없습니다.",
    "f5.error.noJob": "분석할 작업이 없습니다. 먼저 계산을 제출하세요(5단계).",
    "f5.mock.banner": "데모 모드 — 샘플 리포트(실제 계산 산출물 없음).",

    // KPI
    "f5.kpi.finalEnergy": "최종 에너지",
    "f5.kpi.targetProperty": "타겟 물성",
    "f5.kpi.structure": "구조",
    "f5.kpi.unit.au": "a.u.",

    // 다중-CIF 비교
    "f5.multi.head": "구조별 주요 물성 종합 비교",
    "f5.multi.badge": "다중 구조 비교",
    "f5.multi.col.structure": "구조",
    "f5.multi.col.energy": "전체 에너지 (a.u.)",
    "f5.multi.col.target": "타겟 물성",
    "f5.multi.col.rank": "상대 안정성",
    "f5.multi.isostructural": "동일 구조(isostructural)",
    "f5.multi.chart.head": "구조별 전체 에너지 비교",
    "f5.multi.tabs": "구조별 수렴",

    // 스텝 차트
    "f5.steps.head": "스텝별 수렴 차트",
    "f5.steps.tab": "스텝",
    "f5.steps.none": "수렴 차트로 표시할 스텝 이력이 없습니다.",

    // 흡수 스펙트럼
    "f5.abs.head": "흡광 스펙트럼 (TDDFPT)",
    "f5.abs.badge": "Absorption · TDDFPT",
    "f5.abs.chart.x": "파장 (nm)",
    "f5.abs.chart.yLeft": "진동자 세기 (f)",
    "f5.abs.chart.yRight": "흡수 강도 (arb.)",
    "f5.abs.osc": "상태별 진동자 세기",
    "f5.abs.spectrum": "흡수 강도 (Gaussian)",
    "f5.abs.table.head": "들뜸 상태",
    "f5.abs.peaks.head": "주요 흡수 피크 (f > 0.01)",
    "f5.abs.col.state": "상태",
    "f5.abs.col.energy": "에너지 (eV)",
    "f5.abs.col.wavelength": "파장 (nm)",
    "f5.abs.col.osc": "진동자 세기 (f)",
    "f5.abs.col.region": "영역",
    "f5.abs.col.class": "분류",
    "f5.abs.dark": "암상태(dark)",
    "f5.abs.bright": "밝은 상태",

    // 액션
    "f5.dl.full": "전체 결과 (.tar.gz)",
    "f5.dl.disabled": "데모 모드에서는 다운로드가 비활성화됩니다.",
    "f5.new": "새 분석 시작",
    "f5.benchmark": "벤치마크 실행",
  },
  en: {
    "f5.placeholder": "Result report (Step 6) — owned by f5-report.",

    "f5.title": "Result Report",
    "f5.subtitle": "AI research report analyzing the completed calculation artifacts.",
    "f5.report.head": "AI Research Report",
    "f5.summary.head": "Key Summary",

    "f5.generating": "Generating report…",
    "f5.generating.hint": "Analyzing calculation artifacts; the AI is drafting the report.",
    "f5.regenerate": "Regenerate",
    "f5.error.title": "Failed to generate report",
    "f5.error.noDir": "Simulation directory not found.",
    "f5.error.noData": "No physical data extracted.",
    "f5.error.noJob": "No job to analyze. Submit a calculation first (Step 5).",
    "f5.mock.banner": "Demo mode — sample report (no real calculation artifacts).",

    "f5.kpi.finalEnergy": "Final Energy",
    "f5.kpi.targetProperty": "Target Property",
    "f5.kpi.structure": "Structure",
    "f5.kpi.unit.au": "a.u.",

    "f5.multi.head": "Comparative Summary of Key Properties by Structure",
    "f5.multi.badge": "Multi-structure comparison",
    "f5.multi.col.structure": "Structure",
    "f5.multi.col.energy": "Total Energy (a.u.)",
    "f5.multi.col.target": "Target Property",
    "f5.multi.col.rank": "Relative Stability",
    "f5.multi.isostructural": "isostructural",
    "f5.multi.chart.head": "Total Energy by Structure",
    "f5.multi.tabs": "Per-structure convergence",

    "f5.steps.head": "Per-step Convergence Charts",
    "f5.steps.tab": "Step",
    "f5.steps.none": "No step histories available to chart.",

    "f5.abs.head": "Absorption Spectrum (TDDFPT)",
    "f5.abs.badge": "Absorption · TDDFPT",
    "f5.abs.chart.x": "Wavelength (nm)",
    "f5.abs.chart.yLeft": "Oscillator strength (f)",
    "f5.abs.chart.yRight": "Absorption intensity (arb.)",
    "f5.abs.osc": "Oscillator strength per state",
    "f5.abs.spectrum": "Absorption intensity (Gaussian)",
    "f5.abs.table.head": "Excited States",
    "f5.abs.peaks.head": "Main Absorption Peaks (f > 0.01)",
    "f5.abs.col.state": "State",
    "f5.abs.col.energy": "Energy (eV)",
    "f5.abs.col.wavelength": "Wavelength (nm)",
    "f5.abs.col.osc": "Osc. strength (f)",
    "f5.abs.col.region": "Region",
    "f5.abs.col.class": "Class",
    "f5.abs.dark": "dark state",
    "f5.abs.bright": "bright state",

    "f5.dl.full": "Full results (.tar.gz)",
    "f5.dl.disabled": "Download is disabled in demo mode.",
    "f5.new": "Start new analysis",
    "f5.benchmark": "Run benchmark",
  },
};
