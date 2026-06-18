"use client";
// features/f1-structure/components/structure-meta.tsx — 활성 구조 메타데이터 카드 (소유: f1)
// AtomInfo 선택적 키는 모두 ?. / 기본값 방어 (data-models §1). 파싱 실패 구조는 error 노출.
import React from "react";
import { Ruler } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetaList } from "@/components/ui/meta-list";
import { useT } from "@/lib/i18n/provider";
import type { AtomInfo } from "@/stores/types";
import {
  deriveFormula,
  isFailedStructure,
  latticeStr,
  anglesStr,
  volumeStr,
} from "../lib";

export function StructureMeta({ info }: { info: AtomInfo }) {
  const { t } = useT();
  const failed = isFailedStructure(info);

  const items: { k: React.ReactNode; v: React.ReactNode }[] = [
    { k: t("f1.meta.formula"), v: deriveFormula(info) },
    // phase/spacegroup 은 f1 백엔드가 생산하지 않는 선택적 표시 필드 → 있으면 표시, 없으면 —
    { k: t("f1.meta.phase"), v: info.phase ?? t("f1.meta.na") },
    { k: t("f1.meta.spacegroup"), v: info.spacegroup ?? t("f1.meta.na") },
    { k: t("f1.meta.atoms"), v: String(info.atom_count ?? 0) },
    { k: t("f1.meta.elements"), v: (info.elements ?? []).join(", ") || t("f1.meta.na") },
    { k: t("f1.meta.lattice"), v: latticeStr(info.cell) },
    { k: t("f1.meta.angles"), v: anglesStr(info.cell_angles) },
    { k: t("f1.meta.volume"), v: volumeStr(info.volume) },
    {
      k: t("f1.meta.smear"),
      v:
        info.smear_recommended == null ? (
          t("f1.meta.na")
        ) : info.smear_recommended ? (
          <Badge variant="green">{t("f1.smear.on")}</Badge>
        ) : (
          <span className="text-ink-faint">{t("f1.smear.off")}</span>
        ),
    },
  ];

  return (
    <Card>
      <CardHead
        icon={<Ruler size={18} strokeWidth={1.8} />}
        title={t("f1.meta.title")}
        sub={
          failed ? (
            <Badge variant="oxblood">{t("f1.badge.failed")}</Badge>
          ) : (
            <Badge variant="green">{t("f1.badge.parsed")}</Badge>
          )
        }
      />
      <CardContent>
        {failed ? (
          <p className="mb-s3 text-sm text-oxblood">
            {t("f1.error.parse")}: {info.error ?? t("common.error")}
          </p>
        ) : null}
        <MetaList items={items} />
      </CardContent>
    </Card>
  );
}
