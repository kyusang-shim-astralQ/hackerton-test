// features/f5-report/types.ts — f5-report 응답 계약 타입 (단일 소스: data-models.md §17 ReportData)
// 슬라이스 골격(stores/slices/f5-report.ts)은 ReportData를 느슨히 선언하므로, 여기서 정밀 타입을 둔다.

/** 들뜸 상태 1개 (absorption/emission, TDDFPT 전용). data-models §17 excitations[] */
export interface Excitation {
  state: number;
  energy_ev: number;
  wavelength_nm: number;
  osc_strength: number;
  is_dark: boolean;
  region: string;
}

/** Gaussian 브로드닝 흡수 곡선. data-models §17 spectrum */
export interface Spectrum {
  wavelengths: number[];
  intensities: number[];
  sigma_ev: number;
}

/** 단일 summary */
export interface SingleSummary {
  final_energy: string;
  target_property: string;
}

/** 다중 summary 항목 (구조별) */
export interface MultiSummaryItem {
  energy: string;
  target_property: string;
}

/** ReportData (data-models §17). 에러 축약형은 status/is_multi 부재 + summary={} */
export interface ReportResponse {
  status?: string;
  report: string; // 마크다운 본문
  summary: Record<string, unknown>; // 단일={final_energy,target_property}, 다중={fname:{energy,target_property}}
  is_multi?: boolean;
  excitations?: Excitation[];
  spectrum?: Spectrum;
}

export const PROPERTY_KEYS = [
  "geo_opt",
  "single_point",
  "dos",
  "band",
  "aimd",
  "vibrational",
  "neb",
  "adsorption",
  "work_function",
  "hirshfeld",
  "absorption",
  "emission",
] as const;

export type PropertyKey = (typeof PROPERTY_KEYS)[number];

/** absorption/emission(TDDFPT) 물성인지 — excitations/spectrum 블록 렌더 게이트 */
export function isTddftProperty(property?: string): boolean {
  const p = (property ?? "").toLowerCase();
  return p === "absorption" || p === "emission";
}

/** 에러 축약형(디렉토리 없음/데이터 없음) 방어 — api.md ⚠️ 박스: summary=={} & report가 에러 문구 */
export function isErrorReport(r: ReportResponse | undefined): boolean {
  if (!r) return true;
  const summaryEmpty = !r.summary || Object.keys(r.summary).length === 0;
  return summaryEmpty && (!r.status || r.status === "error");
}

/** 다중 summary 가드 — 값이 {energy,target_property} 형태인지 */
export function isMultiSummaryItem(v: unknown): v is MultiSummaryItem {
  return (
    typeof v === "object" &&
    v !== null &&
    "energy" in (v as Record<string, unknown>) &&
    "target_property" in (v as Record<string, unknown>)
  );
}
