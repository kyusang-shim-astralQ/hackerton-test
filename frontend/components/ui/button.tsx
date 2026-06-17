// components/ui/button.tsx — Lab Paper Button (design-system §3.1)
"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "primary" | "danger" | "ghost" | "icon";
type ButtonSize = "default" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  // card 배경 + hairline-2 보더, hover inset 배경 + ink-faint 보더
  default:
    "bg-card text-ink border border-hairline-2 hover:bg-inset hover:border-ink-faint",
  // accent 배경 + 흰 글자, hover accent-ink
  primary:
    "bg-accent text-white border border-accent hover:bg-accent-ink hover:border-accent-ink",
  // card 배경 + oxblood 보더/글자, hover oxblood-wash (STOP 전용)
  danger:
    "bg-card text-oxblood border border-oxblood/60 hover:bg-oxblood-wash",
  // 투명, hover inset
  ghost: "bg-transparent text-ink border border-transparent hover:bg-inset",
  // 34×34 정사각, 아이콘만
  icon: "bg-card text-ink border border-hairline-2 hover:bg-inset hover:border-ink-faint",
};

const SIZE: Record<ButtonSize, string> = {
  default: "h-[34px] px-s4 text-base",
  lg: "h-[42px] px-[14px] text-base font-semibold",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      loading = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isIcon = variant === "icon";
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-s2 rounded-md font-medium",
          "transition-[background,border-color,transform] duration-150 ease-smooth",
          "active:translate-y-px disabled:opacity-40 disabled:cursor-not-allowed disabled:active:translate-y-0",
          isIcon ? "h-[34px] w-[34px] p-0" : SIZE[size],
          VARIANT[variant],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
