"use client";
// features/f5-report/components/absorption-spectrum.tsx — 흡광 스펙트럼 블록 (absorption/emission 전용)
// ★ 리포트 맨 끝. report_absorption.html 형식 미러: 콤보 차트(막대=f / 라인=Gaussian, dual-axis) + 들뜸 표 + 주요 피크.
import { useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  LineElement,
  PointElement,
  LinearScale,
  Tooltip,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import { Chart } from "react-chartjs-2";
import { Card, CardHead } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Waves } from "lucide-react";
import { CHART } from "@/lib/tokens";
import { useT } from "@/lib/i18n/provider";
import type { Excitation, Spectrum } from "../types";

ChartJS.register(BarElement, LineElement, PointElement, LinearScale, Tooltip);

const DARK_COLOR = "#9aa0b5"; // 암상태 막대 (회색)
const BRIGHT_COLOR = CHART.line; // 밝은 상태 막대 (인디고/파랑)

export interface AbsorptionSpectrumProps {
  excitations: Excitation[];
  spectrum?: Spectrum;
}

interface ExRow extends Record<string, unknown> {
  state: number;
  energy: string;
  wavelength: string;
  osc: string;
  region: string;
  klass: string;
  is_dark: boolean;
}

export function AbsorptionSpectrum({ excitations, spectrum }: AbsorptionSpectrumProps) {
  const { t } = useT();

  // 콤보 차트: 막대(f, yf) + 라인(Gaussian, yb)
  const data = useMemo<ChartData<"bar" | "line", { x: number; y: number }[]>>(() => {
    const bars = excitations.map((e) => ({ x: e.wavelength_nm, y: e.osc_strength }));
    const barColors = excitations.map((e) => (e.is_dark ? DARK_COLOR : BRIGHT_COLOR));
    const line =
      spectrum && spectrum.wavelengths.length
        ? spectrum.wavelengths.map((w, i) => ({ x: w, y: spectrum.intensities[i] ?? 0 }))
        : [];
    return {
      datasets: [
        {
          type: "bar" as const,
          label: t("f5.abs.legend.osc"),
          data: bars,
          backgroundColor: barColors,
          yAxisID: "yf",
          barThickness: 4,
          order: 2,
        },
        {
          type: "line" as const,
          label: t("f5.abs.legend.spectrum"),
          data: line,
          borderColor: "#b04a44",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.4,
          fill: false,
          yAxisID: "yb",
          order: 1,
        },
      ],
    };
  }, [excitations, spectrum, t]);

  const options = useMemo<ChartOptions<"bar" | "line">>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: CHART.tick, font: { family: CHART.tickFont, size: 11 }, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: CHART.tooltipBg,
          titleFont: { family: CHART.tickFont },
          bodyFont: { family: CHART.tickFont },
          callbacks: {
            title: (items) => `${Number(items[0]?.parsed.x).toFixed(0)} nm`,
            label: (item) =>
              item.dataset.yAxisID === "yf"
                ? `f = ${Number(item.parsed.y).toFixed(4)}`
                : `I = ${Number(item.parsed.y).toFixed(3)}`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: 300,
          max: 950,
          title: {
            display: true,
            text: t("f5.abs.axis.wavelength"),
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 11 },
          },
          grid: { color: CHART.grid },
          ticks: { color: CHART.tick, font: { family: CHART.tickFont, size: 10 } },
        },
        yf: {
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: t("f5.abs.axis.osc"),
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 11 },
          },
          grid: { color: CHART.grid },
          ticks: { color: CHART.tick, font: { family: CHART.tickFont, size: 10 } },
        },
        yb: {
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: t("f5.abs.axis.intensity"),
            color: CHART.tick,
            font: { family: CHART.tickFont, size: 11 },
          },
          grid: { display: false },
          ticks: { color: CHART.tick, font: { family: CHART.tickFont, size: 10 } },
        },
      },
    }),
    [t],
  );

  // 들뜸 상태 테이블
  const rows = useMemo<ExRow[]>(
    () =>
      excitations.map((e) => ({
        state: e.state,
        energy: e.energy_ev.toFixed(3),
        wavelength: e.wavelength_nm.toFixed(1),
        osc: e.osc_strength.toFixed(4),
        region: e.region,
        klass: e.is_dark ? t("f5.abs.class.dark") : t("f5.abs.class.bright"),
        is_dark: e.is_dark,
      })),
    [excitations, t],
  );

  const columns: Column<ExRow>[] = [
    { key: "state", header: t("f5.abs.table.state"), align: "right", mono: true },
    { key: "energy", header: t("f5.abs.table.energy"), align: "right", mono: true },
    { key: "wavelength", header: t("f5.abs.table.wavelength"), align: "right", mono: true },
    { key: "osc", header: t("f5.abs.table.osc"), align: "right", mono: true },
    { key: "region", header: t("f5.abs.table.region") },
    {
      key: "klass",
      header: t("f5.abs.table.class"),
      render: (r) =>
        r.is_dark ? (
          <span className="text-ink-faint">{r.klass}</span>
        ) : (
          <Badge variant="indigo">{r.klass}</Badge>
        ),
    },
  ];

  // 주요 흡수 피크: f>0.01 를 osc_strength 내림차순
  const peaks = useMemo<ExRow[]>(
    () =>
      [...excitations]
        .filter((e) => e.osc_strength > 0.01)
        .sort((a, b) => b.osc_strength - a.osc_strength)
        .map((e) => ({
          state: e.state,
          energy: e.energy_ev.toFixed(3),
          wavelength: e.wavelength_nm.toFixed(1),
          osc: e.osc_strength.toFixed(4),
          region: e.region,
          klass: t("f5.abs.class.bright"),
          is_dark: false,
        })),
    [excitations, t],
  );

  const peakColumns: Column<ExRow>[] = [
    { key: "state", header: t("f5.abs.table.state"), align: "right", mono: true },
    { key: "wavelength", header: t("f5.abs.table.wavelength"), align: "right", mono: true },
    { key: "energy", header: t("f5.abs.table.energy"), align: "right", mono: true },
    { key: "osc", header: t("f5.abs.table.osc"), align: "right", mono: true },
    { key: "region", header: t("f5.abs.table.region") },
  ];

  return (
    <Card>
      <CardHead
        icon={<Waves size={18} strokeWidth={1.8} />}
        title={t("f5.abs.title")}
        sub={`${excitations.length} states`}
      />
      <p className="text-sm text-ink-faint mb-s3">{t("f5.abs.hint")}</p>

      {/* 스펙트럼 콤보 차트 */}
      <div style={{ height: 320 }} className="relative w-full mb-s4">
        <Chart type="bar" data={data} options={options} />
      </div>

      {/* 들뜸 상태 테이블 */}
      <div className="text-meta uppercase tracking-[0.08em] text-ink-faint mb-s2">
        {t("f5.abs.table.title")}
      </div>
      <div className="overflow-x-auto">
        <DataTable variant="report" columns={columns} rows={rows} />
      </div>

      {/* 주요 흡수 피크 */}
      <div className="text-meta uppercase tracking-[0.08em] text-ink-faint mt-s4 mb-s2">
        {t("f5.abs.peaks.title")}
      </div>
      {peaks.length > 0 ? (
        <div className="overflow-x-auto">
          <DataTable variant="report" columns={peakColumns} rows={peaks} />
        </div>
      ) : (
        <p className="text-sm text-ink-faint">{t("f5.abs.peaks.none")}</p>
      )}
    </Card>
  );
}
