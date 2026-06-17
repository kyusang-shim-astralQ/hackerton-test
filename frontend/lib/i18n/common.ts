// lib/i18n/common.ts — 공유 사전(레이아웃/StepRail/SummaryPanel/공통). 기능별 사전은 lib/i18n/<feature>.ts.
import type { Dict } from "./index";

export const commonDict: Dict = {
  ko: {
    "brand.name": "AstralQ",
    "brand.tagline": "CP2K Simulation Agent",

    "nav.prev": "이전",
    "nav.next": "다음",
    "nav.step": "단계",

    "rail.benchmark.title": "정확도 벤치마크",
    "rail.benchmark.label": "Benchmark · 1–12",
    "rail.session": "세션",
    "rail.autosaved": "자동저장됨",
    "rail.newCalc": "새 계산",

    "summary.title": "요약 · 진행",
    "summary.collapse": "패널 접기",
    "summary.expand": "패널 펼치기",
    "summary.progress": "전체 진행",
    "summary.pending": "— 선택 전",
    "summary.unselected": "— 미선택",
    "summary.unset": "— 미설정",

    "summary.block.structure": "구조",
    "summary.block.property": "물성",
    "summary.block.options": "핵심 옵션",
    "summary.block.plan": "플랜",
    "summary.block.run": "계산",
    "summary.block.report": "리포트",

    "common.loading": "불러오는 중…",
    "common.error": "오류",
    "common.retry": "다시 시도",
    "common.empty": "데이터 없음",
    "common.placeholder": "이 단계는 곧 채워집니다.",

    "step.1.title": "구조",
    "step.2.title": "물성",
    "step.3.title": "옵션",
    "step.4.title": "플랜",
    "step.5.title": "계산 · 모니터",
    "step.6.title": "리포트",
  },
  en: {
    "brand.name": "AstralQ",
    "brand.tagline": "CP2K Simulation Agent",

    "nav.prev": "Back",
    "nav.next": "Next",
    "nav.step": "Step",

    "rail.benchmark.title": "Accuracy Benchmark",
    "rail.benchmark.label": "Benchmark · 1–12",
    "rail.session": "Session",
    "rail.autosaved": "Auto-saved",
    "rail.newCalc": "New run",

    "summary.title": "Summary · Progress",
    "summary.collapse": "Collapse panel",
    "summary.expand": "Expand panel",
    "summary.progress": "Overall progress",
    "summary.pending": "— not yet",
    "summary.unselected": "— none selected",
    "summary.unset": "— unset",

    "summary.block.structure": "Structure",
    "summary.block.property": "Property",
    "summary.block.options": "Key options",
    "summary.block.plan": "Plan",
    "summary.block.run": "Run",
    "summary.block.report": "Report",

    "common.loading": "Loading…",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.empty": "No data",
    "common.placeholder": "This step will be filled in shortly.",

    "step.1.title": "Structure",
    "step.2.title": "Property",
    "step.3.title": "Options",
    "step.4.title": "Plan",
    "step.5.title": "Run · Monitor",
    "step.6.title": "Report",
  },
};
