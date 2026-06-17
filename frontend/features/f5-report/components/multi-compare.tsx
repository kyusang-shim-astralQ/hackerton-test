// features/f5-report/components/multi-compare.tsx
// 다중-CIF(is_multi) 비교: §4 '구조별 주요 물성 종합 비교' 표 + 구조별 전체에너지 비교 차트
//   + 구조 탭 아래 스텝별 수렴 차트(여러 스텝 한 차트 금지).
// 단일 소스: data-models.md §17 ReportData(다중 summary = {파일명:{energy,target_property}}).
"use client";

import * as React from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Layers } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { CHART } from "@/lib/tokens";
import { useT } from "@/lib/i18n/use-t";
import type { ReportData } from "@/stores/types";
import { StepConvergence } from "./step-convergence";
import { multiStepSeries } from "./mock-histories";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface MultiEntry {
  energy?: string;
  target_property?: string;
}

/** "-2456.112233 au" → -2456.112233 (수치 파싱; 실패 시 NaN). */
function parseEnergy(raw?: string): number {
  if (!raw) return NaN;
  const m = raw.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : NaN;
}

export function MultiCompare({
  data,
  stepLabels,
}: {
  data: ReportData;
  stepLabels: string[];
}) {
  const { t } = useT();
  const entries = Object.entries(
    (data.summary ?? {}) as Record<string, MultiEntry>
  );
  const keys = entries.map(([k]) => k);

  // 상대 안정성: 에너지 오름차순(낮을수록 안정).
  const energies = entries.map(([, v]) => parseEnergy(v.energy));
  const valid = energies.filter((e) => !Number.isNaN(e));
  const minE = valid.length ? Math.min(...valid) : NaN;
  const maxE = valid.length ? Math.max(...valid) : NaN;
  // 동일에너지(범위 < 1e-6) → isostructural 표기
  const isostructural =
    valid.length > 1 && Math.abs(maxE - minE) < 1e-6;

  const sortedIdx = energies
    .map((e, i) => ({ e, i }))
    .filter((x) => !Number.isNaN(x.e))
    .sort((a, b) => a.e - b.e)
    .map((x) => x.i);
  const rankOf = (i: number): string => {
    if (isostructural) return t("f5.multi.isostructural");
    const pos = sortedIdx.indexOf(i);
    if (pos === 0) return t("f5.multi.col.rank") + " ★1";
    return `#${pos + 1}`;
  };

  // 차트 데이터(전체 에너지) — 가장 낮은(안정) 막대를 accent, 나머지 옅게.
  const chartData: ChartData<"bar"> = {
    labels: keys,
    datasets: [
      {
        label: t("f5.multi.col.energy"),
        data: energies.map((e) => (Number.isNaN(e) ? 0 : e)),
        backgroundColor: energies.map((e) =>
          e === minE ? CHART.line : "rgba(54,54,122,0.35)"
        ),
        borderColor: CHART.line,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };
  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: {
        grid: { color: CHART.grid },
        ticks: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 10 },
        },
      },
      x: {
        grid: { display: false },
        ticks: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 10 },
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: CHART.tooltipBg,
        titleFont: { family: CHART.tickFont },
        bodyFont: { family: CHART.tickFont },
        callbacks: {
          label: (item) => `${Number(item.parsed.y).toFixed(6)} a.u.`,
        },
      },
    },
  };

  // 구조 탭 + 탭별 스텝 차트(데모 합성 이력)
  const seriesByKey = React.useMemo(
    () => multiStepSeries(keys, stepLabels),
    [keys, stepLabels]
  );
  const [activeKey, setActiveKey] = React.useState(keys[0] ?? "");
  const curKey = keys.includes(activeKey) ? activeKey : keys[0] ?? "";

  return (
    <Card>
      <CardHead
        icon={<Layers />}
        title={t("f5.multi.head")}
        sub={<Badge>{t("f5.multi.badge")}</Badge>}
      />

      {/* 비교 표 — 행=구조, 열=전체에너지 + 타겟물성 + 상대안정성 */}
      <div className="overflow-x-auto">
        <table className="w-full text-base">
          <thead>
            <tr>
              {[
                t("f5.multi.col.structure"),
                t("f5.multi.col.energy"),
                t("f5.multi.col.target"),
                t("f5.multi.col.rank"),
              ].map((h) => (
                <th
                  key={h}
                  className="px-s3 py-s2 text-left text-label font-semibold uppercase tracking-[0.06em] text-ink-faint"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(([fname, v], i) => (
              <tr
                key={fname}
                className="border-b border-hairline-soft hover:bg-inset"
              >
                <td className="px-s3 py-s2 font-mono num text-ink">{fname}</td>
                <td className="px-s3 py-s2 font-mono num text-ink">
                  {v.energy ?? "N/A"}
                </td>
                <td className="px-s3 py-s2 font-mono num text-ink-soft">
                  {v.target_property ?? "N/A"}
                </td>
                <td className="px-s3 py-s2">
                  <Badge variant={energies[i] === minE ? "green" : "neutral"}>
                    {rankOf(i)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 구조별 전체 에너지 비교 차트 */}
      <div className="mt-s6">
        <div className="mb-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {t("f5.multi.chart.head")}
        </div>
        <div className="rounded-lg border border-hairline bg-card p-s3">
          <div style={{ height: 220 }} className="relative">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      </div>

      {/* 구조 탭 → 탭 아래 스텝별 수렴 차트 */}
      <div className="mt-s6">
        <div className="mb-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {t("f5.multi.tabs")}
        </div>
        {keys.length > 1 && (
          <Segmented
            aria-label={t("f5.multi.tabs")}
            value={curKey}
            onValueChange={setActiveKey}
            items={keys.map((k) => ({ value: k, label: k }))}
            className="mb-s3"
          />
        )}
        <StepConvergence
          key={curKey}
          series={seriesByKey[curKey] ?? []}
          height={240}
        />
      </div>
    </Card>
  );
}
