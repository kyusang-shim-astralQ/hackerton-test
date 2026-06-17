// components/layout/step-placeholder.tsx — 파운데이션 플레이스홀더(기능 프롬프트 fe/02~07 이 page.tsx 를 교체).
"use client";

import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSyncStep } from "@/lib/use-sync-step";
import { useT } from "@/lib/i18n/use-t";

export function StepPlaceholder({
  step,
  featureKey,
  owner,
  icon,
  title,
}: {
  step: number;
  featureKey: string;
  owner: string;
  icon: React.ReactNode;
  title: string;
}) {
  useSyncStep(step);
  const { t } = useT();
  return (
    <Card>
      <CardHead icon={icon} title={title} sub={<Badge>{owner}</Badge>} />
      <CardContent>
        <p>{t(featureKey)}</p>
        <p className="mt-s2 text-ink-faint">{t("common.placeholder")}</p>
      </CardContent>
    </Card>
  );
}
