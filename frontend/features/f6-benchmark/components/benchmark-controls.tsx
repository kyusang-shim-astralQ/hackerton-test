// features/f6-benchmark/components/benchmark-controls.tsx
// 레벨 다중선택(기본 1~12 전체) + 가동/중지 토글. 가동 중엔 같은 자리에 [■ 중지](oxblood).
"use client";

import * as React from "react";
import { FlaskConical, Play, Square } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChipToggle } from "@/components/ui/chip-toggle";
import { useT } from "@/lib/i18n/use-t";
import { ALL_LEVELS, LEVEL_TO_PROPERTY } from "../api";
import { propertyKeyOf } from "../lib";

export interface BenchmarkControlsProps {
  selected: number[];
  onToggleLevel: (level: number) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  running: boolean;
  busy: boolean; // run/stop 요청 in-flight
  onRun: () => void;
  onStop: () => void;
}

export function BenchmarkControls({
  selected,
  onToggleLevel,
  onSelectAll,
  onSelectNone,
  running,
  busy,
  onRun,
  onStop,
}: BenchmarkControlsProps) {
  const { t } = useT();
  const selectedSet = React.useMemo(() => new Set(selected), [selected]);

  return (
    <Card>
      <CardHead
        icon={<FlaskConical />}
        title={t("f6.select.title")}
        sub={<Badge variant="neutral">{t("f6.select.count", { n: selected.length })}</Badge>}
      />
      <CardContent>
        <p className="mb-s3 text-sm text-ink-faint">{t("f6.select.hint")}</p>

        {/* 12-레벨 체크 그리드 */}
        <div className="grid grid-cols-2 gap-s2 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_LEVELS.map((level) => (
            <ChipToggle
              key={level}
              checked={selectedSet.has(level)}
              onChange={() => onToggleLevel(level)}
              disabled={running}
              className="w-full justify-start"
            >
              <span className="font-mono num shrink-0">L{level}</span>
              <span className="ml-s1 min-w-0 truncate">
                {t(propertyKeyOf(level, LEVEL_TO_PROPERTY[level]))}
              </span>
            </ChipToggle>
          ))}
        </div>

        {/* 전체 선택/해제 + 가동/중지 */}
        <div className="mt-s4 flex flex-wrap items-center gap-s2">
          <Button
            variant="ghost"
            onClick={onSelectAll}
            disabled={running}
          >
            {t("f6.select.all")}
          </Button>
          <Button
            variant="ghost"
            onClick={onSelectNone}
            disabled={running}
          >
            {t("f6.select.none")}
          </Button>

          <div className="ml-auto">
            {running ? (
              <Button
                variant="danger"
                size="lg"
                loading={busy}
                onClick={onStop}
              >
                {!busy && <Square className="h-[15px] w-[15px]" fill="currentColor" />}
                {t("f6.stop")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                loading={busy}
                disabled={selected.length === 0}
                onClick={onRun}
              >
                {!busy && <Play className="h-[15px] w-[15px]" />}
                {t("f6.run")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
