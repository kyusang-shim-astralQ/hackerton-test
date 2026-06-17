// components/ui/convergence-chart.tsx — SCF |ΔE| 수렴 차트 (react-chartjs-2, 로그축, design-system §3.10)
"use client";

import * as React from "react";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
  Filler,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { CHART } from "@/lib/tokens";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
  Filler
);

export interface ConvergenceChartProps {
  /** 이 차트가 담당하는 계산 스텝(step_histories 키) */
  stepIndex: number;
  stepLabel?: string;
  /** 해당 스텝의 SCF step 번호 */
  labels: (number | string)[];
  /** 해당 스텝의 |ΔE| (Ha) */
  delta: number[];
  target?: number;
  height?: number;
}

export function ConvergenceChart({
  stepIndex,
  stepLabel,
  labels,
  delta,
  target = 1.0e-6,
  height = 300,
}: ConvergenceChartProps) {
  const empty = delta.length === 0;

  const data: ChartData<"line"> = React.useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: `|ΔE|`,
          data: delta,
          borderColor: CHART.line,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: CHART.line,
          pointHoverBorderColor: "#ffffff",
          backgroundColor: (ctx) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return CHART.fillBottom;
            const g = c.createLinearGradient(
              0,
              chartArea.top,
              0,
              chartArea.bottom
            );
            g.addColorStop(0, CHART.fillTop);
            g.addColorStop(1, CHART.fillBottom);
            return g;
          },
        },
      ],
    }),
    [labels, delta]
  );

  const options: ChartOptions<"line"> = React.useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          type: "logarithmic",
          grid: { color: CHART.grid },
          ticks: {
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 10 },
            callback: (value) => {
              const v = Number(value);
              if (v <= 0) return "";
              const exp = Math.round(Math.log10(v));
              return `1e${exp}`;
            },
          },
        },
        x: {
          grid: { display: false },
          ticks: {
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 10 },
            maxTicksLimit: 8,
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
            title: (items) => `SCF step ${items[0]?.label ?? ""}`,
            label: (item) =>
              `|ΔE| = ${Number(item.parsed.y).toExponential(1)} Ha`,
          },
        },
      },
    }),
    []
  );

  return (
    <div className="rounded-lg border border-hairline bg-card p-s3">
      {stepLabel && (
        <div className="mb-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {stepLabel}
        </div>
      )}
      <div style={{ height }} className="relative">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-faint">
            — 수렴 데이터 없음 (step {stepIndex}) · target {target.toExponential(0)}
          </div>
        ) : (
          <Line data={data} options={options} />
        )}
      </div>
    </div>
  );
}
