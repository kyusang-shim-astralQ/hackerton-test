// features/f5-report/components/report-view.tsx
// f5-report 화면 본체: 진입 시 /generate-report 호출 → 7섹션 마크다운 + KPI + 스텝 차트
//   + (다중) 비교 표/차트 + (absorption/emission) 흡광 스펙트럼 + 다운로드 + 새 분석/벤치마크.
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Download,
  RefreshCw,
  RotateCcw,
  FlaskConical,
  AlertTriangle,
  Loader2,
  Activity,
} from "lucide-react";

import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/use-t";
import { IS_MOCK } from "@/lib/api";
import type { PlanStep, ReportData } from "@/stores/types";

import {
  generateReport,
  downloadJob,
  isErrorReport,
} from "../api";
import { ReportMarkdown } from "./report-markdown";
import { ReportSummary } from "./report-summary";
import { StepConvergence } from "./step-convergence";
import { MultiCompare } from "./multi-compare";
import { AbsorptionSpectrum } from "./absorption-spectrum";
import { singleStepSeries } from "./mock-histories";

/** selectedProperties(단일 선택 맵) → 첫 true 키. 없으면 geo_opt. */
function pickProperty(selected: Record<string, boolean>): string {
  const key = Object.keys(selected).find((k) => selected[k]);
  return (key ?? "geo_opt").toLowerCase();
}

/** plan steps → 스텝 라벨(예: "① GEO_OPT"). 활성(selected!==false && exclude!==true)만. */
function stepLabels(steps: PlanStep[] | undefined): string[] {
  const circ = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"];
  const active = (steps ?? []).filter(
    (s) => s.selected !== false && s.exclude !== true
  );
  const src = active.length ? active : [{ run_type: "ENERGY" } as PlanStep];
  return src.map(
    (s, i) => `${circ[i] ?? i + 1} ${s.run_type || s.step_name || `Step ${i + 1}`}`
  );
}

export function ReportView() {
  const { t, lang } = useT();
  const router = useRouter();

  const jobName = useWizardStore((s) => s.jobName);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const planResult = useWizardStore((s) => s.planResult);
  const reportData = useWizardStore((s) => s.reportData);
  const setReportData = useWizardStore((s) => s.setReportData);
  const reset = useWizardStore((s) => s.reset);

  const property = pickProperty(selectedProperties);
  const labels = React.useMemo(
    () => stepLabels(planResult?.steps),
    [planResult]
  );

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  const fetchReport = React.useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await generateReport({
        job_dir: jobName ?? "",
        property,
        lang,
      });
      // 에러 축약형 방어(summary=={} + 에러 문구)
      if (isErrorReport(data)) {
        setErrorMsg(data.report || t("f5.error.title"));
        setReportData(undefined);
      } else {
        setReportData(data);
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setReportData(undefined);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobName, property, lang]);

  // 진입 시 1회 자동 생성(이미 있으면 재사용). MOCK 이면 jobName 없어도 시드로 동작.
  React.useEffect(() => {
    if (reportData) return;
    if (!jobName && !IS_MOCK) {
      setErrorMsg(t("f5.error.noJob"));
      return;
    }
    void fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDownload = async () => {
    if (!jobName || IS_MOCK) return;
    setDownloading(true);
    try {
      await downloadJob(jobName);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  };

  const onNewAnalysis = () => {
    reset(); // 상태 초기화 + localStorage 비움(design-system §4.6)
    router.push("/step-1");
  };

  const goBenchmark = () => router.push("/benchmark");

  const data: ReportData | undefined = reportData;
  const isAbsorption =
    !!data?.excitations && data.excitations.length > 0;

  return (
    <div className="space-y-s4">
      {IS_MOCK && (
        <div className="flex items-center gap-s2 rounded-md border border-accent-edge bg-accent-wash px-s4 py-s2 text-sm text-accent-ink">
          <Activity className="h-4 w-4" />
          {t("f5.mock.banner")}
        </div>
      )}

      {/* 생성 중 */}
      {loading && (
        <Card>
          <CardContent className="flex items-center gap-s3 py-s6">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <div>
              <div className="text-base text-ink">{t("f5.generating")}</div>
              <div className="text-sm text-ink-faint">
                {t("f5.generating.hint")}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 에러 */}
      {!loading && errorMsg && (
        <Card>
          <CardHead
            icon={<AlertTriangle />}
            title={t("f5.error.title")}
            sub={<Badge variant="oxblood">error</Badge>}
          />
          <CardContent>
            <p className="text-oxblood">{errorMsg}</p>
            <div className="mt-s4 flex gap-s2">
              <Button variant="default" onClick={() => void fetchReport()}>
                <RefreshCw className="h-4 w-4" />
                {t("common.retry")}
              </Button>
              <Button variant="ghost" onClick={onNewAnalysis}>
                <RotateCcw className="h-4 w-4" />
                {t("f5.new")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 리포트 */}
      {!loading && data && !errorMsg && (
        <>
          {/* KPI 요약 */}
          <Card>
            <CardHead
              icon={<FileText />}
              title={t("f5.summary.head")}
              sub={
                data.is_multi ? (
                  <Badge>{t("f5.multi.badge")}</Badge>
                ) : isAbsorption ? (
                  <Badge>{t("f5.abs.badge")}</Badge>
                ) : (
                  <Badge variant="green">{property}</Badge>
                )
              }
            />
            <ReportSummary data={data} />
          </Card>

          {/* 마크다운 본문(7섹션 + 수식 + 표) */}
          <Card>
            <CardHead icon={<FileText />} title={t("f5.report.head")} />
            <ReportMarkdown markdown={data.report} />
          </Card>

          {/* 다중-CIF: 구조 비교 표/차트 + 구조 탭 아래 스텝 차트 */}
          {data.is_multi && (
            <MultiCompare data={data} stepLabels={labels} />
          )}

          {/* 단일: 스텝별 수렴 차트(스텝 탭/개별 차트, 합치지 않음) */}
          {!data.is_multi && (
            <Card>
              <CardHead icon={<Activity />} title={t("f5.steps.head")} />
              <StepConvergence series={singleStepSeries(labels)} />
            </Card>
          )}

          {/* ★ absorption/emission 전용 — 리포트 맨 끝 흡광 스펙트럼 */}
          {isAbsorption && (
            <AbsorptionSpectrum
              excitations={data.excitations!}
              spectrum={data.spectrum}
            />
          )}
        </>
      )}

      {/* 액션 바: 다운로드 · 새 분석 · 벤치마크(보조 진입) */}
      <Card>
        <div className="flex flex-wrap items-center gap-s3">
          <Button
            variant="default"
            onClick={onDownload}
            disabled={IS_MOCK || !jobName || downloading}
            loading={downloading}
            title={IS_MOCK ? t("f5.dl.disabled") : undefined}
          >
            <Download className="h-4 w-4" />
            {t("f5.dl.full")}
          </Button>

          <Button variant="primary" onClick={onNewAnalysis}>
            <RotateCcw className="h-4 w-4" />
            {t("f5.new")}
          </Button>

          {/* 벤치마크 진입(보조) — 주 진입은 좌측 StepRail 상시 행 */}
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={goBenchmark}
          >
            <FlaskConical className="h-4 w-4" />
            {t("f5.benchmark")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
