"use client";
// features/f5-report/components/multi-comparison.tsx — 다중-CIF(is_multi) 구조 간 비교
// 구조별 final_energy/target_property 나란히 비교(표+차트). 구조별 스텝 차트는 구조 탭 아래.
import { useMemo, useState } from "react";
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
import { Card, CardHead } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConvergenceChart } from "@/components/ui/convergence-chart";
import { GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHART } from "@/lib/tokens";
import { useT } from "@/lib/i18n/provider";
import type { MockStepHistory } from "../mock";
import { isMultiSummaryItem } from "../types";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export interface MultiComparisonProps {
  summary: Record<string, unknown>; // {fname: {energy, target_property}}
  histories?: Record<string, MockStepHistory>; // 키 "fname::step"
}

interface Row extends Record<string, unknown> {
  structure: string;
  energy: string;
  target: string;
  region: string;
}

export function MultiComparison({ summary, histories }: MultiComparisonProps) {
  const { t } = useT();

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const energies: number[] = [];
    for (const [fname, val] of Object.entries(summary)) {
      if (!isMultiSummaryItem(val)) continue;
      const e = parseFloat(val.energy);
      if (!Number.isNaN(e)) energies.push(e);
    }
    // 동일에너지(isostructural) 판정: 모든 에너지가 (반올림 6자리) 동일하면 isostructural
    const uniq = new Set(energies.map((e) => e.toFixed(6)));
    const iso = energies.length > 1 && uniq.size === 1;
    for (const [fname, val] of Object.entries(summary)) {
      if (!isMultiSummaryItem(val)) continue;
      out.push({
        structure: fname,
        energy: val.energy ?? "N/A",
        target: val.target_property ?? "N/A",
        region: iso ? t("f5.multi.isostructural") : "—",
      });
    }
    return out;
  }, [summary, t]);

  const columns: Column<Row>[] = [
    { key: "structure", header: t("f5.multi.col.structure") },
    { key: "energy", header: t("f5.multi.col.energy"), align: "right", mono: true },
    { key: "target", header: t("f5.multi.col.target"), mono: true },
    { key: "region", header: t("f5.multi.col.region") },
  ];

  // 구조 간 전체에너지 비교 막대 차트
  const barData = useMemo<ChartData<"bar">>(() => {
    const labels = rows.map((r) => r.structure);
    const data = rows.map((r) => {
      const v = parseFloat(r.energy);
      return Number.isNaN(v) ? 0 : v;
    });
    return {
      labels,
      datasets: [
        {
          label: t("f5.multi.col.energy"),
          data,
          backgroundColor: CHART.line,
          borderRadius: 4,
          maxBarThickness: 56,
        },
      ],
    };
  }, [rows, t]);

  const barOptions = useMemo<ChartOptions<"bar">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          titleFont: { family: CHART.tickFont },
          bodyFont: { family: CHART.tickFont },
          callbacks: { label: (i) => `${Number(i.parsed.y).toFixed(6)} a.u.` },
        },
      },
      scales: {
        y: {
          grid: { color: CHART.grid },
          ticks: { color: CHART.tick, font: { family: CHART.tickFont, size: 10 } },
        },
        x: {
          grid: { display: false },
          ticks: { color: CHART.tick, font: { family: CHART.tickFont, size: 10 } },
        },
      },
    }),
    [],
  );

  // 구조 탭 + 구조별 스텝 차트 (histories 키가 "fname::step")
  const structures = rows.map((r) => r.structure);
  const [activeStruct, setActiveStruct] = useState(structures[0] ?? "");

  const structHistories = useMemo(() => {
    if (!histories) return [] as { key: string; h: MockStepHistory }[];
    return Object.entries(histories)
      .filter(([k]) => k.startsWith(`${activeStruct}::`))
      .map(([key, h]) => ({ key, h }));
  }, [histories, activeStruct]);

  return (
    <div className="cards-stack">
      <Card>
        <CardHead
          icon={<GitCompare size={18} strokeWidth={1.8} />}
          title={t("f5.multi.title")}
          sub={`${rows.length} structures`}
        />
        <DataTable variant="report" columns={columns} rows={rows} />
        <div className="mt-s4">
          <div className="text-meta uppercase tracking-[0.08em] text-ink-faint mb-s2">
            {t("f5.multi.chartTitle")}
          </div>
          <div style={{ height: 220 }} className="relative w-full">
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      </Card>

      {histories && Object.keys(histories).length > 0 ? (
        <Card>
          <CardHead title={t("f5.conv.title")} sub={t("f5.multi.tab")} />
          {/* 구조 탭 */}
          <div role="tablist" className="flex flex-wrap gap-s1 mb-s3">
            {structures.map((s) => {
              const on = s === activeStruct;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={on}
                  type="button"
                  onClick={() => setActiveStruct(s)}
                  className={cn(
                    "h-[30px] px-s3 rounded-md text-sm font-medium transition-colors border",
                    on
                      ? "bg-accent text-white border-accent"
                      : "bg-card text-ink-soft border-hairline-2 hover:bg-inset",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {/* 활성 구조의 스텝별 차트 (각 스텝 = 개별 차트, 합치지 않음) */}
          {structHistories.length > 0 ? (
            <div className="cards-stack">
              {structHistories.map(({ key, h }, i) => (
                <div key={key}>
                  <div className="text-sm text-ink-soft mb-s1">{h.label}</div>
                  <ConvergenceChart
                    stepIndex={i + 1}
                    stepLabel={h.label}
                    labels={h.scf}
                    delta={h.delta}
                    height={220}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">{t("f5.conv.none")}</p>
          )}
        </Card>
      ) : (
        <Card variant="default">
          <CardHead title={t("f5.multi.title")} />
          <Badge variant="indigo">{t("f5.badge.multi")}</Badge>
        </Card>
      )}
    </div>
  );
}
