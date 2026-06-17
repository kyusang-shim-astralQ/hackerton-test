// features/f5-report/components/absorption-spectrum.tsx
// ★ absorption/emission(TDDFPT) 전용 — 리포트 맨 끝 별도 카드. (excitations/spectrum 존재 시에만)
// report_absorption.html 형식 미러:
//   1) 콤보 차트: 막대=상태별 진동자 세기 f(x=파장 nm, is_dark→회색/아니면 파랑, yAxisID 'yf')
//                 + 라인=Gaussian 흡수 강도(spectrum.intensities vs wavelengths, yAxisID 'yb')
//      x축 linear nm min300 max950, 좌Y "진동자 세기 (f)" / 우Y "흡수 강도 (arb.)".
//   2) 들뜸 상태 테이블 + "주요 흡수 피크"(f>0.01, osc 내림차순) 보조 표.
"use client";

import * as React from "react";
import {
  Chart as ChartJS,
  BarElement,
  PointElement,
  LineElement,
  LinearScale,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { Waves } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CHART } from "@/lib/tokens";
import { useT } from "@/lib/i18n/use-t";
import type { ReportData } from "@/stores/types";

ChartJS.register(
  BarElement,
  PointElement,
  LineElement,
  LinearScale,
  Tooltip,
  Legend
);

const DARK_COLOR = "#9aa0b5"; // 암상태 막대(회색, design-system stick 톤)
const BRIGHT_COLOR = CHART.line; // 밝은 상태 막대(accent 파랑)

type Excitation = NonNullable<ReportData["excitations"]>[number];
type Spectrum = NonNullable<ReportData["spectrum"]>;

