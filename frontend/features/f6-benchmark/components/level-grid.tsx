// features/f6-benchmark/components/level-grid.tsx
// 12-레벨 상태 그리드 — 레벨별 status 색 구분(Pending/Running/Recovering/SUCCESS/INCORRECT/FAILURE/Skipped/Aborted).
"use client";

import * as React from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { BenchmarkLevelReport } from "@/stores/types";
import { ALL_LEVELS, LEVEL_TO_PROPERTY } from "../api";
import {
  STATUS_CHIP,
  isActiveStatus,
  normalizeStatus,
  propertyKeyOf,
} from "../lib";

export interface LevelGridProps {
  reports: BenchmarkLevelReport[];
  currentLevel?: number;
}

export function LevelGrid({ reports, currentLevel }: LevelGridProps) {
  const { t } = useT();

  // level → report 빠른 조회(항상 12 슬롯이지만 방어적으로 매핑).
  const byLevel = React.useMemo(() => {
    const m = new Map<number, BenchmarkLevelReport>();
    for (const r of reports) m.set(r.level, r);
    return m;
  }, [reports]);

  return (
    <Card>
      <CardHead
        icon={<LayoutGrid />}
        title={t("f6.grid.title")}
        sub={<Badge variant="neutral">1–12</Badge>}
      />
      <CardContent>
        <div className="grid grid-cols-2 gap-s2 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_LEVELS.map((level) => {
            const r = byLevel.get(level);
            const key = normalizeStatus(r?.status);
            const active = isActiveStatus(key);
            const isCurrent = currentLevel === level && active;
            return (
              <div
                key={level}
                className={cn(
                  "flex flex-col gap-s1 rounded-md border px-s3 py-s2 transition-colors",
                  STATUS_CHIP[key],
                  isCurrent && "ring-1 ring-accent"
                )}
              >
                <div className="flex items-center justify-between gap-s2">
                  <span className="font-mono num text-sm font-semibold">
                    L{level}
                  </span>
                  {active ? (
                    <Loader2 className="h-[13px] w-[13px] animate-spin" />
                  ) : (
                    <span className="text-meta font-semibold uppercase tracking-[0.04em]">
                      {t(`f6.status.${key}`)}
                    </span>
                  )}
                </div>
                <span className="truncate text-meta opacity-80">
                  {t(propertyKeyOf(level, r?.property ?? LEVEL_TO_PROPERTY[level]))}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
