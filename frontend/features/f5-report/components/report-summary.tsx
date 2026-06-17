// features/f5-report/components/report-summary.tsx
// summary(단일/다중) → KPI 카드. 단일=final_energy/target_property, 다중=구조별 맵.
"use client";

import * as React from "react";
import { Atom, Gauge, Layers } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import type { ReportData } from "@/stores/types";

interface SingleSummary {
  final_energy?: string;
  target_property?: string;
}
interface MultiSummaryEntry {
  energy?: string;
  target_property?: string;
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-hairline bg-inset px-s4 py-s3">
      <div className="flex items-center gap-s1 text-meta font-semibold uppercase tracking-[0.08em] text-ink-faint">
        <span className="text-accent [&>svg]:h-[14px] [&>svg]:w-[14px]">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-s1 break-words font-mono num text-base text-ink">
        {value}
      </div>
    </div>
  );
}

export function ReportSummary({ data }: { data: ReportData }) {
  const { t } = useT();
  const summary = (data.summary ?? {}) as Record<string, unknown>;

  // 다중: summary 가 {파일명: {energy,target_property}} 맵 (is_multi 또는 중첩 객체 감지).
  if (data.is_multi) {
    const entries = Object.entries(summary) as [string, MultiSummaryEntry][];
    return (
      <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map(([fname, v]) => (
          <div
            key={fname}
            className="rounded-md border border-hairline bg-inset px-s4 py-s3"
          >
            <div className="flex items-center gap-s1 text-meta font-semibold uppercase tracking-[0.08em] text-ink-faint">
              <span className="text-accent [&>svg]:h-[14px] [&>svg]:w-[14px]">
                <Layers />
              </span>
              {fname}
            </div>
            <div className="mt-s1 font-mono num text-base text-ink">
              {v?.energy ?? "N/A"}
            </div>
            <div className="mt-s1 font-mono num text-sm text-ink-soft">
              {v?.target_property ?? "N/A"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const s = summary as SingleSummary;
  return (
    <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2">
      <KpiCard
        icon={<Atom />}
        label={t("f5.kpi.finalEnergy")}
        value={s.final_energy ?? "N/A"}
      />
      <KpiCard
        icon={<Gauge />}
        label={t("f5.kpi.targetProperty")}
        value={s.target_property ?? "N/A"}
      />
    </div>
  );
}
