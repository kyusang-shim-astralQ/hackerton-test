// features/f5-report/components/mock-histories.ts
// ★ 데모 전용 — f5(ReportData)는 StepHistory 를 소비하지 않으므로(경계: data-models.md §17),
//   스텝별/구조별 수렴 차트를 시연하려면 결정론적 합성 SCF |ΔE| 이력을 만든다(MOCK MODE 한정).
//   실제 백엔드 연결 시에는 별도 step_histories 소스가 필요하나, 본 화면은 산출물 분석기이므로
//   합성 데이터로 "스텝별 분리 차트" UX 자체를 보여주는 용도다.

export interface MockStepSeries {
  stepIndex: number;
  stepLabel: string;
  labels: number[];
  delta: number[];
}

/** 시드 기반 결정론적 SCF |ΔE| 곡선(목표 1e-6 로 지수 수렴 + 미세 노이즈). */
function decaySeries(
  seed: number,
  cycles: number,
  start = 1e-1,
  target = 1e-6
): number[] {
  const out: number[] = [];
  const ratio = Math.pow(target / start, 1 / Math.max(cycles - 1, 1));
  let v = start;
  let s = seed * 9973;
  for (let i = 0; i < cycles; i++) {
    // 결정론적 의사난수(0.8~1.2 배 흔들기)
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const jitter = 0.8 + ((s % 1000) / 1000) * 0.4;
    out.push(Math.max(v * jitter, target * 0.6));
    v *= ratio;
  }
  return out;
}

/** 단일 구조: 라벨별 스텝(예: ① GeomOpt, ② SCF) 차트 시리즈. */
export function singleStepSeries(labels: string[]): MockStepSeries[] {
  return labels.map((label, i) => {
    const cycles = 12 + ((i * 3) % 6);
    return {
      stepIndex: i + 1,
      stepLabel: label,
      labels: Array.from({ length: cycles }, (_, k) => k + 1),
      delta: decaySeries(i + 1, cycles),
    };
  });
}

/** 다중 구조: 구조 키별 스텝 시리즈 맵. */
export function multiStepSeries(
  structureKeys: string[],
  labels: string[]
): Record<string, MockStepSeries[]> {
  const out: Record<string, MockStepSeries[]> = {};
  structureKeys.forEach((key, si) => {
    out[key] = labels.map((label, i) => {
      const cycles = 11 + ((si + i) % 7);
      return {
        stepIndex: i + 1,
        stepLabel: label,
        labels: Array.from({ length: cycles }, (_, k) => k + 1),
        delta: decaySeries(si * 10 + i + 1, cycles),
      };
    });
  });
  return out;
}
