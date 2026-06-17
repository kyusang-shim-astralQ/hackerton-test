// components/ui/table.tsx — MetaList + DataTable (design-system §3.8)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** MetaList: k/v 행, 하단 1px hairline-soft 구분, v 는 mono + tabular-nums. */
export interface MetaListItem {
  k: React.ReactNode;
  v: React.ReactNode;
}
export interface MetaListProps extends React.HTMLAttributes<HTMLDListElement> {
  items: MetaListItem[];
}

export function MetaList({ items, className, ...props }: MetaListProps) {
  return (
    <dl className={cn("text-base", className)} {...props}>
      {items.map((it, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between gap-s4 py-s2",
            i < items.length - 1 && "border-b border-hairline-soft"
          )}
        >
          <dt className="text-ink-faint">{it.k}</dt>
          <dd className="font-mono num text-ink">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** DataTable: report/benchmark 변형 베이스. */
export interface DataColumn<T> {
  key: keyof T;
  header: string;
  align?: "left" | "right" | "center";
  mono?: boolean;
  render?: (row: T) => React.ReactNode;
}
export interface DataTableProps<T extends Record<string, unknown>> {
  columns: DataColumn<T>[];
  rows: T[];
  variant?: "report" | "benchmark";
  rowKey?: (row: T, i: number) => string | number;
  className?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  variant = "report",
  rowKey,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <table
        className={cn(
          "w-full text-base",
          variant === "benchmark" && "border-separate border-spacing-y-[6px]"
        )}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={cn(
                  "px-s3 py-s2 text-label font-semibold uppercase tracking-[0.06em] text-ink-faint",
                  c.align === "right"
                    ? "text-right"
                    : c.align === "center"
                      ? "text-center"
                      : "text-left"
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey ? rowKey(row, i) : i}
              className={cn(
                variant === "report" &&
                  "border-b border-hairline-soft hover:bg-inset"
              )}
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={cn(
                    "px-s3 py-s2 text-ink",
                    c.mono && "font-mono num",
                    c.align === "right"
                      ? "text-right"
                      : c.align === "center"
                        ? "text-center"
                        : "text-left"
                  )}
                >
                  {c.render ? c.render(row) : String(row[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
