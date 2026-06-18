"use client";
// app/(wizard)/step-6/page.tsx — 6단계: AI 분석 리포트 + 결과 다운로드 (f5-report)
// 진입 시 POST /generate-report. MOCK/완료결과 없음이면 시드. is_multi/excitations 분기 렌더.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { FileText, Download, RotateCcw, FlaskConical, AlertTriangle } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { getStep } from "@/lib/steps";
import { MOCK } from "@/lib/api";
import "@/lib/i18n/f5-report"; // 도메인 사전 등록(import 시점 side-effect)
import { generateReport, downloadJob } from "@/features/f5-report/api";
import { isErrorReport } from "@/features/f5-report/types";
import type { MockReport } from "@/features/f5-report/mock";
import { ReportView } from "@/features/f5-report/components/report-view";

// 선택된 단일 물성 키 추출 (f3 store는 토글 맵으로 보관 → 켜진 첫 키, 없으면 inpOptions.property)
function pickProperty(
  selected: Record<string, boolean>,
  inpProperty?: string,
): string {
  const on = Object.entries(selected).find(([, v]) => v)?.[0];
  return on ?? inpProperty ?? "geo_opt";
}

export default function Step6Page() {
  const router = useRouter();
  const { t, lang } = useT();
  const meta = getStep(6);

  const setStep = useWizardStore((s) => s.setStep);
  const reset = useWizardStore((s) => s.reset);
  const jobName = useWizardStore((s) => s.jobName);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const inpProperty = useWizardStore((s) => s.inpOptions?.property);
  const report = useWizardStore((s) => s.report) as MockReport | undefined;
  const setReport = useWizardStore((s) => s.setReport);
  const clearReport = useWizardStore((s) => s.clearReport);

  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 라우트 진입 시 단계 동기화
  useEffect(() => {
    setStep(6);
  }, [setStep]);

  const property = useMemo(
    () => pickProperty(selectedProperties, inpProperty),
    [selectedProperties, inpProperty],
  );

  // 완료 결과 없음 + 비-MOCK이면 "분석할 작업 없음" 상태
  const canGenerate = MOCK || !!jobName;

  const mutation = useMutation({
    mutationFn: () =>
      generateReport({ job_dir: jobName ?? "", property, lang }),
    onSuccess: (data) => setReport(data),
  });

  // 진입 시 1회 자동 생성 (리포트 없고 생성 가능할 때)
  useEffect(() => {
    if (!report && canGenerate && !mutation.isPending) {
      mutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canGenerate]);

  function regenerate() {
    clearReport();
    mutation.mutate();
  }

  async function onDownload() {
    if (!jobName) return;
    setDownloadError(null);
    try {
      await downloadJob(jobName);
    } catch {
      setDownloadError(t("f5.download.failed"));
    }
  }

  function onNewAnalysis() {
    reset(); // 상태 초기화 + localStorage 비움 (design-system §4.6)
    router.push("/step-1");
  }

  const errorReport = report && isErrorReport(report);

  return (
    <div className="cards-stack max-w-[920px]">
      {/* 본문 상태 분기 */}
      {!canGenerate ? (
        <Card>
          <CardHead
            icon={<FileText size={18} strokeWidth={1.8} />}
            title={meta?.h1 ?? t("f5.report.title")}
          />
          <CardContent>
            <p className="text-sm text-ink">{t("f5.report.noJob")}</p>
            <p className="mt-s2 text-sm text-ink-faint">{t("f5.report.noJobHint")}</p>
          </CardContent>
        </Card>
      ) : mutation.isError ? (
        <Card>
          <CardHead
            icon={<AlertTriangle size={18} strokeWidth={1.8} />}
            title={t("f5.report.error")}
          />
          <CardContent>
            <p className="text-sm text-oxblood break-words">
              {(mutation.error as Error)?.message ?? t("common.error")}
            </p>
            <div className="mt-s4">
              <Button variant="primary" onClick={regenerate}>
                {t("f5.report.retry")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !report || mutation.isPending ? (
        <Card>
          <CardHead
            icon={<FileText size={18} strokeWidth={1.8} />}
            title={t("f5.report.title")}
          />
          <CardContent>
            <div className="flex items-center gap-s3 text-sm text-ink-soft">
              <Spinner />
              <span>{t("f5.report.generating")}</span>
            </div>
            <p className="mt-s2 text-sm text-ink-faint">{t("f5.report.generatingHint")}</p>
          </CardContent>
        </Card>
      ) : errorReport ? (
        <Card>
          <CardHead
            icon={<AlertTriangle size={18} strokeWidth={1.8} />}
            title={t("f5.report.empty")}
          />
          <CardContent>
            <p className="text-sm text-ink-soft break-words">{report.report}</p>
            <div className="mt-s4">
              <Button variant="default" onClick={regenerate}>
                {t("f5.report.retry")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ReportView report={report} />
      )}

      {/* 액션 영역 (리포트가 정상일 때만 다운로드 노출) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-s3">
          <Button
            variant="primary"
            onClick={onDownload}
            disabled={MOCK || !jobName || !report || !!errorReport}
            title={MOCK ? t("f5.actions.downloadDisabled") : undefined}
          >
            <Download size={16} strokeWidth={1.8} />
            {MOCK ? t("f5.actions.downloadDisabled") : t("f5.actions.download")}
          </Button>
          <Button variant="default" onClick={onNewAnalysis}>
            <RotateCcw size={16} strokeWidth={1.8} />
            {t("f5.actions.newAnalysis")}
          </Button>
          {/* 보조 진입: 벤치마크 (주 진입은 StepRail 상시 행) */}
          <Button
            variant="default"
            className="ml-auto"
            onClick={() => router.push("/benchmark")}
          >
            <FlaskConical size={16} strokeWidth={1.8} />
            {t("f5.actions.benchmark")}
          </Button>
        </CardContent>
        {downloadError ? (
          <p className="mt-s2 text-sm text-oxblood px-s6">{downloadError}</p>
        ) : null}
      </Card>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin text-accent" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
