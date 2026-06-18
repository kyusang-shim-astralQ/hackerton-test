"use client";
// features/f6-benchmark/components/ResultTable.tsx — 레벨별 정확도 테이블
// 레벨·물성명·Agent vs 공식 값·오차%·치유횟수·메시지. 모든 수치 mono + tabular-nums.
import { Table2, HeartPulse } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { type BenchmarkLevelReport, LEVEL_TO_PROPERTY } from "../types";
import { statusStyle } from "../status-style";

interface ResultTableProps {
  reports: BenchmarkLevelReport[];
}

/** message 의 `[Energy (Ha)]` / `[Frequency (cm^-1)]` / `[Excitation (eV)]` 라벨 추출 */
function valueLabel(message: string | undefined): string | null {
  if (!message) return null;
  const m = message.match(/\[([^\]]+)\]/);
  return m ? m[1] : null;
}

function fmtNum(v: number | null): string {
  if (v === null || v === undefined) return "—";
  // 큰 에너지는 4자리, 작은 값은 적절히
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(4);
  if (abs >= 1) return v.toFixed(4);
  return v.toExponential(3);
}

function fmtDiff(v: number | null): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(4)}%`;
}

export function ResultTable({ reports }: ResultTableProps) {
  const { t } = useT();

  return (
    <Card>
      <CardHead
        icon={<Table2 size={18} strokeWidth={1.8} />}
        title={t("bench.table.title")}
      />
      <div className="overflow-x-auto -mx-s2">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-meta uppercase tracking-[0.06em] text-ink-faint">
              <th className="text-left font-semibold px-s2 py-s2">{t("bench.col.level")}</th>
              <th className="text-left font-semibold px-s2 py-s2">{t("bench.col.property")}</th>
              <th className="text-right font-semibold px-s2 py-s2">{t("bench.col.agent")}</th>
              <th className="text-right font-semibold px-s2 py-s2">{t("bench.col.official")}</th>
              <th className="text-right font-semibold px-s2 py-s2">{t("bench.col.diff")}</th>
              <th className="text-center font-semibold px-s2 py-s2">{t("bench.col.healing")}</th>
              <th className="text-left font-semibold px-s2 py-s2">{t("bench.col.status")}</th>
              <th className="text-left font-semibold px-s2 py-s2">{t("bench.col.message")}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const style = statusStyle(r.status);
              const label = valueLabel(r.message);
              const healing = r.healing_count ?? 0;
              const lowError = r.diff !== null && r.diff < 1.0;
              return (
                <tr
                  key={r.level}
                  className="border-t border-hairline-soft align-top hover:bg-inset/60 transition-colors"
                >
                  <td className="mono font-semibold px-s2 py-s2 text-ink">L{r.level}</td>
                  <td className="px-s2 py-s2 text-ink-soft">
                    {LEVEL_TO_PROPERTY[r.level]}
                    {label ? (
                      <span className="block mono text-meta text-ink-faint">{label}</span>
                    ) : null}
                  </td>
                  <td className="mono text-right px-s2 py-s2 text-ink">{fmtNum(r.agent_energy)}</td>
                  <td className="mono text-right px-s2 py-s2 text-ink-soft">
                    {fmtNum(r.official_energy)}
                  </td>
                  <td
                    className={cn(
                      "mono text-right px-s2 py-s2 font-semibold",
                      r.diff === null ? "text-ink-faint" : lowError ? "text-ok" : "text-oxblood",
                    )}
                  >
                    {fmtDiff(r.diff)}
                  </td>
                  <td className="text-center px-s2 py-s2">
                    {healing > 0 ? (
                      <Badge variant="oxblood" className="inline-flex">
                        <HeartPulse size={11} strokeWidth={2} />
                        {t("bench.healed", { n: healing })}
                      </Badge>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-s2 py-s2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-s1 rounded-pill border px-s2 py-s1 text-meta font-semibold uppercase tracking-[0.04em]",
                        style.chip,
                      )}
                    >
                      <span
                        className="rounded-pill"
                        style={{ width: 7, height: 7, background: style.dot }}
                        aria-hidden="true"
                      />
                      {t(`bench.st.${r.status}`)}
                    </span>
                  </td>
                  <td className="px-s2 py-s2 text-ink-soft max-w-[28ch]">
                    <span className="block truncate" title={r.message}>
                      {r.message}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
