// lib/i18n/f3-inp.ts — f3-inp 사전 (플랜 검토/INP 생성). prefix: f3.*
import type { Dict } from "./index";

export const f3Dict: Dict = {
  ko: {
    "f3.placeholder": "플랜 검토/INP 생성(4단계) — f3-inp 가 채웁니다.",

    // 플랜 검토
    "f3.review.title": "AI 계산 워크플로 검토",
    "f3.review.stages": "{n} / {total} 단계 활성",
    "f3.review.included": "포함",
    "f3.review.excluded": "제외됨",
    "f3.review.noneActive": "활성 스텝이 없습니다. 최소 한 단계를 포함하세요.",

    // INP 생성
    "f3.generate.title": "CP2K 입력파일(.inp) 생성",
    "f3.generate.desc":
      "검토한 플랜으로 스텝별 .inp 를 생성합니다. 좌표·셀은 구조 분석값을 사용하며, 스키마 검증·자가치유 게이트를 통과한 결정론적 결과입니다.",
    "f3.generate.action": "최종 INP 생성",
    "f3.generate.single": "{s}개 스텝",
    "f3.generate.multi": "{n}개 구조 × {s}개 스텝",
    "f3.generate.done": "{n}개 파일 생성됨",

    // 미리보기
    "f3.preview.title": "생성된 INP 미리보기",
    "f3.preview.count": "{n}개 파일",
    "f3.preview.single": "단일 구조",

    // 다음
    "f3.next.submit": "제출로 이동",
    "f3.next.multiHint": "{n}개 구조가 서브잡 N개로 병렬 제출됩니다.",

    // 단독 시드
    "f3.seed.notice":
      "상위 단계 데이터가 없어 예시 플랜으로 표시 중입니다(단독 미리보기).",
    "f3.seed.expertTip":
      "예시 플랜: 구조 최적화 후 단일점 에너지로 정밀 SCF 에너지를 확보하는 표준 흐름입니다.",
  },
  en: {
    "f3.placeholder": "Plan review / INP generation (Step 4) — owned by f3-inp.",

    // Plan review
    "f3.review.title": "Review AI Calculation Workflow",
    "f3.review.stages": "{n} / {total} stages active",
    "f3.review.included": "Included",
    "f3.review.excluded": "Excluded",
    "f3.review.noneActive": "No active steps. Include at least one stage.",

    // INP generation
    "f3.generate.title": "Generate CP2K Input (.inp)",
    "f3.generate.desc":
      "Generates a per-step .inp from the reviewed plan. Coordinates and cell come from the parsed structure; output is deterministic after schema validation and self-healing.",
    "f3.generate.action": "Generate final INP",
    "f3.generate.single": "{s} steps",
    "f3.generate.multi": "{n} structures × {s} steps",
    "f3.generate.done": "{n} files generated",

    // Preview
    "f3.preview.title": "Generated INP Preview",
    "f3.preview.count": "{n} files",
    "f3.preview.single": "Single structure",

    // Next
    "f3.next.submit": "Continue to Submit",
    "f3.next.multiHint": "{n} structures will be submitted as N parallel sub-jobs.",

    // Standalone seed
    "f3.seed.notice":
      "No upstream data — showing an example plan (standalone preview).",
    "f3.seed.expertTip":
      "Example plan: geometry optimization followed by a single-point energy for a precise SCF energy.",
  },
};
