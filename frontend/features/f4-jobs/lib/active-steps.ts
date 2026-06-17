// features/f4-jobs/lib/active-steps.ts
// ★ fe/05 §0 — 활성 스텝 필터 (제외한 스텝이 step-5에서 되살아나는 버그 방지).
//
// step-4(f3)에서 제외한 스텝을 step-5가 그대로 쓰면 안 된다.
// 규칙 = selected !== false && exclude !== true && excludedSteps[원본인덱스] !== true.
// 이 activeSteps 를 ① 제출 요약 미리보기, ② "N stages" 배지, ③ /submit-job 본문 steps,
// ④ 모니터 훅에 넘기는 steps 에 모두 사용한다.
//
// 백엔드 _reindex_active_steps 는 *받은 페이로드 기준*으로만 필터하므로, 제외 스텝을
// exclude:false 로 보내면 그대로 클러스터에 제출된다. 따라서 제출 *전에* 여기서 걸러야 한다.

import type { PlanStep } from "@/stores/types";

/**
 * 원본 플랜 스텝 + f3 제외 오버라이드 맵 → 활성 스텝만.
 * @param steps          planResult.steps (원본, 직접 쓰지 말 것)
 * @param excludedSteps  f3 슬라이스의 excludedSteps (원본 인덱스 기준 true=제외)
 */
export function computeActiveSteps(
  steps: PlanStep[] | undefined,
  excludedSteps: Record<number, boolean> | undefined
): PlanStep[] {
  if (!steps || steps.length === 0) return [];
  const ov = excludedSteps ?? {};
  return steps.filter(
    (s, i) => s.selected !== false && s.exclude !== true && ov[i] !== true
  );
}
