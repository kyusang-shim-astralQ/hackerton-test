// components/layout/app-shell.tsx — 3-존 콕핏 셸 (design-system §4.1·§4.5)
// grid 280px minmax(0,1fr) 300px, 접힘 시 우측 0. 전역 스크롤 없음, 각 존 내부 스크롤.
"use client";

import * as React from "react";
import { PanelRightOpen } from "lucide-react";
import { StepRail } from "./step-rail";
import { Workspace } from "./workspace";
import { SummaryPanel } from "./summary-panel";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.summaryCollapsed);
  const toggle = useUiStore((s) => s.toggleSummary);

  // persist 하이드레이션 불일치 방지: 마운트 전엔 펼친 기본값으로 렌더.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isCollapsed = mounted && collapsed;

  return (
    <div className={cn("app-grid", isCollapsed && "summary-collapsed")}>
      <StepRail />
      <Workspace>{children}</Workspace>

      <div className="min-h-0 overflow-hidden">
        <SummaryPanel />
      </div>

      {/* 접힘 시 우측 가장자리 재열기 탭 (열은 0이라 뷰포트 고정 위치로) */}
      {isCollapsed && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Expand panel"
          className="fixed right-s2 top-s4 z-20 inline-flex h-[34px] w-[34px] items-center justify-center rounded-md border border-hairline-2 bg-card text-ink-soft shadow-card hover:bg-inset"
        >
          <PanelRightOpen className="h-[16px] w-[16px]" />
        </button>
      )}
    </div>
  );
}
