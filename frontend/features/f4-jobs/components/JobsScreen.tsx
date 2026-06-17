// features/f4-jobs/components/JobsScreen.tsx — step-5 본체(제출 → 실시간 모니터링 → 완료/다운로드).
// 단일 소스: docs/features/f4-jobs/api.md · docs/contracts/data-models.md · docs/design-system.md §4.2/§4.3.
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, ArrowRight, Sparkles } from "lucide-react";

import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";
import {
  SEED_ATOM_INFO,
  SEED_OPTIONS,
  SEED_STEPS,
} from "@/features/f3-inp/api";
import { IS_MOCK } from "@/lib/api";
import type { AtomInfo } from "@/stores/types";

import { computeActiveSteps } from "../lib/active-steps";
import { submitJob, downloadJob, saveBlob, type SubmitJobBody } from "../api";
import { SubmitSummary } from "./SubmitSummary";
import { MonitorDashboard } from "./MonitorDashboard";
import { SubJobTabs } from "./SubJobTabs";

function defaultJobName(structures: AtomInfo[]): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 15);
  if (structures.length > 1) return `MultiCompare_${stamp}`;
  const base = (structures[0]?.filename ?? "job")
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9]+/g, "_");
  return `${base}_${stamp}`;
}

export function JobsScreen() {
  const { t, lang } = useT();
  const router = useRouter();

  // store — 입력(f1/f2/f3) + 런타임(f4)
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const planResult = useWizardStore((s) => s.planResult);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const generatedFiles = useWizardStore((s) => s.generatedFiles);
  const excludedSteps = useWizardStore((s) => s.excludedSteps);

  const submitResponse = useWizardStore((s) => s.submitResponse);
  const setSubmitResponse = useWizardStore((s) => s.setSubmitResponse);
  const clearJobRuntime = useWizardStore((s) => s.clearJobRuntime);
  const setJobLive = useWizardStore((s) => s.setJobLive);
  const goToStep = useWizardStore((s) => s.goToStep);

  // 진입 시 이전 런타임 잡 상태 정리(죽은 잡 유령 방지, §4.6). 1회만.
  React.useEffect(() => {
    clearJobRuntime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 상위 미완성 시 시드로 단독 동작(idle 금지). seeded 표시.
  const seeded = !planResult || !structureInfo;
  const planSteps = planResult?.steps ?? SEED_STEPS;
  const options = inpOptions ?? SEED_OPTIONS;
  const property =
    Object.keys(selectedProperties).find((k) => selectedProperties[k]) ??
    "energy";

  // 구조 목록(다중-CIF면 structuresInfo, 아니면 단일). 미완성 시 시드.
  const structures: AtomInfo[] = React.useMemo(() => {
    if (structuresInfo && structuresInfo.length > 0) return structuresInfo;
    if (structureInfo) return [structureInfo];
    return [SEED_ATOM_INFO];
  }, [structuresInfo, structureInfo]);

  // ★ 활성 스텝(§0) — planResult.steps 를 직접 쓰지 않는다.
  const activeSteps = React.useMemo(
    () => computeActiveSteps(planSteps, excludedSteps),
    [planSteps, excludedSteps]
  );

  const [jobName] = React.useState(() => defaultJobName(structures));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = React.useCallback(async () => {
    if (activeSteps.length === 0) return;
    setError(null);
    setSubmitting(true);
    setJobLive(undefined);
    try {
      const isMulti = structures.length > 1;
      const body: SubmitJobBody = {
        // f3 생성파일이 있으면 그대로 제출, 없으면 자동생성(null)
        files: generatedFiles && generatedFiles.length > 0 ? generatedFiles : null,
        atom_info: structures[0],
        steps: activeSteps, // ★ 활성 스텝만 — 제외 스텝이 클러스터에 가지 않음
        job_name: jobName,
        multi_atom_info: isMulti ? structures : null,
        property,
        cutoff: options.cutoff,
        rel_cutoff: options.rel_cutoff,
        functional: options.functional,
        basis_set: options.basis_set,
        method: options.method,
        scf_algo: options.scf_algo,
        charge: options.charge,
        multiplicity: options.multiplicity,
        use_smear: options.use_smear,
        smear_temp: options.smear_temp,
        eps_scf: options.eps_scf,
        periodic: options.periodic,
        max_scf: options.max_scf ?? null,
        ignore_scf_failure: options.ignore_scf_failure,
        lsd: options.lsd,
        added_mos: options.added_mos ?? null,
        custom_options: planResult?.expert_tip
          ? { expert_tip: planResult.expert_tip }
          : {},
      };
      const resp = await submitJob(body, lang);
      setSubmitResponse(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    activeSteps,
    structures,
    generatedFiles,
    jobName,
    property,
    options,
    planResult,
    lang,
    setSubmitResponse,
    setJobLive,
  ]);

  // ── 다운로드 + 다음 단계 ──
  const [downloading, setDownloading] = React.useState(false);
  const jobLive = useWizardStore((s) => s.jobLive);
  const allFinished = jobLive?.finished === true;

  const handleDownload = React.useCallback(async () => {
    if (!submitResponse) return;
    setDownloading(true);
    try {
      const blob = await downloadJob(submitResponse.directory);
      saveBlob(blob, `${submitResponse.directory}.tar.gz`);
    } catch {
      // 무시(목/네트워크) — 사용자 흐름 차단하지 않음
    } finally {
      setDownloading(false);
    }
  }, [submitResponse]);

  const goReport = React.useCallback(() => {
    goToStep(6);
    router.push("/step-6");
  }, [goToStep, router]);

  // ── 렌더 ──
  // 1) 제출 전: 요약 화면
  if (!submitResponse) {
    return (
      <div className="flex flex-col gap-s4">
        {seeded && (
          <Card variant="accent">
            <CardContent className="flex items-center gap-s2 text-accent-ink">
              <Sparkles className="h-[16px] w-[16px] flex-none" />
              {t("f4.submit.desc")}
            </CardContent>
          </Card>
        )}
        <SubmitSummary
          activeSteps={activeSteps}
          structures={structures}
          jobName={jobName}
          submitting={submitting}
          error={error}
          onSubmit={handleSubmit}
        />
      </div>
    );
  }

  // 2) 제출 후: 모니터 대시보드 (다중=서브잡 탭 / 단일=단일 모니터)
  return (
    <div className="flex flex-col gap-s4">
      {submitResponse.is_multi && submitResponse.sub_jobs ? (
        <SubJobTabs subJobs={submitResponse.sub_jobs} lang={lang} />
      ) : (
        <MonitorDashboard jobKey={submitResponse.directory} lang={lang} />
      )}

      {/* 완료 시: 다운로드 + 리포트 진행 */}
      {allFinished && (
        <Card variant="accent">
          <CardHead icon={<CheckCircle2 />} title={t("f4.done.title")} />
          <CardContent>
            <p className="text-ink-soft">{t("f4.done.message")}</p>
            <div className="mt-s4 flex flex-wrap items-center gap-s3">
              <Button variant="default" loading={downloading} onClick={handleDownload}>
                <Download className="h-[16px] w-[16px]" />
                {downloading ? t("f4.done.downloading") : t("f4.done.download")}
              </Button>
              <Button variant="primary" size="lg" onClick={goReport}>
                {t("f4.done.next")}
                <ArrowRight className="h-[16px] w-[16px]" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
