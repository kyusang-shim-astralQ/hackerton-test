// features/f4-jobs/components/SubmitSummary.tsx
// 제출 전 요약 화면: 활성 스텝 미리보기 + "N stages" 배지 + 구조 수 + [SGE 제출].
// ★ 미리보기·배지·제출 본문 모두 activeSteps 만 사용(fe/05 §0 — 제외 스텝이 되살아나지 않게).
"use client";

import * as React from "react";
import { Rocket, Layers, AlertTriangle } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/use-t";
import type { AtomInfo, PlanStep } from "@/stores/types";

export function SubmitSummary({
  activeSteps,
  structures,
  jobName,
  submitting,
  error,
  onSubmit,
}: {
  activeSteps: PlanStep[];
  structures: AtomInfo[];
  jobName: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const { t } = useT();
  const isMulti = structures.length > 1;
  const canSubmit = activeSteps.length > 0 && !submitting;

  return (
    <Card>
      <CardHead
        icon={<Rocket />}
        title={t("f4.submit.title")}
        sub={t("f4.submit.sub")}
      />
      <CardContent>
        <p className="text-ink-soft">{t("f4.submit.desc")}</p>

        {/* 메타: 배지(stages/structures) */}
        <div className="mt-s4 flex flex-wrap items-center gap-s2">
          <Badge variant="indigo">
            <Layers className="h-[12px] w-[12px]" />
            {t("f4.submit.stages", { n: activeSteps.length })}
          </Badge>
          {isMulti && (
            <Badge variant="neutral">
              {t("f4.submit.structures", { n: structures.length })}
            </Badge>
          )}
          <span className="font-mono num text-sm text-ink-faint">
            {t("f4.submit.jobName")}: {jobName || "—"}
          </span>
        </div>

        {/* 활성 스텝 미리보기 (제외된 스텝은 여기 나타나지 않음) */}
        <div className="mt-s4 rounded-md border border-hairline-soft bg-inset px-s4 py-s3">
          <div className="mb-s2 text-meta uppercase tracking-[0.08em] text-ink-faint">
            {t("f4.submit.previewTitle")}
          </div>
          {activeSteps.length === 0 ? (
            <div className="text-sm text-oxblood">{t("f4.submit.noActive")}</div>
          ) : (
            <ol className="flex flex-col gap-s2">
              {activeSteps.map((s, i) => (
                <li key={i} className="flex items-center gap-s3">
                  <span className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-pill bg-accent font-mono text-meta font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="text-base text-ink">
                    {s.step_name.replace(/^Step\s*\d+:\s*/i, "")}
                  </span>
                  <span className="ml-auto font-mono text-sm text-ink-faint">
                    {s.run_type}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {isMulti && (
          <div className="mt-s3 flex flex-col gap-s1">
            <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
              {t("f4.submit.structureLabel")}
            </span>
            <div className="flex flex-wrap gap-s2">
              {structures.map((st) => (
                <span
                  key={st.filename}
                  className="rounded-md border border-hairline-2 bg-card px-s2 py-[2px] font-mono text-sm text-ink-soft"
                >
                  {st.filename}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-s4 flex flex-wrap items-center gap-s3">
          <Button
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            <Rocket className="h-[16px] w-[16px]" />
            {t("f4.submit.cta")}
          </Button>
          {submitting && (
            <span className="text-sm text-ink-faint">
              {t("f4.submit.submitting")}
            </span>
          )}
        </div>

        {error && (
          <div className="mt-s4 flex items-start gap-s2 rounded-md border border-oxblood/30 bg-oxblood-wash px-s3 py-s2">
            <AlertTriangle className="mt-px h-[16px] w-[16px] flex-none text-oxblood" />
            <div className="text-sm text-oxblood">
              <span className="font-semibold">{t("f4.submit.error")}: </span>
              {error}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
