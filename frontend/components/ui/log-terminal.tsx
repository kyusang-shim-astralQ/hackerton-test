// components/ui/log-terminal.tsx — Lab Paper LogTerminal (다크 표면 예외, design-system §3.9)
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type LogTone = "default" | "ts" | "g" | "b" | "y";
export interface LogLine {
  id: string | number;
  html: React.ReactNode;
  tone?: LogTone;
  cursor?: boolean;
}

export interface LogTerminalProps {
  lines: LogLine[];
  autoScroll?: boolean;
  height?: number;
  maxLines?: number;
  header?: React.ReactNode;
  className?: string;
}

const TONE_CLASS: Record<LogTone, string> = {
  default: "text-[var(--term-ink)]",
  ts: "text-[var(--term-ts)]",
  g: "text-[var(--term-g)]",
  b: "text-[var(--term-b)]",
  y: "text-[var(--term-y)]",
};

export function LogTerminal({
  lines,
  autoScroll = true,
  height = 300,
  maxLines = 40,
  header,
  className,
}: LogTerminalProps) {
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const shown = React.useMemo(
    () => (lines.length > maxLines ? lines.slice(lines.length - maxLines) : lines),
    [lines, maxLines]
  );

  React.useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [shown, autoScroll]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-[var(--term-bg)]",
        className
      )}
      style={{ borderColor: "var(--term-border)" }}
    >
      <div
        className="flex items-center gap-s2 border-b px-s3 py-s2"
        style={{ borderColor: "var(--term-border)" }}
      >
        <span className="flex gap-[6px]">
          <span className="h-[10px] w-[10px] rounded-pill bg-[#e0605a]" />
          <span className="h-[10px] w-[10px] rounded-pill bg-[#e0b25a]" />
          <span className="h-[10px] w-[10px] rounded-pill bg-[#6fb86f]" />
        </span>
        <span className="ml-auto font-mono text-meta text-[var(--term-ts)]">
          {header ?? "cp2k.out · live"}
        </span>
      </div>
      <div
        ref={bodyRef}
        className="overflow-y-auto px-s3 py-s2 font-mono text-[12px] leading-[1.65]"
        style={{ height }}
      >
        {shown.length === 0 ? (
          <span className="text-[var(--term-ts)]">— 로그 없음 —</span>
        ) : (
          shown.map((line) => (
            <div key={line.id} className={TONE_CLASS[line.tone ?? "default"]}>
              {line.html}
              {line.cursor && (
                <span
                  className="ml-[1px] text-[var(--term-b)]"
                  style={{ animation: "blink 1s step-end infinite" }}
                >
                  ▌
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
