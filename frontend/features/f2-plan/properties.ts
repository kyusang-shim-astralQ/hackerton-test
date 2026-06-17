// features/f2-plan/properties.ts — 표준 12종 물성 카탈로그 (단일 선택).
// 키는 docs/features/f2-plan/api.md PROPERTY_SECTION_MAP 와 1:1 (절대 임의 키 추가 금지).
// 카테고리: 정적 · 동역학/열적 · 화학반응성 · 광학 · 전자/전하 · 기타.

import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  Mountain,
  BarChart3,
  Activity,
  Waves,
  Route,
  Layers,
  Workflow,
  Zap,
  Magnet,
  Sun,
  Lightbulb,
} from "lucide-react";

/** 12종 물성 카테고리 키 (i18n prefix f2.cat.*) */
export type PropertyCategory =
  | "static"
  | "dynamic"
  | "reactivity"
  | "optical"
  | "electronic"
  | "other";

export interface PropertyDef {
  /** PlanRequest.property 로 보내는 단일 키 (PROPERTY_SECTION_MAP 키) */
  key: string;
  /** i18n 라벨 키 (f2.prop.<key>.label) */
  category: PropertyCategory;
  icon: LucideIcon;
  /** 광학(TDDFPT) 계열 → DIAGONALIZATION 고정 안내 노출 */
  optical?: boolean;
}

/** 표준 12종 — 단일 선택 라디오. 순서 = 화면 노출 순서. */
export const PROPERTIES: PropertyDef[] = [
  // 정적 (Static)
  { key: "geo_opt", category: "static", icon: Boxes },
  { key: "single_point", category: "static", icon: Mountain },
  // 전자/전하 (Electronic / Charge)
  { key: "dos", category: "electronic", icon: BarChart3 },
  { key: "band", category: "electronic", icon: Activity },
  { key: "work_function", category: "electronic", icon: Zap },
  { key: "hirshfeld", category: "electronic", icon: Magnet },
  // 동역학 / 열적 (Dynamics / Thermal)
  { key: "aimd", category: "dynamic", icon: Waves },
  { key: "vibrational", category: "dynamic", icon: Workflow },
  // 화학반응성 (Reactivity)
  { key: "neb", category: "reactivity", icon: Route },
  { key: "adsorption", category: "reactivity", icon: Layers },
  // 광학 (Optical · TDDFPT)
  { key: "absorption", category: "optical", icon: Sun, optical: true },
  { key: "emission", category: "optical", icon: Lightbulb, optical: true },
];

/** 카테고리 노출 순서 (i18n: f2.cat.<id>) */
export const CATEGORY_ORDER: PropertyCategory[] = [
  "static",
  "electronic",
  "dynamic",
  "reactivity",
  "optical",
  "other",
];

export const PROPERTY_KEYS: string[] = PROPERTIES.map((p) => p.key);

export function propertyByKey(key?: string): PropertyDef | undefined {
  if (!key) return undefined;
  return PROPERTIES.find((p) => p.key === key);
}

/** 선택된 단일 물성이 광학(TDDFPT) 계열인지 — DIAGONALIZATION 고정 안내용. */
export function isOpticalProperty(key?: string): boolean {
  return !!propertyByKey(key)?.optical;
}
