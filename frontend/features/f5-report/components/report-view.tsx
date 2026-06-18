"use client";
// features/f5-report/components/report-view.tsx — 리포트 본문 조립
// 단일: KPI + 마크다운 + 스텝 수렴 차트. 다중(is_multi): KPI 생략 + 비교 표/차트 + 마크다운.
// absorption/emission(excitations/spectrum): 리포트 맨 끝에 흡광 스펙트럼 블록.
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { MOCK } from "@/lib/api";
import type { MockReport, MockStepHistory } from "../mock";
import type { SingleSummary } from "../types";
import { ReportMarkdown } from "./report-markdown";
import { KpiCards } from "./kpi-cards";
import { StepConvergence } from "./step-convergence";
import { MultiComparison } from "./multi-comparison";
import { AbsorptionSpectrum } from "./absorption-spectrum";

export interface ReportViewProps {
  report: MockReport;
}

// 단일/다중 histories 분리: 다중은 키가 "fname::step", 단일은 그 외.
function isMultiHistoryKey(k: string): boolean {
  return k.includes("::");
}

export function ReportView({ report }: ReportViewProps) {
  const { t } = useT();
  const isMulti = report.is_multi === true;
  const histories: Record<string, MockStepHistory> = report.step_histories ?? {};
  const hasAbsorption =
    Array.isArray(report.excitations) && report.excitations.length > 0;

  // 단일 summary 안전 추출
  const single = report.summary as Partial<SingleSummary>;

  // 단일 스텝 차트용 히스토리(다중 키 제외)
  const singleHistories: Record<string, MockStepHistory> = {};
  for (const [k, v] of Object.entries(histories)) {
    if (!isMultiHistoryKey(k)) singleHistories[k] = v;
  }

  return (
    <div className="cards-stack">
      {/* 리포트 헤더 카드 */}
      <Card>
        <CardHead
          icon={<FileText size={18} strokeWidth={1.8} />}
          title={t("f5.report.title")}
          sub={
            <span className="inline-flex items-center gap-s1">
              <Badge variant={isMulti ? "indigo" : "green"}>
                {isMulti ? t("f5.badge.multi") : t("f5.badge.single")}
              </Badge>
              {MOCK ? <Badge variant="indigo">{t("f5.badge.mock")}</Badge> : null}
            </span>
          }
        />
        {/* 단일: KPI 카드 */}
        {!isMulti ? (
          <div className="mb-s4">
            <KpiCards
              finalEnergy={single.final_energy}
              targetProperty={single.target_property}
            />
          </div>
        ) : null}
        <ReportMarkdown markdown={report.report} />
      </Card>

      {/* 다중: 구조 간 비교 표/차트 + 구조 탭 아래 스텝 차트 */}
      {isMulti ? (
        <MultiComparison summary={report.summary} histories={histories} />
      ) : (
        /* 단일: 스텝별 수렴 차트(탭) */
        <StepConvergence histories={singleHistories} />
      )}

      {/* absorption/emission: 리포트 맨 끝 흡광 스펙트럼 블록 (다른 물성엔 미렌더) */}
      {hasAbsorption ? (
        <AbsorptionSpectrum excitations={report.excitations!} spectrum={report.spectrum} />
      ) : null}
    </div>
  );
}
