// features/f6-benchmark/lib.ts — 상태 색/포맷 헬퍼 (Lab Paper 토큰만 사용, 하드코딩 금지).
import { LEVEL_TO_PROPERTY } from "./api";

/** 레벨별 status 정규화 키 (i18n / 색 매핑용). "Recovering..." → "Recovering". */
export type LevelStatusKey =
  | "Pending"
  | "Running"
  | "Recovering"
  | "SUCCESS"
  | "INCORRECT"
  | "FAILURE"
  | "Skipped"
  | "Aborted";

export function normalizeStatus(raw?: string): LevelStatusKey {
  const s = (raw ?? "").trim();
  if (s.startsWith("Recovering")) return "Recovering";
  switch (s) {
    case "Pending":
    case "Running":
    case "SUCCESS":
    case "INCORRECT":
    case "FAILURE":
    case "Skipped":
    case "Aborted":
      return s;
    default:
      return "Pending";
  }
}

/**
 * 레벨 상태 → Tailwind 클래스(셀/배지). Lab Paper 토큰만:
 *  SUCCESS=ok, INCORRECT/FAILURE/Aborted=oxblood, Running/Recovering=accent, Skipped/Pending=중립.
 */
export const STATUS_CHIP: Record<LevelStatusKey, string> = {
  SUCCESS: "bg-ok-wash text-ok border-[#c2d4bf]",
  INCORRECT: "bg-oxblood-wash text-oxblood border-oxblood/30",
  FAILURE: "bg-oxblood-wash text-oxblood border-oxblood/30",
  Aborted: "bg-oxblood-wash text-oxblood border-oxblood/30",
  Running: "bg-accent-wash text-accent-ink border-accent-edge",
  Recovering: "bg-accent-wash text-accent-ink border-accent-edge",
  Skipped: "bg-inset text-ink-faint border-hairline-2",
  Pending: "bg-inset text-ink-faint border-hairline-2",
};

/** 진행 중인 상태(펄스/스피너 대상). */
export function isActiveStatus(k: LevelStatusKey): boolean {
  return k === "Running" || k === "Recovering";
}

/** 레벨 → 물성 i18n 키. report.property 가 있으면 우선. */
export function propertyKeyOf(level: number, reportProp?: string): string {
  const p = reportProp || LEVEL_TO_PROPERTY[level] || "energy";
  return `f6.prop.${p}`;
}

/** 에너지/물성치 표시(숫자면 소수 4자리, 문자열이면 그대로, 없으면 —). */
export function fmtValue(v?: number | string): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(4);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(4) : String(v);
}

/** 오차% 표시. */
export function fmtDiff(v?: number | string): string {
  if (v === undefined || v === null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return typeof v === "string" ? v : "—";
  return `${n.toFixed(4)}%`;
}

/** 오차가 낮은지(SUCCESS 임계 1.0% 미만) — 셀 색 판정. */
export function isLowError(v?: number | string): boolean {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n < 1.0;
}
