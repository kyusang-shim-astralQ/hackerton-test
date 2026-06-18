// lib/steps.ts — 6단계 메타데이터 단일 소스 (라벨·순서·잠금 규칙)
// StepRail은 이 파일을 렌더. 기능 프롬프트(fe/02~07)는 이 파일을 수정하지 않는다.
// 단일 소스: docs/design-system.md §3.5, §4.2

export type StepStatus = "done" | "current" | "reachable" | "locked";

export interface StepMeta {
  index: 1 | 2 | 3 | 4 | 5 | 6;
  /** 라우트 슬러그 (app/(wizard)/step-N) */
  slug: string;
  /** 한국어 짧은 명 (StepRail title) */
  title: string;
  /** mono 영문 보조 (StepRail label) */
  label: string;
  /** work-head eyebrow (단계 N/6 · …) */
  eyebrow: string;
  /** work-head serif h1 */
  h1: string;
  /** work-head 설명 */
  desc: string;
}

/** 6단계 고정 메타 (design-system §4.2 META[1..6]) */
export const STEPS: StepMeta[] = [
  {
    index: 1,
    slug: "step-1",
    title: "구조",
    label: "Structure · CIF",
    eyebrow: "단계 1/6 · 구조 입력 및 검증",
    h1: "구조 입력 및 검증",
    desc: "결정구조 파일(CIF/XYZ/POSCAR)을 업로드하면 화학식·공간군·격자상수를 분석합니다.",
  },
  {
    index: 2,
    slug: "step-2",
    title: "물성",
    label: "Property",
    eyebrow: "단계 2/6 · 계산할 물성 선택",
    h1: "계산할 물성 선택",
    desc: "12개 물성 중 하나를 선택하면 그에 맞는 계산 워크플로우를 제안합니다.",
  },
  {
    index: 3,
    slug: "step-3",
    title: "옵션",
    label: "DFT Options",
    eyebrow: "단계 3/6 · DFT 계산 옵션",
    h1: "DFT 계산 옵션",
    desc: "범함수·기저·컷오프·SCF 수렴 설정을 조정한 뒤 AI 계산 플랜을 생성합니다.",
  },
  {
    index: 4,
    slug: "step-4",
    title: "플랜",
    label: "Plan",
    eyebrow: "단계 4/6 · 계산 플랜 확정",
    h1: "계산 플랜 확정",
    desc: "AI가 설계한 다단계 계산 플랜을 검토하고 확정합니다.",
  },
  {
    index: 5,
    slug: "step-5",
    title: "계산 · 모니터",
    label: "Run · Monitor",
    eyebrow: "단계 5/6 · 계산 실행 및 모니터링",
    h1: "계산 실행 및 모니터링",
    desc: "계산을 제출하고 SCF 수렴·자가치유 과정을 실시간으로 모니터링합니다.",
  },
  {
    index: 6,
    slug: "step-6",
    title: "리포트",
    label: "Report",
    eyebrow: "단계 6/6 · 결과 리포트",
    h1: "결과 리포트",
    desc: "계산 결과를 사람이 읽을 수 있는 물성 요약 리포트로 정리합니다.",
  },
];

export const TOTAL_STEPS = STEPS.length;

/** 인덱스로 단계 메타 조회 (1-based) */
export function getStep(index: number): StepMeta | undefined {
  return STEPS.find((s) => s.index === index);
}

/**
 * 단계 상태 판정 (목업 go()/renderRail() 규칙).
 * - done: 이미 지난 단계 (index < current)
 * - current: 현재 단계
 * - reachable: maxReached 까지 + 한 단계 앞(maxReached+1)까지만 진입 허용
 * - locked: 그 이상 (잠금)
 */
export function stepStatus(
  index: number,
  current: number,
  maxReached: number,
): StepStatus {
  if (index === current) return "current";
  if (index < current) return "done";
  if (index <= maxReached) return index < current ? "done" : "reachable";
  if (index === maxReached + 1) return "reachable";
  return "locked";
}

/** 한 단계 앞(maxReached+1)까지만 진입 허용 */
export function canEnter(index: number, maxReached: number): boolean {
  return index <= maxReached + 1;
}
