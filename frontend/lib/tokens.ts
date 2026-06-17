// lib/tokens.ts — JS 상수 (Chart.js / 3Dmol은 CSS 변수를 직접 못 읽으므로 박제, design-system.md §2.2)

/** SCF |ΔE| 수렴 차트 색 (Chart.js). */
export const CHART = {
  line: "#36367a", // |ΔE| 라인 (accent)
  fillTop: "rgba(54,54,122,0.14)", // 영역 그라데이션 상단
  fillBottom: "rgba(54,54,122,0)", // 영역 그라데이션 하단
  grid: "#e6e4dd", // 로그축 그리드 (hairline-soft)
  tick: "#6f6d66", // 틱 라벨 (ink-faint)
  tooltipBg: "#1b1b1a", // 툴팁 배경 (ink)
  tickFont: "'JetBrains Mono', monospace",
} as const;

/** 3Dmol 원소/결합 색. */
export const VIEWER = {
  bg: "white",
  ti: "#4a4a82", // Ti sphere (딥인디고 계열)
  o: "#b04a44", // O sphere (옥스블러드 계열)
  stick: "#9aa0b5", // 결합 막대
} as const;

/** 라이브 터미널 다크 표면 색 (design-system §2.1 다크 영역 예외 / §3.9). */
export const TERM = {
  bg: "#16161e",
  border: "#2a2a38",
  ink: "#c7c7d6",
  ts: "#5b5b72",
  green: "#7fd08a",
  indigo: "#9b9bf0",
  yellow: "#d6b46a",
} as const;

/**
 * 3Dmol CPK-ish 원소 색 (주요 원소만, 나머지는 회색 폴백).
 * VIEWER.ti/o 외 흔한 원소를 위한 보조 팔레트(분자 뷰어가 단색이 되지 않도록).
 */
export const ELEMENT_COLORS: Record<string, string> = {
  H: "#cfcfd6",
  C: "#56565f",
  N: "#3a5fb0",
  O: "#b04a44",
  F: "#5fa86b",
  Na: "#a07ad0",
  Mg: "#6fae6f",
  Al: "#b6a08a",
  Si: "#9a8f6f",
  P: "#c08a3a",
  S: "#c2b03a",
  Cl: "#5fa86b",
  K: "#8a6fc0",
  Ca: "#7faa7f",
  Ti: "#4a4a82",
  Fe: "#b06a3a",
  Cu: "#b07a4a",
  Zn: "#8a8aa0",
};
