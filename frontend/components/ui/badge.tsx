// components/ui/badge.tsx — Lab Paper Badge (design-system §3.3)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "indigo" | "green" | "oxblood" | "neutral";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT: Record<BadgeVariant, string> = {
  indigo: "bg-accent-wash text-accent-ink border border-accent-edge",
  green: "bg-ok-wash text-ok border border-[#c2d4bf]",
  oxblood: "bg-oxblood-wash text-oxblood border border-oxblood/30",
  neutral: "bg-inset text-ink-faint border border-hairline-2",
};

export function Badge({ className, variant = "indigo", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-s1 rounded-pill px-s2 py-s1",
        "text-meta font-semibold tracking-[0.04em]",
        VARIANT[variant],
        className
      )}
      {...props}
    />
  );
}
