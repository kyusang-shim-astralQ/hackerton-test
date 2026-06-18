"use client";
// components/ui/segmented.tsx — 배타 선택 (design-system §3.6)
import { cn } from "@/lib/utils";

export interface SegmentedProps {
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: string }[];
  className?: string;
  "aria-label"?: string;
}

export function Segmented({ value, onValueChange, items, className, ...rest }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex items-center gap-px rounded-md border border-hairline-2 bg-card p-px",
        className,
      )}
    >
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "h-[30px] px-s3 rounded-[6px] text-sm font-medium transition-colors",
              on ? "bg-accent text-white" : "text-ink-soft hover:bg-inset",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
