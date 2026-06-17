// components/ui/chip-toggle.tsx — Lab Paper ChipToggle (다중 선택, design-system §3.6)
"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipToggleProps {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ChipToggle({
  checked = false,
  onChange,
  disabled,
  className,
  children,
}: ChipToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex items-center gap-s1 rounded-md border px-s3 py-[6px] text-sm font-medium",
        "transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed",
        checked
          ? "border-accent bg-accent-wash text-accent-ink"
          : "border-hairline-2 bg-card text-ink-soft hover:bg-inset",
        className
      )}
    >
      {checked && <Check className="h-[14px] w-[14px]" />}
      {children}
    </button>
  );
}
