"use client";
// components/ui/card.tsx — Lab Paper Card (design-system §3.2)
import React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "accent" | "aiplan";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const variants: Record<CardVariant, string> = {
  // card 배경 + 1px hairline + radius-lg(12px) + padding s6 + shadow-card
  default: "bg-card border border-hairline rounded-lg p-s6 shadow-card",
  // accent-edge 보더 + accent-wash 배경 (progress-card, run-mirror)
  accent: "bg-accent-wash border border-accent-edge rounded-lg p-s6",
  // 1.5px accent 보더 + 그라데이션 + shadow-ai-plan
  aiplan:
    "border-[1.5px] border-accent rounded-lg p-s6 shadow-ai-plan bg-[linear-gradient(180deg,var(--accent-wash),#f4f4fb)]",
};

export function Card({ variant = "default", className, ...props }: CardProps) {
  return <div className={cn(variants[variant], className)} {...props} />;
}

export interface CardHeadProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Lucide 아이콘 노드 (accent 색) */
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** 우측 mono 메타 */
  sub?: React.ReactNode;
}

export function CardHead({ icon, title, sub, className, ...props }: CardHeadProps) {
  return (
    <div
      className={cn("flex items-center gap-s2 min-h-[28px] mb-s4", className)}
      {...props}
    >
      {icon ? <span className="text-accent inline-flex shrink-0">{icon}</span> : null}
      <h2 className="font-serif text-title font-medium text-ink leading-none">{title}</h2>
      {sub ? (
        <span className="ml-auto mono text-meta text-ink-faint">{sub}</span>
      ) : null}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-ink-soft", className)} {...props} />;
}
