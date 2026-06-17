// components/ui/form-field.tsx — Lab Paper FormField + Control (design-system §3.7)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** .control 공통 스타일 (input/select 가 공유). 수치 입력은 mono. */
const CONTROL =
  "w-full h-[38px] rounded-md border border-hairline-2 bg-card px-s3 text-base text-ink " +
  "transition-[border-color,box-shadow] duration-150 " +
  "hover:border-ink-faint " +
  "focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-wash)] focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}

/** .field: 11px uppercase ink-faint label + control. */
export function FormField({
  label,
  htmlFor,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("mb-s4", className)}>
      <label
        htmlFor={htmlFor}
        className="mb-s1 block text-label font-semibold uppercase tracking-[0.06em] text-ink-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, mono, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(CONTROL, mono && "font-mono num", className)}
      {...props}
    />
  )
);
TextInput.displayName = "TextInput";

const CHEVRON =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#6f6d66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>`
  );

export interface SelectInputProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  mono?: boolean;
}

export const SelectInput = React.forwardRef<
  HTMLSelectElement,
  SelectInputProps
>(({ className, mono, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      CONTROL,
      "appearance-none bg-no-repeat pr-[34px]",
      mono && "font-mono num",
      className
    )}
    style={{
      backgroundImage: `url("${CHEVRON}")`,
      backgroundPosition: "right 12px center",
    }}
    {...props}
  >
    {children}
  </select>
));
SelectInput.displayName = "SelectInput";

/** 2열 폼 묶음 (1fr 1fr, gap s4). */
export function Grid2({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-s4 sm:grid-cols-2", className)}
      {...props}
    />
  );
}
