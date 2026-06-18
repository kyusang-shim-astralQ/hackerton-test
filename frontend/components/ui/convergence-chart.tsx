"use client";
// components/ui/convergence-chart.tsx — SCF |ΔE| 수렴 차트 (Chart.js, design-system §3.10)
// ★ 스텝별 인스턴스: 차트 하나는 한 계산 스텝(step_histories[stepIndex])만 그린다(단일 통합 차트 금지).
import React, { useMemo } from "react";
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
import { CHART, SCF_TARGET } from "@/lib/tokens";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  LogarithmicScale,
  CategoryScale,
  Tooltip,
  Filler,
);

export interface ConvergenceChartProps {
  stepIndex: number;
  stepLabel?: string;
  labels: (number | string)[];
  delta: number[];
  target?: number;
  height?: number;
}

export function ConvergenceChart({
  stepIndex,
  stepLabel,
  labels,
  delta,
  target = SCF_TARGET,
  height = 300,
}: ConvergenceChartProps) {
  const hasData = delta.length > 0;

  const data = useMemo<ChartData<"line">>(
    () => ({
      labels: labels.length ? labels : delta.map((_, i) => i + 1),
      datasets: [
        {
          label: stepLabel ?? `Step ${stepIndex}`,
          data: delta,
          borderColor: CHART.line,
          borderWidth: 2,
          tension: 0.35,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: CHART.line,
          pointHoverBorderColor: "#ffffff",
          pointHoverBorderWidth: 2,
          backgroundColor: (ctx) => {
            const { chartArea, ctx: c } = ctx.chart;
            if (!chartArea) return CHART.fillBottom;
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, CHART.fillTop);
            g.addColorStop(1, CHART.fillBottom);
            return g;
          },
        },
      ],
    }),
    [labels, delta, stepIndex, stepLabel],
  );

  const options = useMemo<ChartOptions<"line">>(
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
          callbacks: {
            title: (items) => `SCF step ${items[0]?.label ?? ""}`,
            label: (item) => `|ΔE| = ${Number(item.parsed.y).toExponential(1)} Ha`,
          },
        },
      },
      scales: {
        y: {
          type: "logarithmic",
          grid: { color: CHART.grid },
          ticks: {
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 10 },
            callback: (v) => {
              const n = Number(v);
              if (n <= 0) return "";
              const log = Math.log10(n);
              return Number.isInteger(log) ? `1e${log}` : "";
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
    }),
    [],
  );

  return (
    <div style={{ height }} className="relative w-full">
      {hasData ? (
        <Line data={data} options={options} />
      ) : (
        <ChartFallback target={target} />
      )}
    </div>
  );
}

// 오프라인/빈 상태 폴백 — 인라인 SVG 곡선
function ChartFallback({ target }: { target: number }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-s2 rounded-md border border-dashed border-hairline-2 bg-inset/40">
      <svg width="180" height="80" viewBox="0 0 180 80" aria-hidden="true">
        <polyline
          points="6,12 40,28 74,44 108,58 142,68 174,72"
          fill="none"
          stroke={CHART.line}
          strokeWidth="2"
          opacity="0.5"
        />
        <line x1="0" y1="72" x2="180" y2="72" stroke={CHART.grid} strokeWidth="1" strokeDasharray="3 3" />
      </svg>
      <span className="text-meta mono text-ink-faint">
        수렴 데이터 대기 · target {target.toExponential(0)} Ha
      </span>
    </div>
  );
}
