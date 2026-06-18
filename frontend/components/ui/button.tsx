"use client";
// components/ui/button.tsx — Lab Paper Button (design-system §3.1)
import React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "primary" | "danger" | "ghost" | "icon";
type Size = "default" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-s2 rounded-md text-base font-medium transition-[background,border-color,transform] duration-150 active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0 select-none";

const variants: Record<Variant, string> = {
  // card 배경 + hairline-2 보더, hover inset 배경 + ink-faint 보더
  default:
    "bg-card text-ink border border-hairline-2 hover:bg-inset hover:border-ink-faint",
  // accent 배경 + 흰 글자, hover accent-ink
  primary: "bg-accent text-white border border-accent hover:bg-accent-ink hover:border-accent-ink",
  // card 배경 + oxblood 보더/글자, hover oxblood-wash (STOP 전용)
  danger:
    "bg-card text-oxblood border border-oxblood hover:bg-oxblood-wash",
  // 투명, hover inset
  ghost: "bg-transparent text-ink border border-transparent hover:bg-inset",
  // 34×34 정사각 아이콘만
  icon: "bg-card text-ink border border-hairline-2 hover:bg-inset hover:border-ink-faint p-0",
};

const sizes: Record<Size, string> = {
  default: "h-[34px] px-s4",
  lg: "h-[42px] px-[14px] font-semibold", // 주 액션 = AI 플랜 생성
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "default", loading, className, children, disabled, ...props },
  ref,
) {
  const isIcon = variant === "icon";
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], isIcon ? "h-[34px] w-[34px]" : sizes[size], className)}
      {...props}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="animate-spin"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.4" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
