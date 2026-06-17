// features/f1-structure/components/structure-meta-card.tsx — 활성 구조 메타데이터 (MetaList, §3.8)
"use client";

import * as React from "react";
import { Atom } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetaList } from "@/components/ui/table";
import { useT } from "@/lib/i18n/use-t";
import type { AtomInfo } from "@/stores/types";
import { chemicalFormula } from "../lib/structure";

export interface StructureMetaCardProps {
  info?: AtomInfo;
  className?: string;
}

/** 선택 키는 ?. / 기본값으로 방어(세 형태 키 집합 다름). */
export function StructureMetaCard({ info, className }: StructureMetaCardProps) {
  const { t } = useT();
  const na = t("f1.meta.na");

  if (!info) {
    return (
      <Card className={className}>
        <CardHead icon={<Atom />} title={t("f1.meta.title")} />
        <p className="text-base text-ink-faint">{t("f1.meta.empty")}</p>
      </Card>
    );
  }

  const cell = info.cell;
  const cellStr =
    Array.isArray(cell) && cell.length >= 3
      ? `${cell[0].toFixed(3)} · ${cell[1].toFixed(3)} · ${cell[2].toFixed(3)} Å`
      : na;
  const angles = info.cell_angles;
  const anglesStr =
    Array.isArray(angles) && angles.length >= 3
      ? `${angles[0].toFixed(1)} · ${angles[1].toFixed(1)} · ${angles[2].toFixed(1)}°`
      : na;
  const volStr =
    typeof info.volume === "number" ? `${info.volume.toFixed(2)} Å³` : na;
  const smear =
    typeof info.smear_recommended === "boolean" ? (
      <Badge variant={info.smear_recommended ? "indigo" : "neutral"}>
        {info.smear_recommended ? t("f1.meta.smearOn") : t("f1.meta.smearOff")}
      </Badge>
    ) : (
      na
    );

  const items = [
    { k: t("f1.meta.formula"), v: chemicalFormula(info) || na },
    { k: t("f1.meta.phase"), v: info.phase ?? na },
    { k: t("f1.meta.spacegroup"), v: info.spacegroup ?? na },
    { k: t("f1.meta.atomCount"), v: `${info.atom_count ?? 0}` },
    { k: t("f1.meta.elements"), v: (info.elements ?? []).join(", ") || na },
    { k: t("f1.meta.cell"), v: cellStr },
    { k: t("f1.meta.angles"), v: anglesStr },
    { k: t("f1.meta.volume"), v: volStr },
    { k: t("f1.meta.smear"), v: smear },
  ];

  return (
    <Card className={className}>
      <CardHead
        icon={<Atom />}
        title={t("f1.meta.title")}
        sub={info.filename}
      />
      <MetaList items={items} />
    </Card>
  );
}
