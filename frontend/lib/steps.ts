// lib/steps.ts — 6단계 메타데이터 단일 소스 (StepRail/Workspace가 구독, design-system §3.5·§4.2)
// 기능 프롬프트(fe/02~07)는 이 파일을 수정하지 않는다.

export type StepIndex = 1 | 2 | 3 | 4 | 5 | 6;
export type StepStatus = "done" | "current" | "reachable" | "locked";

export interface StepMeta {
  index: StepIndex;
  /** StepRail 짧은 한국어 명 */
  title: string;
  /** mono 영문 보조 라벨 */
  label: string;
  /** work-head eyebrow (단계 N/6 · ...) */
  eyebrow: string;
  /** work-head serif h1 */
  heading: string;
  /** work-head 설명 */
  description: string;
  /** 라우트 경로 */
  path: string;
}

export const STEPS: StepMeta[] = [
  {
    index: 1,
    title: "구조",
    label: "Structure · CIF",
    eyebrow: "단계 1/6 · 구조 입력 및 검증",
    heading: "구조 입력 및 검증",
    description: "결정구조 파일(.cif/.xyz/POSCAR)을 업로드하면 ASE가 원자·격자·원소를 분석합니다.",
    path: "/step-1",
  },
  {
    index: 2,
    title: "물성",
    label: "Property · Target",
    eyebrow: "단계 2/6 · 계산할 물성 선택",
    heading: "계산할 물성 선택",
    description: "12종 물성 중 하나를 선택합니다. 선택한 타겟에 맞춰 워크플로우가 구성됩니다.",
    path: "/step-2",
  },
  {
    index: 3,
    title: "옵션",
    label: "Options · DFT",
    eyebrow: "단계 3/6 · DFT 계산 옵션",
    heading: "DFT 계산 옵션",
    description: "전자 구조 설정과 SCF 수렴 설정을 지정하고 AI 계산 플랜을 생성합니다.",
    path: "/step-3",
  },
  {
    index: 4,
    title: "플랜",
    label: "Plan · Review",
    eyebrow: "단계 4/6 · 계산 플랜 확정",
    heading: "계산 플랜 확정",
    description: "AI가 제안한 멀티스텝 플랜을 검토·편집하고 CP2K 입력파일(.inp)을 생성합니다.",
    path: "/step-4",
  },
  {
    index: 5,
    title: "계산 · 모니터",
    label: "Run · Monitor",
    eyebrow: "단계 5/6 · 계산 실행 및 모니터링",
    heading: "계산 실행 및 모니터링",
    description: "SGE 클러스터에 작업을 제출하고 실시간 로그·SCF 수렴을 모니터링합니다.",
    path: "/step-5",
  },
  {
    index: 6,
    title: "리포트",
    label: "Report · Result",
    eyebrow: "단계 6/6 · 결과 리포트",
    heading: "결과 리포트",
    description: "추출된 물성과 총에너지를 사람이 읽는 마크다운 리포트로 정리합니다.",
    path: "/step-6",
  },
];

/** 벤치마크 상시 진입 행 메타 (flow와 독립, §3.5). */
export const BENCHMARK_META = {
  title: "정확도 벤치마크",
  label: "Benchmark · 1–12",
  path: "/benchmark",
} as const;

/**
 * 잠금 규칙 (목업 go()): 한 단계 앞(maxReached+1)까지만 진입 허용, 그 이상은 잠금.
 * - n < current  → 완료(done)
 * - n === current → 현재(current)
 * - n <= maxReached+1 → 도달 가능(reachable)
 * - 그 외 → 잠금(locked)
 */
export function stepStatus(
  index: number,
  current: number,
  maxReached: number
): StepStatus {
  if (index === current) return "current";
  if (index < current || index <= maxReached) return "done";
  if (index <= maxReached + 1) return "reachable";
  return "locked";
}

/** 진입 가능 여부 (StepRail 클릭 활성화 판정). */
export function isStepReachable(index: number, maxReached: number): boolean {
  return index <= maxReached + 1;
}

export function stepByIndex(index: number): StepMeta | undefined {
  return STEPS.find((s) => s.index === index);
}