export function AbsorptionSpectrum({
  excitations,
  spectrum,
}: {
  excitations: Excitation[];
  spectrum?: Spectrum;
}) {
  const { t } = useT();

  // 막대: (x=파장 nm, y=f) — Chart.js 'bar' 를 linear x 위에 올리려면 {x,y} 포인트 사용.
  const oscPoints = excitations.map((e) => ({
    x: e.wavelength_nm,
    y: e.osc_strength,
  }));
  const barColors = excitations.map((e) =>
    e.is_dark ? DARK_COLOR : BRIGHT_COLOR
  );

  // 라인: Gaussian 곡선(spectrum.intensities vs wavelengths).
  const linePoints =
    spectrum?.wavelengths.map((nm, i) => ({
      x: nm,
      y: spectrum.intensities[i] ?? 0,
    })) ?? [];

  const data: ChartData<"bar" | "line"> = {
    datasets: [
      {
        type: "bar" as const,
        label: t("f5.abs.osc"),
        data: oscPoints,
        backgroundColor: barColors,
        borderColor: barColors,
        borderWidth: 1,
        yAxisID: "yf",
        barThickness: 4,
        order: 2,
      },
      {
        type: "line" as const,
        label: t("f5.abs.spectrum"),
        data: linePoints,
        borderColor: "rgba(176,74,68,0.9)", // 흡수 강도 라인(옥스블러드 계열)
        backgroundColor: "rgba(176,74,68,0.12)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        yAxisID: "yb",
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    parsing: false,
    scales: {
      x: {
        type: "linear",
        min: 300,
        max: 950,
        title: {
          display: true,
          text: t("f5.abs.chart.x"),
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 11 },
        },
        grid: { color: CHART.grid },
        ticks: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 10 },
        },
      },
      yf: {
        type: "linear",
        position: "left",
        title: {
          display: true,
          text: t("f5.abs.chart.yLeft"),
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 11 },
        },
        grid: { color: CHART.grid },
        ticks: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 10 },
        },
        beginAtZero: true,
      },
      yb: {
        type: "linear",
        position: "right",
        title: {
          display: true,
          text: t("f5.abs.chart.yRight"),
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 11 },
        },
        grid: { display: false },
        ticks: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 10 },
        },
        beginAtZero: true,
      },
    },
    plugins: {
      legend: {
        display: true,
        labels: {
          color: CHART.tick,
          font: { family: CHART.tickFont, size: 11 },
          boxWidth: 12,
        },
      },
      tooltip: {
        backgroundColor: CHART.tooltipBg,
        titleFont: { family: CHART.tickFont },
        bodyFont: { family: CHART.tickFont },
        callbacks: {
          title: (items) =>
            `${Number(items[0]?.parsed.x).toFixed(1)} nm`,
          label: (item) =>
            item.dataset.type === "bar"
              ? `f = ${Number(item.parsed.y).toFixed(4)}`
              : `${t("f5.abs.chart.yRight")}: ${Number(item.parsed.y).toFixed(3)}`,
        },
      },
    },
  };

  // 주요 흡수 피크: f > 0.01 을 osc 내림차순
  const peaks = [...excitations]
    .filter((e) => e.osc_strength > 0.01)
    .sort((a, b) => b.osc_strength - a.osc_strength);

  return (
    <Card>
      <CardHead
        icon={<Waves />}
        title={t("f5.abs.head")}
        sub={<Badge>{t("f5.abs.badge")}</Badge>}
      />

      {/* 1) 콤보 차트 */}
      <div className="rounded-lg border border-hairline bg-card p-s3">
        <div style={{ height: 320 }} className="relative">
          <Chart type="bar" data={data} options={options} />
        </div>
      </div>

      {/* 2) 들뜸 상태 테이블 */}
      <div className="mt-s6">
        <div className="mb-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint">
          {t("f5.abs.table.head")}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr>
                {[
                  t("f5.abs.col.state"),
                  t("f5.abs.col.energy"),
                  t("f5.abs.col.wavelength"),
                  t("f5.abs.col.osc"),
                  t("f5.abs.col.region"),
                  t("f5.abs.col.class"),
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
              {excitations.map((e) => (
                <tr
                  key={e.state}
                  className="border-b border-hairline-soft hover:bg-inset"
                >
                  <td className="px-s3 py-s2 font-mono num text-ink">
                    {e.state}
                  </td>
                  <td className="px-s3 py-s2 font-mono num text-ink">
                    {e.energy_ev.toFixed(3)}
                  </td>
                  <td className="px-s3 py-s2 font-mono num text-ink">
                    {e.wavelength_nm.toFixed(1)}
                  </td>
                  <td className="px-s3 py-s2 font-mono num text-ink">
                    {e.osc_strength.toFixed(4)}
                  </td>
                  <td className="px-s3 py-s2 text-ink-soft">{e.region}</td>
                  <td className="px-s3 py-s2">
                    <Badge variant={e.is_dark ? "neutral" : "indigo"}>
                      {e.is_dark ? t("f5.abs.dark") : t("f5.abs.bright")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* "주요 흡수 피크" 보조 표 (f > 0.01, osc 내림차순) */}
      {peaks.length > 0 && (
        <div className="mt-s6">
          <div className="mb-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint">
            {t("f5.abs.peaks.head")}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr>
                  {[
                    t("f5.abs.col.state"),
                    t("f5.abs.col.wavelength"),
                    t("f5.abs.col.energy"),
                    t("f5.abs.col.osc"),
                    t("f5.abs.col.region"),
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
                {peaks.map((e) => (
                  <tr
                    key={e.state}
                    className="border-b border-hairline-soft hover:bg-inset"
                  >
                    <td className="px-s3 py-s2 font-mono num text-ink">
                      {e.state}
                    </td>
                    <td className="px-s3 py-s2 font-mono num text-ink">
                      {e.wavelength_nm.toFixed(1)}
                    </td>
                    <td className="px-s3 py-s2 font-mono num text-ink">
                      {e.energy_ev.toFixed(3)}
                    </td>
                    <td className="px-s3 py-s2 font-mono num text-ink">
                      {e.osc_strength.toFixed(4)}
                    </td>
                    <td className="px-s3 py-s2 text-ink-soft">{e.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
