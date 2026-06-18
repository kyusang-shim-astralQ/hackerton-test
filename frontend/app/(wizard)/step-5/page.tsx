"use client";
// app/(wizard)/step-5/page.tsx — f4-jobs: 제출 + 8초 폴링 실시간 모니터링.
// 단일 소스: docs/features/f4-jobs/api.md, docs/contracts/data-models.md, docs/design-system.md §4.2/§4.4.
// ★ 활성 스텝 필터(fe/05 §0): step-4에서 제외한 스텝은 미리보기·"N stages"·/submit-job 본문·모니터 어디에도 나타나면 안 됨.
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, CheckCircle2 } from "lucide-react";
import "@/lib/i18n/f4-jobs"; // 사전 자가등록(import 시점)

import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { useWizardStore } from "@/stores/wizard-store";
import type { PlanStep } from "@/stores/types";

import { SubmitSummary } from "@/features/f4-jobs/components/SubmitSummary";
import { LiveMonitor } from "@/features/f4-jobs/components/LiveMonitor";
import { TabBar, type TabItem } from "@/features/f4-jobs/components/TabBar";
import {
  submitJob,
  downloadJobUrl,
  inpOptionsToBody,
  mockBaseEnergy,
  type SubmitJobBody,
  type SubmitJobResponse,
} from "@/features/f4-jobs/api";

/** PlanStep[]에서 활성 스텝만(제외 토글 반영) — 단일 규칙: selected!==false && exclude!==true && excludedSteps[idx]!==true */
function filterActiveSteps(
  steps: PlanStep[] | undefined,
  excludedSteps: Record<number, boolean>,
): PlanStep[] {
  if (!steps) return [];
  return steps.filter((s, i) => {
    const idx = s.step_idx ?? i + 1;
    return s.selected !== false && s.exclude !== true && excludedSteps?.[idx] !== true;
  });
}

