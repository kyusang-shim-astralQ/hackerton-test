"use client";
// components/ui/log-terminal.tsx — 다크 라이브 터미널 (design-system §3.9)
import React, { useEffect, useRef } from "react";
import { TERMINAL } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export type LogTone = "default" | "ts" | "g" | "b" | "y";

export interface LogLine {
  id: string | number;
  html: React.ReactNode;
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

export function LogTerminal({
  lines,
  autoScroll = true,
  height = 300,
  maxLines = 40,
  header,
  className,
}: LogTerminalProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const bounded = maxLines > 0 ? lines.slice(-maxLines) : lines;

  useEffect(() => {
    if (autoScroll && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [bounded, autoScroll]);

  return (
    <div
      className={cn("rounded-lg overflow-hidden", className)}
      style={{ background: TERMINAL.bg, border: `1px solid ${TERMINAL.border}` }}
    >
      {/* 헤더: 신호등 3 dot + 우측 라벨 */}
      <div
        className="flex items-center gap-s2 px-s3 py-s2"
        style={{ borderBottom: `1px solid ${TERMINAL.border}` }}
      >
        <span className="inline-flex gap-s1" aria-hidden="true">
          <Dot color={TERMINAL.dotRed} />
          <Dot color={TERMINAL.dotYellow} />
          <Dot color={TERMINAL.dotGreen} />
        </span>
        <span className="ml-auto text-meta mono" style={{ color: TERMINAL.ts }}>
          {header ?? "cp2k.out · live"}
        </span>
      </div>
      {/* 본문 */}
      <div
        ref={bodyRef}
        className="px-s3 py-s2 overflow-y-auto mono"
        style={{ height, color: TERMINAL.body, fontSize: 12, lineHeight: 1.65 }}
        role="log"
        aria-live="polite"
      >
        {bounded.length === 0 ? (
          <span style={{ color: TERMINAL.ts }}>대기 중…</span>
        ) : (
          bounded.map((ln) => (
            <div key={ln.id} className="whitespace-pre-wrap break-words">
              {ln.html}
              {ln.cursor ? <Cursor /> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />;
}

function Cursor() {
  return (
    <span
      style={{ color: TERMINAL.b, animation: "term-blink 1s step-end infinite", marginLeft: 1 }}
      aria-hidden="true"
    >
      ▌
    </span>
  );
}

/** 톤 헬퍼 — 로그 라인 조립 시 색 span 생성 */
export function tone(t: LogTone, children: React.ReactNode): React.ReactNode {
  const color =
    t === "ts" ? TERMINAL.ts : t === "g" ? TERMINAL.g : t === "b" ? TERMINAL.b : t === "y" ? TERMINAL.y : TERMINAL.body;
  return <span style={{ color }}>{children}</span>;
}
