// lib/i18n/f4-jobs.ts — f4-jobs 사전 (5단계: 제출 + 실시간 모니터링). prefix: f4.*
import type { Dict } from "./index";

export const f4Dict: Dict = {
  ko: {
    "f4.placeholder": "제출/실시간 모니터링(5단계) — f4-jobs 가 채웁니다.",

    // 제출 (pre) 화면
    "f4.submit.title": "계산 제출",
    "f4.submit.sub": "SGE Cluster",
    "f4.submit.desc":
      "확정된 플랜의 활성 스텝을 SGE 클러스터에 제출하고 실시간으로 모니터링합니다.",
    "f4.submit.cta": "SGE 제출",
    "f4.submit.jobName": "작업 이름",
    "f4.submit.stages": "{n} stages",
    "f4.submit.structures": "{n}개 구조",
    "f4.submit.noPlan":
      "확정된 플랜이 없습니다. 4단계에서 플랜을 확정한 뒤 다시 시도하세요.",
    "f4.submit.noActive":
      "활성 스텝이 없습니다. 4단계에서 최소 한 개 이상의 스텝을 포함하세요.",
    "f4.submit.previewTitle": "제출할 스텝",
    "f4.submit.structureLabel": "구조",
    "f4.submit.submitting": "제출 중…",
    "f4.submit.error": "제출 실패",

    // 모니터 대시보드
    "f4.monitor.title": "라이브 모니터",
    "f4.monitor.sub": "cp2k.out · live",
    "f4.monitor.stage": "스텝",
    "f4.monitor.scfIter": "SCF 반복",
    "f4.monitor.elapsed": "경과",
    "f4.monitor.energy": "현재 에너지",
    "f4.monitor.jobId": "Job ID",
    "f4.monitor.stop": "STOP",
    "f4.monitor.stopConfirm": "이 작업을 중단하시겠습니까? (qdel)",
    "f4.monitor.logTitle": "실행 로그",
    "f4.monitor.chartTitle": "SCF 수렴 (스텝별)",
    "f4.monitor.chartLog": "|ΔE| 로그축 · 목표 {target}",
    "f4.monitor.lastDelta": "마지막 ΔE",
    "f4.monitor.target": "목표",
    "f4.monitor.healing": "자가치유",
    "f4.monitor.tddft": "TDDFT 여기상태",
    "f4.monitor.tddftState": "상태 {i}",
    "f4.monitor.tddftConverged": "{c}/{t} 수렴",

    // 상태
    "f4.status.running": "실행 중",
    "f4.status.converged": "수렴 중",
    "f4.status.done": "완료",
    "f4.status.stopped": "중지됨",
    "f4.status.failed": "실패",
    "f4.status.pending": "제출 대기",

    // 완료/다운로드/이동
    "f4.done.title": "계산 완료",
    "f4.done.message": "모든 스텝이 완료되었습니다. 결과를 다운로드하거나 리포트로 진행하세요.",
    "f4.done.download": "결과 다운로드 (.tar.gz)",
    "f4.done.next": "리포트 보기",
    "f4.done.downloading": "다운로드 중…",

    // 서브잡 탭
    "f4.subjob.tabs": "구조별 작업",

    // ConvStats
    "f4.stats.scfSteps": "SCF 스텝",
    "f4.stats.minDelta": "최소 |ΔE|",
    "f4.stats.progress": "진행률",

    // 미러
    "f4.mirror.elapsed": "경과 {sec}s",
  },
  en: {
    "f4.placeholder": "Submit / live monitoring (Step 5) — owned by f4-jobs.",

    "f4.submit.title": "Submit Calculation",
    "f4.submit.sub": "SGE Cluster",
    "f4.submit.desc":
      "Submit the active steps of the confirmed plan to the SGE cluster and monitor in real time.",
    "f4.submit.cta": "Submit to SGE",
    "f4.submit.jobName": "Job name",
    "f4.submit.stages": "{n} stages",
    "f4.submit.structures": "{n} structures",
    "f4.submit.noPlan":
      "No confirmed plan. Confirm a plan in Step 4 and try again.",
    "f4.submit.noActive":
      "No active steps. Include at least one step in Step 4.",
    "f4.submit.previewTitle": "Steps to submit",
    "f4.submit.structureLabel": "Structure",
    "f4.submit.submitting": "Submitting…",
    "f4.submit.error": "Submission failed",

    "f4.monitor.title": "Live Monitor",
    "f4.monitor.sub": "cp2k.out · live",
    "f4.monitor.stage": "Stage",
    "f4.monitor.scfIter": "SCF iter",
    "f4.monitor.elapsed": "Elapsed",
    "f4.monitor.energy": "Energy",
    "f4.monitor.jobId": "Job ID",
    "f4.monitor.stop": "STOP",
    "f4.monitor.stopConfirm": "Stop this job? (qdel)",
    "f4.monitor.logTitle": "Run log",
    "f4.monitor.chartTitle": "SCF Convergence (per step)",
    "f4.monitor.chartLog": "|ΔE| log axis · target {target}",
    "f4.monitor.lastDelta": "Last ΔE",
    "f4.monitor.target": "Target",
    "f4.monitor.healing": "Self-healing",
    "f4.monitor.tddft": "TDDFT excitations",
    "f4.monitor.tddftState": "State {i}",
    "f4.monitor.tddftConverged": "{c}/{t} converged",

    "f4.status.running": "Running",
    "f4.status.converged": "Converging",
    "f4.status.done": "Done",
    "f4.status.stopped": "Stopped",
    "f4.status.failed": "Failed",
    "f4.status.pending": "Awaiting submit",

    "f4.done.title": "Calculation complete",
    "f4.done.message":
      "All steps finished. Download the results or proceed to the report.",
    "f4.done.download": "Download results (.tar.gz)",
    "f4.done.next": "View report",
    "f4.done.downloading": "Downloading…",

    "f4.subjob.tabs": "Jobs by structure",

    "f4.stats.scfSteps": "SCF steps",
    "f4.stats.minDelta": "Min |ΔE|",
    "f4.stats.progress": "Progress",

    "f4.mirror.elapsed": "Elapsed {sec}s",
  },
};
