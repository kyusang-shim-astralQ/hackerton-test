"use client";
// components/ui/badge.tsx — Lab Paper Badge (design-system §3.3)
import React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "indigo" | "green" | "oxblood";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const base =
  "inline-flex items-center gap-s1 px-s2 py-s1 rounded-pill text-meta font-semibold leading-none border";

const variants: Record<BadgeVariant, string> = {
  // accent-wash 배경 + accent-ink 글자 + accent-edge 보더 (단계 수/태그)
  indigo: "bg-accent-wash text-accent-ink border-accent-edge",
  // ok-wash 배경 + ok 글자 + 보더 (ON/완료/유효)
  green: "bg-ok-wash text-ok border-[#c2d4bf]",
  // 절제된 위험/실패 (남용 금지)
  oxblood: "bg-oxblood-wash text-oxblood border-[#e0c4c0]",
};

export function Badge({ variant = "indigo", className, ...props }: BadgeProps) {
  return <span className={cn(base, variants[variant], "tracking-[0.04em]", className)} {...props} />;
}
