"use client";
// app/(wizard)/step-4/page.tsx — 4단계: AI 플랜 검토/편집 + INP 생성 (f3-inp 소유)
// 단일 소스: docs/features/f3-inp/api.md, docs/contracts/data-models.md, docs/design-system.md §4.2(4단계)
import "@/lib/i18n/f3-inp"; // 도메인 사전 등록(부수효과)
import React from "react";
import { GitBranch, FileCog, Layers, AlertTriangle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { MOCK } from "@/lib/api";
import { ApiError } from "@/lib/api";
import type { PlanStep, AtomInfo } from "@/stores/types";

import { PlanStepCard } from "@/features/f3-inp/components/plan-step-card";
import { InpPreview } from "@/features/f3-inp/components/inp-preview";
import {
  generateInp,
  activeSteps,
  type InpRequest,
  SEED_ATOM_INFO,
  SEED_STEPS,
  SEED_OPTIONS,
} from "@/features/f3-inp/api";

/** PlanStep의 안정적 제외-키: step_idx 우선, 없으면 배열 인덱스(1-based) */
function stepKey(step: PlanStep, arrayIdx: number): number {
  return step.step_idx ?? arrayIdx + 1;
}

export default function Step4Page() {
  const { t } = useT();
  const router = useRouter();

  // ── store (읽기) ──
  const planResult = useWizardStore((s) => s.planResult);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const excludedSteps = useWizardStore((s) => s.excludedSteps);
  const generatedFiles = useWizardStore((s) => s.generatedFiles);

  // ── store (쓰기) ──
  const setStepExcluded = useWizardStore((s) => s.setStepExcluded);
  const setGeneratedFiles = useWizardStore((s) => s.setGeneratedFiles);
  const goNext = useWizardStore((s) => s.goNext);

  // ── f2 미완성 시 단독 개발 시드 (idle 금지) ──
  const usingSeed = !planResult?.steps?.length;
  const steps: PlanStep[] = usingSeed ? SEED_STEPS : planResult!.steps;
  const opts = inpOptions ?? (usingSeed ? SEED_OPTIONS : {});
  const atomInfo: AtomInfo =
    structureInfo ?? planResult?.atom_info ?? (usingSeed ? SEED_ATOM_INFO : ({} as AtomInfo));
  const multiAtomInfo =
    Array.isArray(structuresInfo) && structuresInfo.length > 1 ? structuresInfo : null;

  // ── 로컬 상태 ──
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [activeFile, setActiveFile] = React.useState<string | undefined>(undefined);

  // 제외 여부 판정(단일 소스: excludedSteps 맵)
  const isExcluded = React.useCallback(
    (step: PlanStep, i: number) => excludedSteps?.[stepKey(step, i)] === true,
    [excludedSteps],
  );

  // 활성(제외 안 된) 단계만 — api.md 규칙(selected !== false && exclude !== true)과 동일
  const effectiveSteps: PlanStep[] = React.useMemo(
    () =>
      steps.map((s, i) => ({ ...s, exclude: s.exclude === true || isExcluded(s, i) })),
    [steps, isExcluded],
  );
  const active = activeSteps(effectiveSteps);

  // 필터 후 1-based 순번 매핑(원본 인덱스 → 활성 순번)
  const activeOrder = React.useMemo(() => {
    const order = new Map<number, number>();
    let n = 0;
    effectiveSteps.forEach((s, i) => {
      if (s.selected !== false && s.exclude !== true) {
        n += 1;
        order.set(i, n);
      }
    });
    return order;
  }, [effectiveSteps]);

  async function onGenerate() {
    setError(null);
    if (!active.length) {
      setError(t("f3.gen.noSteps"));
      return;
    }
    const req: InpRequest = {
      atom_info: atomInfo,
      steps: effectiveSteps, // exclude 반영 — 백엔드가 동일 규칙으로 필터/재인덱싱
      property: opts.property ?? "energy",
      basis_set: opts.basis_set ?? "DZVP-MOLOPT-GTH",
      cutoff: opts.cutoff ?? 400.0,
      rel_cutoff: opts.rel_cutoff ?? 50.0,
      functional: opts.functional ?? "PBE",
      method: opts.method,
      scf_algo: opts.scf_algo,
      charge: opts.charge,
      multiplicity: opts.multiplicity,
      use_smear: opts.use_smear,
      smear_temp: opts.smear_temp,
      custom_options: opts.custom_options,
      eps_scf: opts.eps_scf,
      periodic: opts.periodic,
      max_scf: opts.max_scf,
      lsd: opts.lsd,
      added_mos: opts.added_mos,
      multi_atom_info: multiAtomInfo,
    };
    setGenerating(true);
    try {
      const res = await generateInp(req);
      setGeneratedFiles(res.generated_files ?? []);
      setActiveFile(res.generated_files?.[0]?.filename);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setGenerating(false);
    }
  }

  const hasFiles = (generatedFiles?.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-s6 max-w-[1100px]">
      {/* 1) AI 워크플로 검토 */}
      <Card>
        <CardHead
          icon={<GitBranch size={18} strokeWidth={1.8} />}
          title={t("f3.workflow.title")}
          sub={t("f3.workflow.activeCount", { active: active.length, total: steps.length })}
        />
        <CardContent className="flex flex-col gap-s4">
          {usingSeed ? (
            <div className="flex items-center gap-s2 rounded-md bg-accent-wash border border-accent-edge px-s3 py-s2 text-sm text-accent-ink">
              <Sparkles size={14} strokeWidth={1.8} className="shrink-0" />
              {t("f3.workflow.empty")}
            </div>
          ) : null}

          {/* expert_tip (있으면) */}
          {planResult?.expert_tip ? (
            <p className="text-sm text-ink-soft border-l-2 border-accent-edge pl-s3">
              {planResult.expert_tip}
            </p>
          ) : null}

          {/* 가변 N-스텝 타임라인 */}
          <div className="flex flex-col gap-s3">
            {steps.map((step, i) => {
              const excluded = effectiveSteps[i].exclude === true;
              return (
                <PlanStepCard
                  key={`${stepKey(step, i)}-${i}`}
                  step={step}
                  activeIndex={activeOrder.get(i)}
                  excluded={excluded}
                  onToggleExclude={(ex) => setStepExcluded(stepKey(step, i), ex)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 2) 대상 구조 + INP 생성 */}
      <Card>
        <CardHead
          icon={<FileCog size={18} strokeWidth={1.8} />}
          title={t("f3.gen.title")}
          sub={
            multiAtomInfo ? (
              <span className="inline-flex items-center gap-s1">
                <Layers size={12} strokeWidth={1.8} />
                {t("f3.struct.multi", { count: multiAtomInfo.length })}
              </span>
            ) : (
              t("f3.struct.single")
            )
          }
        />
        <CardContent className="flex flex-col gap-s4">
          <p className="text-sm text-ink-soft">{t("f3.gen.desc")}</p>

          {/* 대상 구조 칩 */}
          <div className="flex flex-wrap items-center gap-s2">
            {(multiAtomInfo ?? [atomInfo]).map((s, i) => (
              <Badge key={`${s.filename ?? i}-${i}`} variant="indigo" className="font-mono">
                {s.filename ?? "structure.cif"}
              </Badge>
            ))}
          </div>

          {error ? (
            <div
              role="alert"
              className="flex items-start gap-s2 rounded-md bg-oxblood-wash border border-[#e0c4c0] px-s3 py-s2 text-sm text-oxblood"
            >
              <AlertTriangle size={15} strokeWidth={1.8} className="mt-px shrink-0" />
              <span>
                <span className="font-semibold">{t("f3.gen.errorTitle")}: </span>
                {error}
              </span>
            </div>
          ) : null}

          <div className="flex items-center gap-s3">
            <Button
              variant="primary"
              size="lg"
              loading={generating}
              disabled={generating || !active.length}
              onClick={onGenerate}
            >
              {generating
                ? t("f3.gen.generating")
                : hasFiles
                  ? t("f3.gen.regenerate")
                  : t("f3.gen.button")}
            </Button>
            {MOCK && hasFiles ? (
              <span className="text-meta text-ink-faint">{t("f3.gen.mock")}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* 3) INP 미리보기 */}
      {hasFiles ? (
        <Card>
          <CardHead
            icon={<FileCog size={18} strokeWidth={1.8} />}
            title={t("f3.preview.title")}
            sub={t("f3.preview.sub", { count: generatedFiles!.length })}
          />
          <CardContent className="flex flex-col gap-s4">
            <InpPreview
              files={generatedFiles!}
              activeFilename={activeFile}
              onSelect={setActiveFile}
            />

            <div className="flex items-center justify-between gap-s4 pt-s2 border-t border-hairline-soft">
              {multiAtomInfo ? (
                <span className="text-sm text-ink-faint">
                  {t("f3.next.multiNote", { count: multiAtomInfo.length })}
                </span>
              ) : (
                <span />
              )}
              <Button
                variant="primary"
                onClick={() => {
                  goNext();
                  router.push("/step-5");
                }}
              >
                {t("f3.next.button")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
