"use client";
// components/ui/form-field.tsx — FormField + Control (design-system §3.7)
import React from "react";
import { cn } from "@/lib/utils";

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  mono?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

// .field: margin-bottom s4 세로 스택. label: 11px/600/uppercase/letter-spacing .06em/ink-faint
export function FormField({ label, htmlFor, className, children }: FormFieldProps) {
  return (
    <div className={cn("mb-s4 flex flex-col gap-s2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-label font-semibold uppercase tracking-[0.06em] text-ink-faint"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// 공통 control 스타일 (input/select)
const controlBase =
  "w-full h-[38px] px-s3 rounded-md border border-hairline-2 bg-card text-base text-ink transition-[border-color,box-shadow] " +
  "hover:border-ink-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-wash)] focus:outline-none " +
  "disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-ink-faint";

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  mono?: boolean;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { mono, className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(controlBase, mono && "font-mono tabular-nums", className)}
      {...props}
    />
  );
});

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  mono?: boolean;
}

// 커스텀 chevron (data-uri SVG, stroke #6f6d66) + padding-right 34px
const chevron =
  "appearance-none pr-[34px] bg-no-repeat bg-[right_12px_center] " +
  "bg-[url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236f6d66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")]";

export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { mono, className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(controlBase, chevron, mono && "font-mono tabular-nums", className)}
      {...props}
    >
      {children}
    </select>
  );
});
