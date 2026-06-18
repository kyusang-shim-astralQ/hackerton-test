"use client";
// components/layout/app-shell.tsx — 3-존 콕핏 셸 (design-system §4.1)
// grid 280px minmax(0,1fr) 300px / 접힘 시 우측 0. §4.5 함정은 globals.css .app 규칙으로 처리.
import React, { useEffect, useState } from "react";
import { StepRail } from "./step-rail";
import { Workspace } from "./workspace";
import { SummaryPanel } from "./summary-panel";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "cp2k.summaryCollapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  // 접힘 상태 localStorage 영속 복원
  useEffect(() => {
    try {
      if (window.localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch {
      /* noop */
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  }

  return (
    <div className={cn("app", collapsed && "summary-collapsed")}>
      <StepRail />
      <Workspace>{children}</Workspace>
      <SummaryPanel collapsed={collapsed} onToggle={toggle} />
    </div>
  );
}
