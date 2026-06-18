// app/(wizard)/layout.tsx — 3-존 콕핏 셸 적용 (StepRail + Workspace + SummaryPanel)
import { AppShell } from "@/components/layout/app-shell";

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
