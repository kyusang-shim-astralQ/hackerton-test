// lib/i18n/core.ts — 공유(셸/레일/요약/공통) 사전. 기능별 사전은 lib/i18n/<도메인>.ts 로 분리.
// 단일 소스: docs/design-system.md §6. 기본 ko + 영문 보조 라벨 구조.

export type Lang = "ko" | "en";

export type Dict = Record<string, string>;
export type LangDict = Record<Lang, Dict>;

export const coreDict: LangDict = {
  ko: {
    "brand.name": "AstralQ",
    "rail.heading.steps": "계산 단계",
    "rail.benchmark.title": "정확도 벤치마크",
    "rail.benchmark.label": "Benchmark · 1–12",
    "rail.foot.session": "세션",
    "rail.foot.autosave": "자동저장됨",
    "rail.foot.newcalc": "새 계산",

    "nav.prev": "이전",
    "nav.next": "다음",
    "nav.step": "단계",

    "summary.title": "요약 · 진행",
    "summary.collapse": "패널 접기",
    "summary.expand": "패널 펼치기",
    "summary.progress": "전체 진행",
    "summary.block.structure": "구조",
    "summary.block.property": "물성",
    "summary.block.options": "핵심 옵션",
    "summary.block.stages": "계산 단계",
    "summary.pending.select": "— 선택 전",
    "summary.pending.unselected": "— 미선택",
    "summary.pending.unset": "— 미설정",

    "lang.switch": "언어",
    "common.loading": "불러오는 중…",
    "common.error": "오류",
    "common.retry": "다시 시도",
    "common.empty": "표시할 내용이 없습니다",

    "newcalc.confirm": "현재 계산 입력을 모두 지우고 새로 시작할까요?",
  },
  en: {
    "brand.name": "AstralQ",
    "rail.heading.steps": "Steps",
    "rail.benchmark.title": "Accuracy Benchmark",
    "rail.benchmark.label": "Benchmark · 1–12",
    "rail.foot.session": "Session",
    "rail.foot.autosave": "Auto-saved",
    "rail.foot.newcalc": "New",

    "nav.prev": "Back",
    "nav.next": "Next",
    "nav.step": "Step",

    "summary.title": "Summary · Progress",
    "summary.collapse": "Collapse panel",
    "summary.expand": "Expand panel",
    "summary.progress": "Overall progress",
    "summary.block.structure": "Structure",
    "summary.block.property": "Property",
    "summary.block.options": "Key options",
    "summary.block.stages": "Stages",
    "summary.pending.select": "— not selected",
    "summary.pending.unselected": "— none",
    "summary.pending.unset": "— unset",

    "lang.switch": "Language",
    "common.loading": "Loading…",
    "common.error": "Error",
    "common.retry": "Retry",
    "common.empty": "Nothing to show",

    "newcalc.confirm": "Clear all current inputs and start a new calculation?",
  },
};
