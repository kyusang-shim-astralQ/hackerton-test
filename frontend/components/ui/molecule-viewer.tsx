"use client";
// components/ui/molecule-viewer.tsx — 3Dmol 분자 뷰어 (design-system §3.11)
// ⚠️ 정리(cleanup) 필수: spin(false) → clear() → 캔버스/WebGL 컨텍스트 제거.
//    미해제 시 단계 이동마다 WebGL 컨텍스트 누적 → 한도(~16) 초과 시 전체 프리징.
import React, { useEffect, useRef, useState } from "react";
import { VIEWER } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface MoleculeViewerProps {
  source: { format: "xyz" | "cif" | "poscar"; data: string };
  autoSpin?: boolean;
  height?: number;
  className?: string;
  /** 좌상단 구조 요약 칩 */
  tag?: React.ReactNode;
}

// 3Dmol 뷰어 인스턴스 최소 타입(라이브러리 d.ts에 의존하지 않음)
interface Dmol3DViewer {
  addModel: (data: string, format: string) => void;
  setStyle: (sel: unknown, style: unknown) => void;
  setBackgroundColor: (c: string) => void;
  zoomTo: () => void;
  zoom: (f: number) => void;
  render: () => void;
  spin: (axisOrFlag: string | boolean, speed?: number) => void;
  clear: () => void;
}

export function MoleculeViewer({
  source,
  autoSpin = true,
  height = 340,
  className,
  tag,
}: MoleculeViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Dmol3DViewer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let disposed = false;
    const host = hostRef.current;
    if (!host) return;

    // 이전 뷰어가 남아 있으면 먼저 정리 (중복 컨텍스트 금지)
    disposeViewer(viewerRef.current, host);
    viewerRef.current = null;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    async function init() {
      try {
        if (!source.data || !source.data.trim()) {
          setFailed(true);
          return;
        }
        const mod = (await import("3dmol")) as unknown as {
          createViewer: (el: HTMLElement, cfg: { backgroundColor: string }) => Dmol3DViewer;
        };
        if (disposed || !host) return;

        const v = mod.createViewer(host, { backgroundColor: VIEWER.bg });
        viewerRef.current = v;
        v.addModel(source.data, source.format);
        // sphere + stick 표현. 원소별 색은 VIEWER 상수.
        v.setStyle(
          {},
          {
            sphere: { scale: 0.32, colorscheme: { prop: "elem", map: { Ti: VIEWER.ti, O: VIEWER.o } } },
            stick: { radius: 0.13, color: VIEWER.stick },
          },
        );
        v.zoomTo();
        v.zoom(1.15);
        v.render();
        if (autoSpin && !reduced) v.spin("y", 0.4);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    }
    void init();

    // cleanup: 언마운트/effect 재실행 시 완전 해제
    return () => {
      disposed = true;
      disposeViewer(viewerRef.current, host);
      viewerRef.current = null;
    };
  }, [source.data, source.format, autoSpin]);

  return (
    <div
      className={cn("relative rounded-lg overflow-hidden border border-hairline bg-white", className)}
      style={{ height }}
    >
      {/* 3Dmol host (relative 필수 — 3Dmol가 absolute 캔버스를 채움) */}
      <div ref={hostRef} className="absolute inset-0" style={{ position: "relative" }} />

      {/* 좌상단 구조 요약 칩 */}
      {tag ? (
        <span className="absolute left-s2 top-s2 z-10 rounded-md bg-paper/80 px-s2 py-s1 text-meta mono text-ink-soft backdrop-blur">
          {tag}
        </span>
      ) : null}

      {/* 우하단 범례 */}
      <span className="absolute bottom-s2 right-s2 z-10 inline-flex items-center gap-s2 rounded-md bg-paper/80 px-s2 py-s1 text-meta text-ink-faint backdrop-blur">
        <Legend color={VIEWER.ti} label="Ti" />
        <Legend color={VIEWER.o} label="O" />
      </span>

      {/* 오프라인/실패 폴백 — 정적 격자 SVG */}
      {failed ? <ViewerFallback /> : null}
    </div>
  );
}

function disposeViewer(v: Dmol3DViewer | null, host: HTMLElement | null) {
  try {
    if (v) {
      v.spin(false); // ① 회전 루프 정지
      v.clear(); // ② 모델/장면 제거
    }
  } catch {
    /* noop */
  }
  // ③ host의 3Dmol <canvas> 제거로 WebGL 컨텍스트 해제
  if (host) {
    try {
      host.replaceChildren();
    } catch {
      host.innerHTML = "";
    }
  }
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-s1">
      <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
      {label}
    </span>
  );
}

function ViewerFallback() {
  return (
    <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-s2 bg-white">
      <svg width="160" height="120" viewBox="0 0 160 120" aria-hidden="true">
        <line x1="40" y1="60" x2="80" y2="40" stroke={VIEWER.stick} strokeWidth="3" />
        <line x1="80" y1="40" x2="120" y2="60" stroke={VIEWER.stick} strokeWidth="3" />
        <line x1="80" y1="40" x2="80" y2="86" stroke={VIEWER.stick} strokeWidth="3" />
        <circle cx="80" cy="40" r="14" fill={VIEWER.ti} />
        <circle cx="40" cy="60" r="10" fill={VIEWER.o} />
        <circle cx="120" cy="60" r="10" fill={VIEWER.o} />
        <circle cx="80" cy="86" r="10" fill={VIEWER.o} />
      </svg>
      <span className="text-meta mono text-ink-faint">3D 뷰어 오프라인 · 정적 미리보기</span>
    </div>
  );
}
