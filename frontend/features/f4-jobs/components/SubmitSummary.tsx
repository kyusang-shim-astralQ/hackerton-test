"use client";
// features/f4-jobs/components/SubmitSummary.tsx — 제출 전 요약(활성 스텝 미리보기 + "N stages" 배지 + 구조/옵션 + 제출 버튼).
// ★ activeSteps만 사용(제외 스텝은 미리보기/배지/제출 어디에도 나타나면 안 됨, fe/05 §0/DoD).
import React from "react";
import { Rocket, AlertTriangle } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetaList } from "@/components/ui/meta-list";
import { useT } from "@/lib/i18n/provider";
import type { AtomInfo, PlanStep, InpOptions } from "@/stores/types";

export interface SubmitSummaryProps {
  activeSteps: PlanStep[];
  structure?: AtomInfo;
  structures?: AtomInfo[]; // 다중-CIF
  options?: InpOptions;
  submitting: boolean;
  error?: string;
  onSubmit: () => void;
  hasPlan: boolean;
}

export function SubmitSummary({
  activeSteps,
  structure,
  structures,
  options,
  submitting,
  error,
  onSubmit,
  hasPlan,
}: SubmitSummaryProps) {
  const { t } = useT();
  const isMulti = (structures?.length ?? 0) > 1;
  const canSubmit = hasPlan && activeSteps.length > 0 && !submitting;

  return (
    <div className="flex flex-col gap-s4">
      <Card variant="accent">
        <CardHead
          icon={<Rocket size={16} strokeWidth={1.8} />}
          title={t("f4.submit.title")}
          sub={<Badge variant="indigo">{t("f4.submit.stages", { n: activeSteps.length })}</Badge>}
        />
        <p className="text-sm text-ink-soft -mt-s2 mb-s4">{t("f4.submit.sub")}</p>

        <div className="grid-2 cards">
          {/* 구조 */}
          <div className="rounded-md bg-card border border-hairline-soft p-s3">
            <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s2">
              {isMulti ? t("f4.submit.multi", { n: structures?.length ?? 0 }) : t("f4.submit.structure")}
            </div>
            {isMulti ? (
              <ul className="flex flex-col gap-s1">
                {structures?.map((s, i) => (
                  <li key={i} className="mono text-sm text-ink truncate">
                    {s.filename}
                  </li>
                ))}
              </ul>
            ) : structure ? (
              <MetaList
                items={[
                  { k: t("f4.submit.structure"), v: structure.filename },
                  { k: "atoms", v: String(structure.atom_count ?? "—") },
                  { k: "elements", v: (structure.elements ?? []).join(", ") || "—" },
                ]}
              />
            ) : (
              <span className="text-sm text-ink-faint italic">—</span>
            )}
          </div>

          {/* 옵션 */}
          <div className="rounded-md bg-card border border-hairline-soft p-s3">
            <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s2">
              {t("f4.submit.options")}
            </div>
            <MetaList
              items={[
                { k: "functional", v: options?.functional ?? "PBE" },
                { k: "basis", v: options?.basis_set ?? "DZVP-MOLOPT-GTH" },
                { k: "cutoff", v: options?.cutoff != null ? `${options.cutoff} Ry` : "400 Ry" },
                { k: "EPS_SCF", v: options?.eps_scf ?? "1.0E-6" },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* 제출할 활성 스텝 미리보기 */}
      <Card>
        <CardHead title={t("f4.submit.plan")} sub={<Badge variant="indigo">{t("f4.submit.stages", { n: activeSteps.length })}</Badge>} />
        {activeSteps.length === 0 ? (
          <p className="text-sm text-ink-faint italic">
            {hasPlan ? t("f4.submit.noSteps") : t("f4.submit.noPlan")}
          </p>
        ) : (
          <ol className="flex flex-col gap-s2">
            {activeSteps.map((st, i) => (
              <li
                key={i}
                className="flex items-center gap-s3 rounded-md bg-inset/50 border border-hairline-soft px-s3 py-s2"
              >
                <span className="mono text-sm text-accent-ink bg-accent-wash border border-accent-edge rounded-pill w-[24px] h-[24px] inline-flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-ink truncate">{st.step_name}</span>
                <span className="ml-auto mono text-meta text-ink-faint shrink-0">{st.run_type}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {error ? (
        <div className="flex items-start gap-s2 rounded-md border border-oxblood bg-oxblood-wash px-s4 py-s3 text-sm text-oxblood">
          <AlertTriangle size={16} strokeWidth={1.8} className="shrink-0 mt-px" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={!canSubmit} loading={submitting} onClick={onSubmit}>
          {!submitting && <Rocket size={16} strokeWidth={2} />}
          {submitting ? t("f4.submit.submitting") : t("f4.submit.button")}
        </Button>
      </div>
    </div>
  );
}
