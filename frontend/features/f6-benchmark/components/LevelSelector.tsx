"use client";
// features/f6-benchmark/components/LevelSelector.tsx — 레벨 다중선택 + 가동/중지 컨트롤
import { Square, ListChecks, Play, Square as StopSquare } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChipToggle } from "@/components/ui/chip-toggle";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { LEVEL_TO_PROPERTY, TOTAL_LEVELS } from "../types";

interface LevelSelectorProps {
  selected: Set<number>;
  onToggle: (level: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  running: boolean;
  starting: boolean;
  onRun: () => void;
  onStop: () => void;
  /** 가동 중에는 선택 변경 잠금 */
  locked: boolean;
}

export function LevelSelector({
  selected,
  onToggle,
  onSelectAll,
  onClear,
  running,
  starting,
  onRun,
  onStop,
  locked,
}: LevelSelectorProps) {
  const { t } = useT();
  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

  return (
    <Card>
      <CardHead
        icon={<ListChecks size={18} strokeWidth={1.8} />}
        title={t("bench.levels.title")}
        sub={
          <span className="mono">{t("bench.levels.selected", { n: selected.size })}</span>
        }
      />
      <CardContent>
        <p className="text-sm text-ink-faint mb-s3">{t("bench.levels.sub")}</p>

        <div className="flex flex-wrap gap-s2 mb-s4">
          {levels.map((lv) => (
            <ChipToggle
              key={lv}
              checked={selected.has(lv)}
              disabled={locked}
              onChange={() => onToggle(lv)}
            >
              <span className="mono font-semibold">L{lv}</span>
              <span className="text-ink-faint ml-s1">{LEVEL_TO_PROPERTY[lv]}</span>
            </ChipToggle>
          ))}
        </div>

        <div className="flex items-center gap-s2 flex-wrap">
          <Button
            variant="default"
            onClick={onSelectAll}
            disabled={locked}
            className="text-sm"
          >
            <ListChecks size={14} strokeWidth={1.8} />
            {t("bench.levels.all")}
          </Button>
          <Button
            variant="ghost"
            onClick={onClear}
            disabled={locked}
            className="text-sm"
          >
            <Square size={14} strokeWidth={1.8} />
            {t("bench.levels.none")}
          </Button>

          <span className="ml-auto" />

          {running ? (
            // 가동 중 — 같은 자리에 중지 버튼(oxblood 톤)
            <Button variant="danger" size="lg" onClick={onStop}>
              <StopSquare size={16} strokeWidth={2} fill="currentColor" />
              {t("bench.stop")}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={onRun}
              loading={starting}
              disabled={selected.size === 0}
              className={cn(selected.size === 0 && "opacity-50")}
            >
              {!starting && <Play size={16} strokeWidth={2} fill="currentColor" />}
              {starting ? t("bench.starting") : t("bench.run")}
            </Button>
          )}
        </div>

        {selected.size === 0 && !running ? (
          <p className="mt-s3 text-sm text-oxblood">{t("bench.empty.levels")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
