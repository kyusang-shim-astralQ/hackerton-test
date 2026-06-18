// lib/tokens.ts — JS에서 참조하는 토큰 상수 (Chart.js / 3Dmol은 CSS 변수를 못 읽으므로 박제)
// 단일 소스: docs/design-system.md §2.2

// Chart.js 수렴 차트 색 (SCF |ΔE| 로그축)
export const CHART = {
  line: "#36367a", // |ΔE| 라인 (accent)
  fillTop: "rgba(54,54,122,0.14)", // 영역 그라데이션 상단
  fillBottom: "rgba(54,54,122,0)", // 영역 그라데이션 하단
  grid: "#e6e4dd", // 로그축 그리드 (hairline-soft)
  tick: "#6f6d66", // 틱 라벨 (ink-faint)
  tooltipBg: "#1b1b1a", // 툴팁 배경 (ink)
  tickFont: "'JetBrains Mono', monospace",
} as const;

// 3Dmol 분자 뷰어 색
export const VIEWER = {
  bg: "white",
  ti: "#4a4a82", // Ti sphere (딥인디고 계열)
  o: "#b04a44", // O sphere (옥스블러드 계열)
  stick: "#9aa0b5", // 결합 막대
} as const;

// 라이브 터미널 전용 다크 상수 (페이퍼 토큰과 별개 — design-system §2.1 다크 영역 예외, §3.9)
export const TERMINAL = {
  bg: "#16161e",
  border: "#2a2a38",
  body: "#c7c7d6",
  ts: "#5b5b72", // 타임스탬프
  g: "#7fd08a", // 녹
  b: "#9b9bf0", // 인디고
  y: "#d6b46a", // 노랑
  dotRed: "#e0605a",
  dotYellow: "#e0b25a",
  dotGreen: "#6fb86f",
} as const;

// SCF 수렴 목표 (모니터링 시뮬레이션 / 차트 참고선)
export const SCF_TARGET = 1.0e-6;
