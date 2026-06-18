"use client";
// features/f1-structure/components/structure-tabs.tsx — 다중-CIF 활성 구조 전환 (소유: f1)
// 구조가 2개 이상일 때만 노출. design-system §3.6 주석대로 active=accent 배경(Tabs 톤).
import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import type { AtomInfo } from "@/stores/types";
import { deriveFormula, isFailedStructure } from "../lib";

export interface StructureTabsProps {
  structures: AtomInfo[];
  activeIndex: number;
  onSelect: (i: number) => void;
  onRemove: (i: number) => void;
}

export function StructureTabs({ structures, activeIndex, onSelect, onRemove }: StructureTabsProps) {
  const { t } = useT();
  return (
    <div className="flex flex-col gap-s2">
      <div className="flex items-center gap-s2">
        <span className="text-label uppercase tracking-[0.10em] text-ink-faint">
          {t("f1.structures.title")}
        </span>
        <Badge variant="indigo">{t("f1.structures.count", { n: structures.length })}</Badge>
      </div>
      <div role="tablist" className="flex flex-wrap gap-s2">
        {structures.map((s, i) => {
          const failed = isFailedStructure(s);
          const active = i === activeIndex;
          return (
            <div
              key={`${s.filename}-${i}`}
              className={cn(
                "group inline-flex items-center gap-s2 rounded-md border px-s3 py-s1 text-sm transition-colors",
                active
                  ? "border-accent bg-accent text-white"
                  : "border-hairline-2 bg-card text-ink-soft hover:border-accent hover:bg-inset",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(i)}
                className="inline-flex items-center gap-s2"
              >
                <span className="mono text-meta opacity-80">{i + 1}</span>
                <span className="max-w-[160px] truncate">{deriveFormula(s)}</span>
                {failed ? (
                  <span
                    className={cn(
                      "inline-block h-[6px] w-[6px] rounded-pill",
                      active ? "bg-white/80" : "bg-oxblood",
                    )}
                    aria-label={t("f1.badge.failed")}
                  />
                ) : null}
              </button>
              <button
                type="button"
                aria-label={t("f1.remove")}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(i);
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-sm opacity-60 hover:opacity-100",
                  active ? "text-white" : "text-ink-faint",
                )}
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
