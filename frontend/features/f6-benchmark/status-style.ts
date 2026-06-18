// features/f6-benchmark/status-style.ts — 레벨 상태 → Lab Paper 색 매핑 (토큰만 사용, 하드코딩 금지)
// 색 규칙(design-system §2 토큰):
//   SUCCESS → ok, INCORRECT → 경고(노랑 톤은 Lab Paper에 없음 → oxblood 절제 + 점선),
//   FAILURE/Aborted → oxblood, Recovering → accent, Running → accent 펄스, Pending/Skipped → ink-faint.
import { type LevelStatus } from "./types";

export interface StatusStyle {
  /** 그리드 셀/배지 배경·보더·글자 Tailwind 클래스 (토큰 기반) */
  chip: string;
  /** 작은 dot 색(CSS 변수) */
  dot: string;
}

export const STATUS_STYLE: Record<LevelStatus, StatusStyle> = {
  Pending: {
    chip: "bg-inset border-hairline-2 text-ink-faint",
    dot: "var(--ink-faint)",
  },
  Running: {
    chip: "bg-accent-wash border-accent-edge text-accent-ink",
    dot: "var(--accent)",
  },
  "Recovering...": {
    chip: "bg-accent-wash border-accent text-accent-ink",
    dot: "var(--accent)",
  },
  SUCCESS: {
    chip: "bg-ok-wash border-[#c2d4bf] text-ok",
    dot: "var(--ok)",
  },
  INCORRECT: {
    chip: "bg-oxblood-wash border-[#e0c4c0] text-oxblood border-dashed",
    dot: "var(--oxblood)",
  },
  FAILURE: {
    chip: "bg-oxblood-wash border-oxblood text-oxblood",
    dot: "var(--oxblood)",
  },
  Skipped: {
    chip: "bg-inset border-hairline-soft text-ink-faint opacity-70",
    dot: "var(--ink-faint)",
  },
  Aborted: {
    chip: "bg-oxblood-wash border-oxblood text-oxblood",
    dot: "var(--oxblood)",
  },
};

/** 안전 조회(미지의 상태 폴백) */
export function statusStyle(status: string): StatusStyle {
  return STATUS_STYLE[status as LevelStatus] ?? STATUS_STYLE.Pending;
}

/** 펄스가 필요한 진행 상태 */
export function isLive(status: string): boolean {
  return status === "Running" || status === "Recovering...";
}
