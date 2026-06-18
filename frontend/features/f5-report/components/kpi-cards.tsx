"use client";
// features/f5-report/components/kpi-cards.tsx — summary(final_energy/target_property) KPI 카드
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";

export interface KpiCardsProps {
  finalEnergy?: string;
  targetProperty?: string;
}

function Kpi({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Card className="p-s4">
      <div className="text-meta uppercase tracking-[0.08em] text-ink-faint mb-s2">{label}</div>
      <div className="mono text-title text-ink leading-none break-all">
        {value}
        {unit ? <span className="text-sm text-ink-faint ml-s1">{unit}</span> : null}
      </div>
    </Card>
  );
}

export function KpiCards({ finalEnergy, targetProperty }: KpiCardsProps) {
  const { t } = useT();
  const fe = finalEnergy && finalEnergy !== "N/A" ? finalEnergy : "N/A";
  const tp = targetProperty && targetProperty !== "N/A" ? targetProperty : "N/A";
  return (
    <div className="grid-2 cards">
      <Kpi label={t("f5.kpi.finalEnergy")} value={fe} unit={fe !== "N/A" ? t("f5.kpi.unit.au") : undefined} />
      <Kpi label={t("f5.kpi.targetProperty")} value={tp} />
    </div>
  );
}
