// features/f4-jobs/lib/mock-stream.ts
// ★ MOCK MODE (fe/05) — 클러스터 없이 끝까지 시연.
// 클라이언트 타이머 기반 가짜 스트림: data-models.md 의 JobStatus/StepHistory 형태를 따라
//  - SCF 가 점진 수렴 (ΔE 1e-2 → 1e-6),
//  - 로그 줄이 쌓이고,
//  - 단계가 진행되다 all_finished 로 종료.
// step_histories 를 *스텝마다 따로* 채워 스텝별 차트가 각각 그려지게 한다.
// 실제 폴링 코드 경로와 *동일한 렌더*가 이 목 데이터로 돌아간다 (JobStatus 를 그대로 반환).

import type { JobStatus, PlanStep, StepHistory } from "@/stores/types";

const SCF_TARGET = 1.0e-6;
/** 스텝당 SCF 반복 수(목 — 짧게). */
const SCF_PER_STEP = 9;
/** "8초 주기" 폴링이지만 목은 더 짧게(1초)로 빠르게 시연. */
export const MOCK_TICK_MS = 1000;

function nowHHMMSS(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

/** SCF tick i(1-based)에서의 |ΔE| — 1e-2 에서 SCF_TARGET 으로 지수 감쇠. */
function deltaAt(i: number): number {
  const start = -2; // 1e-2
  const end = Math.log10(SCF_TARGET); // -6
  const frac = Math.min(1, (i - 1) / (SCF_PER_STEP - 1));
  const exp = start + (end - start) * frac;
  // 약간의 노이즈로 자연스러운 수렴 곡선
  const jitter = i > 1 && i < SCF_PER_STEP ? (Math.sin(i * 1.7) * 0.12) : 0;
  return Math.pow(10, exp + jitter);
}

/** SCF tick i 에서의 에너지(Ha) — base 로 수렴. */
function energyAt(base: number, i: number): number {
  const remaining = deltaAt(i) * 40; // ΔE 비례 오프셋
  return base - remaining;
}

/**
 * 한 서브잡의 목 스트림 상태기.
 * tick() 을 호출할 때마다 한 SCF 반복(또는 스텝 전환)을 진행하고 JobStatus 를 반환한다.
 */
export class MockJobStream {
  private steps: PlanStep[];
  private jobKey: string;
  private lang: string;
  private startedAt = Date.now();
  private logs: string[] = [];
  private healing: string[] = [];
  private histories: Record<string, StepHistory> = {};
  // 진행 커서
  private stepIdx = 1; // 1-based 활성 스텝
  private scfIter = 0;
  private energyBase: number;
  private finished = false;
  private aborted = false;
  private jobId: string;
  // 데모용: 2번째 스텝에서 한 번 자가치유를 흉내냄
  private healedStep = -1;

  constructor(steps: PlanStep[], jobKey: string, lang = "ko") {
    this.steps = steps.length > 0 ? steps : [{ step_name: "Energy", run_type: "ENERGY", inp_options: [] }];
    this.jobKey = jobKey;
    this.lang = lang;
    this.energyBase = -200 - Math.random() * 120;
    this.jobId = String(80000 + Math.floor(Math.random() * 19999));
    // step_histories 를 스텝마다 미리 빈 슬롯으로 생성
    this.steps.forEach((s, i) => {
      this.histories[String(i + 1)] = {
        run_type: s.run_type || "ENERGY",
        energy: [],
        scf: [],
        macro_energy: [],
        macro_conv: [],
      };
    });
    this.pushLog(`[Step 1] qsub submitted (job_id=${this.jobId})`);
  }

  private pushLog(line: string) {
    this.logs.push(`${nowHHMMSS()}  ${line}`);
    if (this.logs.length > 200) this.logs = this.logs.slice(-200);
  }

  get isFinished() {
    return this.finished || this.aborted;
  }

  abort() {
    if (this.finished) return;
    this.aborted = true;
    this.pushLog(`[qdel] job ${this.jobId} terminated by user`);
  }

  /** 한 tick 진행 후 현재 JobStatus 스냅샷 반환. */
  tick(): JobStatus {
    if (!this.isFinished) {
      this.advance();
    }
    return this.snapshot();
  }

  private advance() {
    const stepKey = String(this.stepIdx);
    const hist = this.histories[stepKey];
    const stepRunType = this.steps[this.stepIdx - 1]?.run_type || "ENERGY";

    this.scfIter += 1;
    const delta = deltaAt(this.scfIter);
    const energy = energyAt(this.energyBase, this.scfIter);
    hist.scf.push(delta);
    hist.energy.push(energy);

    this.pushLog(
      `[Step ${this.stepIdx}/${this.steps.length}] SCF ${String(this.scfIter).padStart(2, " ")} | E= ${energy.toFixed(6)} | ΔE= ${delta.toExponential(2)}`
    );

    // 데모: 두 번째 스텝 진입 직후 1회 자가치유 흉내
    if (this.steps.length > 1 && this.stepIdx === 2 && this.scfIter === 1 && this.healedStep !== 2) {
      this.healedStep = 2;
      const msg =
        this.lang === "en"
          ? "[AI Fix] SCF stalling detected → raised MAX_SCF 50→100, switched mixing α 0.4→0.3"
          : "[AI Fix] SCF 정체 감지 → MAX_SCF 50→100 상향, 혼합 α 0.4→0.3 조정";
      this.healing.push(msg);
      this.pushLog(msg);
    }

    // 스텝 종료(SCF 수렴) 판정
    if (this.scfIter >= SCF_PER_STEP) {
      // GEO/CELL_OPT 는 매크로 스텝 한 점 기록
      if (stepRunType === "GEO_OPT" || stepRunType === "CELL_OPT") {
        hist.macro_energy?.push(energy);
        hist.macro_conv?.push(delta * 50);
      }
      this.pushLog(
        `[Step ${this.stepIdx}] converged (|ΔE| < ${SCF_TARGET.toExponential(0)})`
      );
      if (this.stepIdx >= this.steps.length) {
        this.finished = true;
        this.pushLog(`[Done] all stages finished — simulation_completed.flag written`);
      } else {
        this.stepIdx += 1;
        this.scfIter = 0;
        this.pushLog(`[Step ${this.stepIdx}] coordinates chained (*-pos-1.xyz)`);
        this.pushLog(`[Step ${this.stepIdx}] qsub submitted (job_id=${this.jobId})`);
      }
    }
  }

  private snapshot(): JobStatus {
    const stepKey = String(this.stepIdx);
    const hist = this.histories[stepKey];
    const lastDelta = hist.scf[hist.scf.length - 1];
    const lastEnergy = hist.energy[hist.energy.length - 1];
    const scfProgress =
      lastDelta && lastDelta > 0
        ? Math.min(99.9, (Math.log10(lastDelta) / Math.log10(SCF_TARGET)) * 100)
        : 0;

    let status: string;
    if (this.aborted) status = "aborted";
    else if (this.finished) status = "all_finished";
    else status = "Running";

    const message = this.aborted
      ? this.lang === "en"
        ? "Job aborted by user"
        : "사용자에 의해 작업 중단됨"
      : this.finished
        ? this.lang === "en"
          ? "All stages completed successfully"
          : "모든 스텝이 성공적으로 완료되었습니다"
        : this.lang === "en"
          ? `Step ${this.stepIdx} running (SCF converging)`
          : `Step ${this.stepIdx} 실행 중 (SCF 수렴 중)`;

    // 스텝 steps 재인덱싱 형태(JobStatus.steps)
    const steps: PlanStep[] = this.steps.map((s, i) => ({
      ...s,
      step_idx: i + 1,
      step_name: `Step ${i + 1}: ${s.step_name}`,
    }));

    return {
      status,
      active_step: this.stepIdx,
      total_steps: this.steps.length,
      job_id: this.jobId,
      lang: this.lang,
      message,
      healing_history: [...this.healing],
      updated_at: nowHHMMSS(),
      logs: [...this.logs],
      current_scf_step: this.scfIter,
      energy_history: [...hist.energy],
      scf_history: [...hist.scf],
      macro_energy_history: [...(hist.macro_energy ?? [])],
      macro_conv_history: [...(hist.macro_conv ?? [])],
      scf_progress: scfProgress,
      macro_progress: 0,
      tddft_progress: null,
      steps,
      step_histories: JSON.parse(JSON.stringify(this.histories)),
      job_key: this.jobKey,
      energy_value: lastEnergy,
    } as JobStatus & { energy_value?: number };
  }
}
