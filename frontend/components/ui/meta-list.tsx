"use client";
// components/ui/meta-list.tsx — k/v 메타 리스트 (design-system §3.8)
import React from "react";
import { cn } from "@/lib/utils";

export interface MetaListProps {
  items: { k: React.ReactNode; v: React.ReactNode }[];
  className?: string;
}

// k/v 행, 하단 1px hairline-soft 구분, v는 mono + tabular-nums
export function MetaList({ items, className }: MetaListProps) {
  return (
    <dl className={cn("flex flex-col", className)}>
      {items.map((it, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-s4 py-s2 border-b border-hairline-soft last:border-b-0"
        >
          <dt className="text-sm text-ink-faint">{it.k}</dt>
          <dd className="mono text-sm text-ink text-right">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}
