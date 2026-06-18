"use client";
// components/ui/table.tsx — DataTable (design-system §3.8)
import React from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: keyof T;
  header: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  variant?: "report" | "benchmark";
  columns: Column<T>[];
  rows: T[];
  rowStatus?: (row: T) => "converged" | "done" | "stopped" | undefined;
  className?: string;
}

const statusRowClass: Record<string, string> = {
  converged: "text-ok",
  done: "text-ok",
  stopped: "text-oxblood",
};

export function DataTable<T extends Record<string, unknown>>({
  variant = "report",
  columns,
  rows,
  rowStatus,
  className,
}: DataTableProps<T>) {
  const benchmark = variant === "benchmark";
  return (
    <table
      className={cn(
        "w-full text-sm",
        benchmark ? "border-separate border-spacing-y-s1" : "border-collapse",
        className,
      )}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={String(c.key)}
              className={cn(
                "text-meta uppercase tracking-[0.06em] text-ink-faint font-semibold py-s2 px-s3",
                c.align === "right" && "text-right",
                c.align === "center" && "text-center",
                !c.align && "text-left",
              )}
            >
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => {
          const st = rowStatus?.(row);
          return (
            <tr
              key={ri}
              className={cn(
                benchmark
                  ? "bg-card [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md"
                  : "border-b border-hairline-soft hover:bg-inset",
                st && statusRowClass[st],
              )}
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={cn(
                    "py-s2 px-s3",
                    c.mono && "mono",
                    c.align === "right" && "text-right",
                    c.align === "center" && "text-center",
                  )}
                >
                  {c.render ? c.render(row) : (row[c.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
