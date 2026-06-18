"use client";
// features/f6-benchmark/components/LevelGrid.tsx — 12-레벨 상태 그리드 + 진행률
import { LayoutGrid } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  type BenchmarkLevelReport,
  LEVEL_TO_PROPERTY,
  TOTAL_LEVELS,
} from "../types";
import { statusStyle, isLive } from "../status-style";

interface LevelGridProps {
  reports: BenchmarkLevelReport[];
  currentLevel: number;
  globalStatus: string;
}

/** 완료(SUCCESS/INCORRECT/FAILURE/Aborted)로 안착한 레벨 비율로 진행률 산출 */
function progressPct(reports: BenchmarkLevelReport[]): number {
  const considered = reports.filter((r) => r.status !== "Skipped");
  if (considered.length === 0) return 0;
  const done = considered.filter((r) =>
    ["SUCCESS", "INCORRECT", "FAILURE", "Aborted"].includes(r.status),
  ).length;
  return Math.round((done / considered.length) * 100);
}

export function LevelGrid({ reports, currentLevel, globalStatus }: LevelGridProps) {
  const { t } = useT();
  const pct = progressPct(reports);

  return (
    <Card>
      <CardHead
        icon={<LayoutGrid size={18} strokeWidth={1.8} />}
        title={t("bench.grid.title")}
        sub={
          <span className="mono">
            {pct}% · {t(`bench.global.${globalStatus}`)}
          </span>
        }
      />

      {/* 진행률 바 */}
      <div
        className="h-[6px] rounded-pill bg-inset overflow-hidden mb-s4"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-accent transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* 12-레벨 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-s2">
        {Array.from({ length: TOTAL_LEVELS }, (_, i) => {
          const lv = i + 1;
          const r = reports.find((x) => x.level === lv);
          const status = r?.status ?? "Pending";
          const style = statusStyle(status);
          const live = isLive(status);
          const isCurrent = currentLevel === lv;
          return (
            <div
              key={lv}
              className={cn(
                "rounded-md border px-s3 py-s2 flex flex-col gap-s1 transition-colors",
                style.chip,
                isCurrent && "ring-2 ring-accent ring-offset-1 ring-offset-card",
              )}
            >
              <div className="flex items-center gap-s2">
                <span className="relative inline-flex" style={{ width: 9, height: 9 }}>
                  <span
                    className="absolute inset-0 rounded-pill"
                    style={{ background: style.dot }}
                    aria-hidden="true"
                  />
                  {live ? (
                    <span
                      className="absolute inset-0 rounded-pill"
                      style={{
                        border: `1px solid ${style.dot}`,
                        animation: "ring 1.6s ease-out infinite",
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
                <span className="mono text-sm font-semibold">L{lv}</span>
                <span className="ml-auto text-meta uppercase tracking-[0.06em] font-semibold">
                  {t(`bench.st.${status}`)}
                </span>
              </div>
              <span className="mono text-meta opacity-80 truncate">
                {LEVEL_TO_PROPERTY[lv]}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
