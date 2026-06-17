// components/ui/segmented.tsx — Lab Paper Segmented (배타 선택, design-system §3.6)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedItem {
  value: string;
  label: string;
}

export interface SegmentedProps {
  value: string;
  onValueChange: (v: string) => void;
  items: SegmentedItem[];
  className?: string;
  "aria-label"?: string;
}

export function Segmented({
  value,
  onValueChange,
  items,
  className,
  ...props
}: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label={props["aria-label"]}
      className={cn(
        "inline-flex rounded-md border border-hairline-2 bg-card p-[2px]",
        className
      )}
    >
      {items.map((item) => {
        const on = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "rounded-[6px] px-s3 py-[5px] text-sm font-medium transition-colors duration-150",
              on
                ? "bg-accent text-white"
                : "text-ink-soft hover:bg-inset"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
