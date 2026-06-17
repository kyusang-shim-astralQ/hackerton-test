// components/ui/card.tsx — Lab Paper Card (design-system §3.2)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "accent" | "aiplan";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const VARIANT: Record<CardVariant, string> = {
  default: "bg-card border border-hairline shadow-card",
  accent: "bg-accent-wash border border-accent-edge",
  aiplan:
    "border-[1.5px] border-accent bg-gradient-to-b from-accent-wash to-[#f4f4fb] shadow-ai-plan",
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg p-s6", VARIANT[variant], className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

/** .card-head: serif h2(17px) + Lucide 아이콘(accent) + 우측 mono 메타. min-height 28px 정렬(§4.5 b). */
export interface CardHeadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
}

export function CardHead({
  icon,
  title,
  sub,
  className,
  ...props
}: CardHeadProps) {
  return (
    <div
      className={cn(
        "mb-s4 flex min-h-[28px] items-center gap-s2",
        className
      )}
      {...props}
    >
      {icon && <span className="text-accent [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
      <h2 className="font-serif text-title font-medium text-ink">{title}</h2>
      {sub && (
        <span className="ml-auto font-mono text-meta uppercase tracking-[0.08em] text-ink-faint num">
          {sub}
        </span>
      )}
    </div>
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-base text-ink-soft", className)} {...props} />;
}
