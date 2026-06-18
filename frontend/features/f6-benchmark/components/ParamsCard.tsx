"use client";
// features/f6-benchmark/components/ParamsCard.tsx — 기본 DFT 파라미터 요약(읽기 전용)
// 벤치마크는 구조 업로드/플랜 없이 DEFAULT_OPTIONS 로 가동됨을 명시.
import { Settings2 } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { MetaList } from "@/components/ui/meta-list";
import { useT } from "@/lib/i18n/provider";
import { DEFAULT_OPTIONS } from "../types";

export function ParamsCard() {
  const { t } = useT();
  const o = DEFAULT_OPTIONS;
  return (
    <Card>
      <CardHead
        icon={<Settings2 size={18} strokeWidth={1.8} />}
        title={t("bench.params.title")}
      />
      <p className="text-sm text-ink-faint mb-s3">{t("bench.params.note")}</p>
      <MetaList
        items={[
          { k: "Functional", v: <span className="mono">{o.functional}</span> },
          { k: "Basis set", v: <span className="mono">{o.basis_set}</span> },
          { k: "Cutoff (Ry)", v: <span className="mono">{o.cutoff}</span> },
          { k: "Rel. cutoff", v: <span className="mono">{o.rel_cutoff}</span> },
          { k: "SCF algo", v: <span className="mono">{o.scf_algo}</span> },
          { k: "EPS_SCF", v: <span className="mono">{o.eps_scf}</span> },
        ]}
      />
    </Card>
  );
}