export default function Step5Page() {
  const { t } = useT();
  const router = useRouter();

  // store (입력 — 상위 기능 데이터)
  const planResult = useWizardStore((s) => s.planResult);
  const excludedSteps = useWizardStore((s) => s.excludedSteps);
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const generatedFiles = useWizardStore((s) => s.generatedFiles);

  // store (런타임 잡 상태 — persist 제외)
  const subJobs = useWizardStore((s) => s.subJobs);
  const activeSubJobKey = useWizardStore((s) => s.activeSubJobKey);
  const setSubJobs = useWizardStore((s) => s.setSubJobs);
  const setActiveSubJobKey = useWizardStore((s) => s.setActiveSubJobKey);
  const setJobName = useWizardStore((s) => s.setJobName);
  const jobName = useWizardStore((s) => s.jobName);
  const clearJob = useWizardStore((s) => s.clearJob);
  const setStep = useWizardStore((s) => s.setStep);
  const goNext = useWizardStore((s) => s.goNext);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const [submitted, setSubmitted] = useState(false);
  const [isMulti, setIsMulti] = useState(false);
  // 서브잡별 종료 상태 집계(탭 배지)
  const [subStatuses, setSubStatuses] = useState<Record<string, string>>({});

  // ★ 활성 스텝 — 미리보기/배지/제출/모니터 모두 이걸로
  const activeSteps = useMemo(
    () => filterActiveSteps(planResult?.steps, excludedSteps),
    [planResult?.steps, excludedSteps],
  );

  // 시드(상위 기능 없을 때 단독 동작): 플랜이 비어도 MOCK 데모용 기본 스텝
  const fallbackPlan: PlanStep[] = useMemo(
    () => [
      { step_idx: 1, step_name: "구조 최적화 (Geometry Optimization)", run_type: "GEO_OPT", inp_options: [], selected: true },
      { step_idx: 2, step_name: "단일점 에너지 (SCF Energy)", run_type: "ENERGY", inp_options: [], selected: true },
    ],
    [],
  );
  const hasPlan = (planResult?.steps?.length ?? 0) > 0;
  const submitSteps = hasPlan ? activeSteps : fallbackPlan;

  // 단일/다중 atom_info
  const multiStructures = (structuresInfo?.length ?? 0) > 1 ? structuresInfo : undefined;
  const primaryStructure =
    structureInfo ??
    structuresInfo?.[0] ??
    planResult?.atom_info ??
    seedAtomInfo();

  // 진입 시 현재 단계 동기화 (새로고침 시 잡 상태는 persist 제외 → pre 화면으로 복귀)
  useEffect(() => {
    setStep(5);
  }, [setStep]);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(undefined);
    setSubStatuses({});
    try {
      const body: SubmitJobBody = {
        files: generatedFiles ?? null,
        atom_info: primaryStructure,
        steps: submitSteps, // ★ 활성 스텝만
        job_name: jobName || defaultJobName(primaryStructure.filename),
        multi_atom_info: multiStructures ?? null,
        property: inpOptions?.property,
        custom_options: planResult?.expert_tip ? { expert_tip: planResult.expert_tip } : {},
        ...inpOptionsToBody(inpOptions),
      };
      const res: SubmitJobResponse = await submitJob(body);
      setJobName(res.directory);

      if (res.is_multi && res.sub_jobs?.length) {
        const map: Record<string, { filename: string; job_key: string; status?: string }> = {};
        for (const sj of res.sub_jobs) map[sj.job_key] = { ...sj, status: "Running" };
        setSubJobs(map);
        setActiveSubJobKey(res.sub_jobs[0].job_key);
        setIsMulti(true);
      } else {
        // 단일: directory를 단일 키로
        setSubJobs({ [res.directory]: { filename: primaryStructure.filename, job_key: res.directory } });
        setActiveSubJobKey(res.directory);
        setIsMulti(false);
      }
      setSubmitted(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSubmitError(`${t("f4.error.submit")}: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }

  const onSubStatus = React.useCallback((key: string, status: string) => {
    setSubStatuses((prev) => (prev[key] === status ? prev : { ...prev, [key]: status }));
  }, []);

  // 서브잡 탭 항목 + 상태 점
  const subJobList = useMemo(() => Object.values(subJobs ?? {}), [subJobs]);
  const tabs: TabItem[] = subJobList.map((sj) => ({
    value: sj.job_key,
    label: (
      <span className="inline-flex items-center gap-s1">
        <StatusDot status={subStatuses[sj.job_key]} />
        <span className="truncate max-w-[140px]">{sj.filename}</span>
      </span>
    ),
  }));

  const dlUrl = jobName ? downloadJobUrl(jobName) : null;
  const allFinished =
    subJobList.length > 0 &&
    subJobList.every((sj) => isDoneStatus(subStatuses[sj.job_key]));

  // ── 제출 전: 요약 화면 ──
  if (!submitted) {
    return (
      <SubmitSummary
        activeSteps={submitSteps}
        structure={multiStructures ? undefined : primaryStructure}
        structures={multiStructures}
        options={inpOptions}
        submitting={submitting}
        error={submitError}
        onSubmit={handleSubmit}
        hasPlan={hasPlan || true /* 시드 폴백으로 항상 제출 가능 */}
      />
    );
  }

  // ── 제출 후: 모니터링 대시보드 ──
  return (
    <div className="flex flex-col gap-s4">
      {isMulti && tabs.length > 1 ? (
        <TabBar
          items={tabs}
          value={activeSubJobKey ?? subJobList[0]?.job_key ?? ""}
          onValueChange={setActiveSubJobKey}
          ariaLabel={t("f4.tab.subjob")}
        />
      ) : null}

      {/* 서브잡 N개를 모두 마운트하되(상태 집계·미러), 활성만 표시 */}
      {subJobList.map((sj) => {
        const active = (activeSubJobKey ?? subJobList[0]?.job_key) === sj.job_key;
        const atom =
          multiStructures?.find((s) => s.filename === sj.filename) ?? primaryStructure;
        return (
          <div key={sj.job_key} className={active ? "block" : "hidden"}>
            <LiveMonitor
              jobKey={sj.job_key}
              steps={submitSteps}
              baseEnergy={mockBaseEnergy(atom)}
              isActive={active}
              onStatus={onSubStatus}
            />
          </div>
        );
      })}

      {/* 완료 배너 + 다운로드/다음 */}
      {allFinished ? (
        <div className="flex flex-wrap items-center gap-s4 rounded-lg border border-ok bg-ok-wash px-s4 py-s4">
          <CheckCircle2 size={18} strokeWidth={1.8} className="text-ok shrink-0" />
          <div className="min-w-0">
            <div className="font-serif text-base font-medium text-ink">{t("f4.done.title")}</div>
            <p className="text-sm text-ink-soft">{t("f4.done.message")}</p>
          </div>
          <div className="ml-auto flex items-center gap-s2 shrink-0">
            {dlUrl ? (
              <a href={dlUrl} download>
                <Button variant="default">
                  <Download size={16} strokeWidth={1.8} />
                  {t("f4.run.download")}
                </Button>
              </a>
            ) : (
              <Button variant="default" disabled title="MOCK 모드: 다운로드 비활성">
                <Download size={16} strokeWidth={1.8} />
                {t("f4.run.download")}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                goNext();
                router.push("/step-6");
              }}
            >
              {t("nav.next")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 새 제출(되돌리기) — 잡 상태 초기화 후 pre 화면 */}
      <div>
        <Button
          variant="ghost"
          onClick={() => {
            clearJob();
            setSubmitted(false);
            setIsMulti(false);
            setSubStatuses({});
          }}
        >
          ← {t("f4.submit.title")}
        </Button>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  const done = isDoneStatus(status);
  const failed = status && /failed|error|aborted/i.test(status);
  const color = failed ? "var(--oxblood)" : done ? "var(--ok)" : "var(--accent)";
  return (
    <span
      aria-hidden="true"
      style={{ width: 7, height: 7, borderRadius: 999, background: color, display: "inline-block" }}
    />
  );
}

function isDoneStatus(status?: string): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === "all_finished" || s === "completed" || s === "success";
}

function defaultJobName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9]+/g, "_") || "run";
}

/** 상위 f1 데이터가 없을 때 단독 동작용 시드 AtomInfo(MOCK 데모) */
function seedAtomInfo() {
  return {
    filename: "TiO2_anatase.cif",
    atom_count: 6,
    atoms: [],
    elements: ["Ti", "O"],
    element_counts: { Ti: 2, O: 4 },
    cell: [3.793, 3.793, 9.559],
    full_coord_text: "",
    full_cell_text: "",
    use_scaled: false,
  };
}
