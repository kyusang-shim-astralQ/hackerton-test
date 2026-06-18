"use client";
// features/f4-jobs/components/TabBar.tsx — Lab Paper 톤 탭(서브잡/스텝 전환). active=accent 배경.
// design-system §3.6 말미(다중-CIF/파일 전환 탭은 Tabs를 Lab Paper 톤으로) 준수.
import React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
}

export interface TabBarProps {
  items: TabItem[];
  value: string;
  onValueChange: (v: string) => void;
  ariaLabel?: string;
}

export function TabBar({ items, value, onValueChange, ariaLabel }: TabBarProps) {
  if (items.length <= 1) return null;
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-s1">
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "inline-flex items-center gap-s1 rounded-md px-s3 h-[30px] text-sm transition-colors border",
              active
                ? "bg-accent text-white border-accent"
                : "bg-card text-ink-soft border-hairline-2 hover:bg-inset hover:border-ink-faint",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
