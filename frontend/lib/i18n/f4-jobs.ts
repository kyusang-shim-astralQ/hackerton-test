// lib/i18n/f4-jobs.ts — f4-jobs(5단계 제출·모니터) 사전. 소유: f4 담당.
// import 시점에 registerDict 호출(레지스트리 자가등록). 기능은 자기 사전 파일만 추가한다.
import { registerDict } from "./registry";
import type { LangDict } from "./core";

export const f4Dict: LangDict = {
  ko: {
    // 제출 전 요약
    "f4.submit.title": "계산 제출",
    "f4.submit.sub": "확정된 플랜의 활성 스텝만 SGE 클러스터에 제출합니다.",
    "f4.submit.stages": "{n}개 스텝",
    "f4.submit.plan": "제출할 스텝",
    "f4.submit.structure": "구조",
    "f4.submit.multi": "다중 구조 ({n}개)",
    "f4.submit.options": "DFT 옵션",
    "f4.submit.button": "SGE 제출",
    "f4.submit.submitting": "제출 중…",
    "f4.submit.noSteps": "제출할 활성 스텝이 없습니다. 4단계에서 스텝을 하나 이상 선택하세요.",
    "f4.submit.noPlan": "확정된 플랜이 없습니다. 4단계에서 플랜을 먼저 확정하세요.",
    "f4.submit.excluded": "제외됨",

    // 런바 / 상태
    "f4.run.stage": "단계",
    "f4.run.scf": "SCF 반복",
    "f4.run.elapsed": "경과",
    "f4.run.energy": "현재 에너지",
    "f4.run.lastDelta": "마지막 ΔE",
    "f4.run.target": "목표 EPS_SCF",
    "f4.run.stop": "중지 (STOP)",
    "f4.run.stopping": "중지 중…",
    "f4.run.stopConfirm": "실행 중인 계산을 중단할까요? (qdel)",
    "f4.run.download": "결과 다운로드 (.tar.gz)",

    // 상태 라벨
    "f4.status.running": "실행 중 · SCF",
    "f4.status.converged": "수렴",
    "f4.status.done": "완료",
    "f4.status.stopped": "중지됨",
    "f4.status.failed": "실패",
    "f4.status.pending": "대기",

    // 차트 / 통계
    "f4.chart.title": "SCF 수렴",
    "f4.chart.sub": "|ΔE| 로그축 · 스텝별",
    "f4.conv.scfSteps": "SCF 스텝",
    "f4.conv.lastDelta": "마지막 |ΔE|",
    "f4.conv.energy": "최종 에너지",

    // 터미널
    "f4.term.header": "cp2k.out · live",

    // 탭
    "f4.tab.subjob": "서브잡",
    "f4.tab.step": "스텝",

    // 치유 / 자가수정
    "f4.healing.title": "자가치유 이력",
    "f4.healing.empty": "치유 처방 없음 (정상 수렴)",

    // 라이브 미러(우측)
    "f4.mirror.title": "라이브 모니터",
    "f4.mirror.logs": "최근 로그",

    // 완료/에러
    "f4.done.title": "계산 완료",
    "f4.done.message": "모든 스텝이 완료되었습니다. 결과를 내려받거나 6단계 리포트로 이동하세요.",
    "f4.error.submit": "제출 실패",
    "f4.error.poll": "상태 조회 실패",
  },
  en: {
    "f4.submit.title": "Submit Calculation",
    "f4.submit.sub": "Only the active steps of the confirmed plan are submitted to the SGE cluster.",
    "f4.submit.stages": "{n} stages",
    "f4.submit.plan": "Steps to submit",
    "f4.submit.structure": "Structure",
    "f4.submit.multi": "Multiple structures ({n})",
    "f4.submit.options": "DFT options",
    "f4.submit.button": "Submit to SGE",
    "f4.submit.submitting": "Submitting…",
    "f4.submit.noSteps": "No active steps to submit. Select at least one step in Step 4.",
    "f4.submit.noPlan": "No confirmed plan. Confirm a plan in Step 4 first.",
    "f4.submit.excluded": "excluded",

    "f4.run.stage": "Stage",
    "f4.run.scf": "SCF iter",
    "f4.run.elapsed": "Elapsed",
    "f4.run.energy": "Current energy",
    "f4.run.lastDelta": "Last ΔE",
    "f4.run.target": "Target EPS_SCF",
    "f4.run.stop": "STOP",
    "f4.run.stopping": "Stopping…",
    "f4.run.stopConfirm": "Abort the running calculation? (qdel)",
    "f4.run.download": "Download results (.tar.gz)",

    "f4.status.running": "Running · SCF",
    "f4.status.converged": "Converged",
    "f4.status.done": "Done",
    "f4.status.stopped": "Stopped",
    "f4.status.failed": "Failed",
    "f4.status.pending": "Pending",

    "f4.chart.title": "SCF Convergence",
    "f4.chart.sub": "|ΔE| log scale · per step",
    "f4.conv.scfSteps": "SCF steps",
    "f4.conv.lastDelta": "Last |ΔE|",
    "f4.conv.energy": "Final energy",

    "f4.term.header": "cp2k.out · live",

    "f4.tab.subjob": "Sub-job",
    "f4.tab.step": "Step",

    "f4.healing.title": "Self-healing history",
    "f4.healing.empty": "No healing prescriptions (clean convergence)",

    "f4.mirror.title": "Live monitor",
    "f4.mirror.logs": "Recent logs",

    "f4.done.title": "Calculation complete",
    "f4.done.message": "All steps finished. Download the results or move to the Step 6 report.",
    "f4.error.submit": "Submission failed",
    "f4.error.poll": "Status query failed",
  },
};

registerDict(f4Dict);
