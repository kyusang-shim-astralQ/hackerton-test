// app/(wizard)/step-2/page.tsx — 2단계 물성 선택 (f2-plan).
"use client";

import { useSyncStep } from "@/lib/use-sync-step";
import { PropertySelector } from "@/features/f2-plan/components/property-selector";

export default function Step2Page() {
  useSyncStep(2);
  return <PropertySelector />;
}
