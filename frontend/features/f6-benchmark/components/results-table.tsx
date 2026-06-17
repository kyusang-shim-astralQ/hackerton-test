// features/f6-benchmark/components/results-table.tsx
// 정확도 결과 테이블: 레벨·물성·Agent vs 공식·오차%·치유 횟수(Healed Nx 배지)·메시지.
"use client";

import * as React from "react";
import { Table2, ShieldCheck } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { BenchmarkLevelReport } from "@/stores/types";
import { LEVEL_TO_PROPERTY } from "../api";
import {
  STATUS_CHIP,
  fmtDiff,
  fmtValue,
  isLowError,
  normalizeStatus,
  propertyKeyOf,
} from "../lib";

export interface ResultsTableProps {
  reports: BenchmarkLevelReport[];
}

export function ResultsTable({ reports }: ResultsTableProps) {
  const { t } = useT();

  // 미착수(Pending) 전부면 빈 안내. 하나라도 진척이 있으면 전체 12행 표시.
  const hasAny = reports.some(
    (r) => normalizeStatus(r.status) !== "Pending"
  );

  return (
    <Card>
      <CardHead icon={<Table2 />} title={t("f6.table.title")} />
      <CardContent>
        {!hasAny ? (
          <p className="py-s4 text-center text-ink-faint">{t("f6.table.empty")}</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-hairline">
                  {[
                    ["level", "left"],
                    ["property", "left"],
                    ["agent", "right"],
                    ["official", "right"],
                    ["diff", "right"],
                    ["healing", "center"],
                    ["message", "left"],
                  ].map(([k, align]) => (
                    <th
                      key={k}
                      className={cn(
                        "px-s3 py-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint",
                        align === "right"
                          ? "text-right"
                          : align === "center"
                            ? "text-center"
                            : "text-left"
                      )}
                    >
                      {t(`f6.table.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const key = normalizeStatus(r.status);
                  const healing = r.healing_count ?? 0;
                  const low = isLowError(r.diff);
                  return (
                    <tr
                      key={r.level}
                      className="border-b border-hairline-soft hover:bg-inset"
                    >
                      <td className="px-s3 py-s2">
                        <span className="font-mono num text-ink">L{r.level}</span>
                      </td>
                      <td className="px-s3 py-s2">
                        <span className="text-ink">
                          {t(propertyKeyOf(r.level, r.property ?? LEVEL_TO_PROPERTY[r.level]))}
                        </span>
                        <span
                          className={cn(
                            "ml-s2 inline-flex items-center rounded-pill border px-s2 py-px text-meta font-semibold",
                            STATUS_CHIP[key]
                          )}
                        >
                          {t(`f6.status.${key}`)}
                        </span>
                      </td>
                      <td className="px-s3 py-s2 text-right">
                        <span
                          className={cn(
                            "font-mono num",
                            key === "SUCCESS" ? "text-ok" : "text-ink"
                          )}
                        >
                          {fmtValue(r.agent_energy)}
                        </span>
                      </td>
                      <td className="px-s3 py-s2 text-right font-mono num text-ink-soft">
                        {fmtValue(r.official_energy)}
                      </td>
                      <td className="px-s3 py-s2 text-right">
                        <span
                          className={cn(
                            "font-mono num",
                            r.diff === undefined || r.diff === null || r.diff === ""
                              ? "text-ink-faint"
                              : low
                                ? "text-ok"
                                : "text-oxblood"
                          )}
                        >
                          {fmtDiff(r.diff)}
                        </span>
                      </td>
                      <td className="px-s3 py-s2 text-center">
                        {healing > 0 ? (
                          <Badge variant="indigo">
                            <ShieldCheck className="h-[12px] w-[12px]" />
                            {t("f6.healed", { n: healing })}
                          </Badge>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="max-w-[280px] px-s3 py-s2">
                        <span className="block truncate text-sm text-ink-soft" title={r.message}>
                          {r.message ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
