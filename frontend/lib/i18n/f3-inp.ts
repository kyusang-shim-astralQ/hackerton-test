// lib/i18n/f3-inp.ts — f3-inp(4단계) 도메인 사전. 소유: f3 담당.
// import 시점에 registerDict 호출(부수효과). step-4 페이지가 이 파일을 import 하면 등록된다.
import { registerDict, type LangDict } from "./registry";

export const f3Dict: LangDict = {
  ko: {
    // work-body 카드/섹션
    "f3.workflow.title": "AI 계산 워크플로",
    "f3.workflow.sub": "{count}개 단계",
    "f3.workflow.empty": "표시할 플랜 단계가 없습니다. 3단계에서 AI 플랜을 먼저 생성하세요.",
    "f3.workflow.activeCount": "활성 {active} / 전체 {total} 단계",
    "f3.step.runType": "RUN_TYPE",
    "f3.step.objective": "목표",
    "f3.step.reason": "근거",
    "f3.step.tip": "전문가 팁",
    "f3.step.include": "포함",
    "f3.step.excluded": "제외됨",
    "f3.step.toggleInclude": "이 단계 포함",
    "f3.step.toggleExclude": "이 단계 제외",

    // 구조(다중-CIF) 요약
    "f3.struct.title": "대상 구조",
    "f3.struct.single": "단일 구조",
    "f3.struct.multi": "{count}개 구조 (구조별 × 단계별 INP 생성)",

    // 생성 카드
    "f3.gen.title": "INP / SGE 생성",
    "f3.gen.desc": "선택한 단계로 CP2K 입력파일(.inp)을 생성합니다. 생성은 결정론적이며 클러스터가 필요 없습니다.",
    "f3.gen.button": "최종 INP/SGE 생성",
    "f3.gen.regenerate": "다시 생성",
    "f3.gen.generating": "생성 중…",
    "f3.gen.noSteps": "활성 단계가 없습니다. 최소 한 단계를 포함하세요.",
    "f3.gen.mock": "목 모드(MOCK)로 생성된 예시입니다.",
    "f3.gen.errorTitle": "생성 실패",

    // 미리보기
    "f3.preview.title": "생성된 INP 미리보기",
    "f3.preview.sub": "{count}개 파일",
    "f3.preview.empty": "아직 생성된 파일이 없습니다.",
    "f3.preview.copy": "복사",
    "f3.preview.copied": "복사됨",
    "f3.preview.lines": "{count}줄",

    // 다음 안내
    "f3.next.button": "다음: 제출 · 모니터",
    "f3.next.multiNote": "다중-CIF: 구조별 서브잡 {count}개로 제출됩니다.",
  },
  en: {
    "f3.workflow.title": "AI Calculation Workflow",
    "f3.workflow.sub": "{count} steps",
    "f3.workflow.empty": "No plan steps to show. Generate an AI plan in step 3 first.",
    "f3.workflow.activeCount": "Active {active} / {total} steps",
    "f3.step.runType": "RUN_TYPE",
    "f3.step.objective": "Objective",
    "f3.step.reason": "Reason",
    "f3.step.tip": "Expert tip",
    "f3.step.include": "Included",
    "f3.step.excluded": "Excluded",
    "f3.step.toggleInclude": "Include this step",
    "f3.step.toggleExclude": "Exclude this step",

    "f3.struct.title": "Target structures",
    "f3.struct.single": "Single structure",
    "f3.struct.multi": "{count} structures (INP per structure × step)",

    "f3.gen.title": "INP / SGE generation",
    "f3.gen.desc": "Generate CP2K input files (.inp) from the selected steps. Generation is deterministic and needs no cluster.",
    "f3.gen.button": "Generate final INP/SGE",
    "f3.gen.regenerate": "Regenerate",
    "f3.gen.generating": "Generating…",
    "f3.gen.noSteps": "No active steps. Include at least one step.",
    "f3.gen.mock": "Example generated in MOCK mode.",
    "f3.gen.errorTitle": "Generation failed",

    "f3.preview.title": "Generated INP preview",
    "f3.preview.sub": "{count} files",
    "f3.preview.empty": "No files generated yet.",
    "f3.preview.copy": "Copy",
    "f3.preview.copied": "Copied",
    "f3.preview.lines": "{count} lines",

    "f3.next.button": "Next: Submit · Monitor",
    "f3.next.multiNote": "Multi-CIF: submitted as {count} sub-jobs (one per structure).",
  },
};

registerDict(f3Dict);
