"use client";
// components/ui/chip-toggle.tsx — 다중 선택 토글 칩 (design-system §3.6)
import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChipToggleProps {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function ChipToggle({ checked = false, onChange, disabled, className, children }: ChipToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex items-center gap-s2 h-[34px] px-s3 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        checked
          ? "bg-accent-wash border-accent text-accent-ink"
          : "bg-card border-hairline-2 text-ink-soft hover:border-ink-faint",
        className,
      )}
    >
      {checked ? <Check size={14} strokeWidth={2.2} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
