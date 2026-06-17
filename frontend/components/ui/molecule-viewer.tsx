// components/ui/molecule-viewer.tsx — 3Dmol 분자 뷰어 (design-system §3.11)
// ⚠️ 언마운트/재실행 시 spin(false) → clear() → 캔버스 제거로 WebGL 컨텍스트 완전 해제(누적 프리징 방지).
"use client";

import * as React from "react";
import { VIEWER, ELEMENT_COLORS } from "@/lib/tokens";
import { cn } from "@/lib/utils";

export interface MoleculeSource {
  format: "xyz" | "cif" | "poscar";
  data: string;
}

export interface MoleculeViewerProps {
  source?: MoleculeSource;
  autoSpin?: boolean;
  height?: number;
  /** 좌상단 칩(구조 요약) */
  tag?: React.ReactNode;
  className?: string;
}

// 최소 3Dmol 타입(전체 타입 의존 없이 동적 로드).
interface MolViewer {
  addModel: (data: string, format: string) => void;
  setStyle: (sel: unknown, style: unknown) => void;
  setBackgroundColor: (c: string) => void;
  zoomTo: () => void;
  zoom: (f: number) => void;
  render: () => void;
  spin: (axisOrOff: string | false, speed?: number) => void;
  clear: () => void;
}
interface Mol3D {
  createViewer: (
    el: HTMLElement,
    cfg: { backgroundColor?: string }
  ) => MolViewer;
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MoleculeViewer({
  source,
  autoSpin = true,
  height = 340,
  tag,
  className,
}: MoleculeViewerProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const viewerRef = React.useRef<MolViewer | null>(null);
  const [fallback, setFallback] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    // 이전 뷰어를 항상 먼저 완전 해제(중복 컨텍스트 금지, §3.11).
    const disposePrevious = () => {
      const v = viewerRef.current;
      if (v) {
        try {
          v.spin(false);
        } catch {
          /* noop */
        }
        try {
          v.clear();
        } catch {
          /* noop */
        }
        viewerRef.current = null;
      }
      // host 의 3Dmol <canvas> 제거로 WebGL 컨텍스트 해제.
      if (hostRef.current) hostRef.current.replaceChildren();
    };

    disposePrevious();

    if (!source || !source.data || !hostRef.current) {
      setFallback(true);
      return () => disposePrevious();
    }

    setFallback(false);

    (async () => {
      try {
        const mod = (await import("3dmol")) as unknown as {
          default?: Mol3D;
        } & Mol3D;
        const $3Dmol: Mol3D = mod.default ?? (mod as Mol3D);
        if (cancelled || !hostRef.current) return;

        const v = $3Dmol.createViewer(hostRef.current, {
          backgroundColor: VIEWER.bg,
        });
        viewerRef.current = v;

        v.addModel(source.data, source.format);
        // 원소별 색(주요 원소 + 회색 폴백) + stick.
        v.setStyle(
          {},
          {
            sphere: { scale: 0.34, colorscheme: { prop: "elem", map: ELEMENT_COLORS } },
            stick: { radius: 0.13, color: VIEWER.stick },
          }
        );
        v.setBackgroundColor(VIEWER.bg);
        v.zoomTo();
        v.zoom(1.15);
        v.render();
        if (autoSpin && !prefersReducedMotion()) v.spin("y", 0.4);
      } catch {
        if (!cancelled) setFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      disposePrevious();
    };
  }, [source, autoSpin]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-hairline bg-white",
        className
      )}
      style={{ height }}
    >
      <div ref={hostRef} className="absolute inset-0" />
      {fallback && <MoleculeFallback />}
      {tag && (
        <span className="absolute left-s3 top-s3 rounded-md border border-hairline bg-paper/80 px-s2 py-s1 text-meta text-ink-soft backdrop-blur">
          {tag}
        </span>
      )}
      <span className="absolute bottom-s3 right-s3 flex items-center gap-s2 rounded-md border border-hairline bg-paper/80 px-s2 py-s1 text-meta text-ink-faint backdrop-blur">
        <span className="inline-flex items-center gap-s1">
          <span
            className="h-[8px] w-[8px] rounded-pill"
            style={{ background: VIEWER.ti }}
          />
          M
        </span>
        <span className="inline-flex items-center gap-s1">
          <span
            className="h-[8px] w-[8px] rounded-pill"
            style={{ background: VIEWER.o }}
          />
          O
        </span>
      </span>
    </div>
  );
}

/** 오프라인/로드 실패 시 정적 격자 SVG 폴백(.viewer-fallback). */
function MoleculeFallback() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-s2 bg-white">
      <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden>
        {[40, 80, 120].map((y) =>
          [40, 80, 120].map((x) => (
            <line
              key={`l-${x}-${y}`}
              x1={x}
              y1={y}
              x2={x + 40}
              y2={y}
              stroke={VIEWER.stick}
              strokeWidth="2"
              opacity={x < 120 ? 0.6 : 0}
            />
          ))
        )}
        {[40, 80, 120].map((y) =>
          [40, 80, 120].map((x) => (
            <circle
              key={`c-${x}-${y}`}
              cx={x}
              cy={y}
              r={(x + y) % 80 === 0 ? 11 : 7}
              fill={(x + y) % 80 === 0 ? VIEWER.ti : VIEWER.o}
            />
          ))
        )}
      </svg>
      <span className="text-meta text-ink-faint">3D 뷰어 폴백 (정적 격자)</span>
    </div>
  );
}
