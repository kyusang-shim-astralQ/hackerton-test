// app/(wizard)/step-4/page.tsx — f3-inp: AI 플랜 검토/편집 + CP2K .inp 생성(4단계).
// 단일 소스: docs/features/f3-inp/api.md · docs/contracts/data-models.md · docs/design-system.md §4.2(4단계).
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileCog,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSyncStep } from "@/lib/use-sync-step";
import { useT } from "@/lib/i18n/use-t";
import { ApiError } from "@/lib/api";
import { useWizardStore } from "@/stores/wizard-store";
import type { PlanStep, PlanResult } from "@/stores/types";

import { PlanReview } from "@/features/f3-inp/components/plan-review";
import { InpPreview } from "@/features/f3-inp/components/inp-preview";
import {
  buildInpRequest,
  generateInp,
  isStepActive,
  SEED_ATOM_INFO,
  SEED_OPTIONS,
  SEED_STEPS,
} from "@/features/f3-inp/api";

export default function Step4Page() {
  useSyncStep(4);
  const { t } = useT();
  const router = useRouter();

  // store: f1 구조 + f2 플랜/옵션/물성 + f3 생성파일/제외
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const planResult = useWizardStore((s) => s.planResult);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const setPlanResult = useWizardStore((s) => s.setPlanResult);
  const generatedFiles = useWizardStore((s) => s.generatedFiles);
  const setGeneratedFiles = useWizardStore((s) => s.setGeneratedFiles);
  const toggleStepExcluded = useWizardStore((s) => s.toggleStepExcluded);
  const goToStep = useWizardStore((s) => s.goToStep);

  // 상위(f1/f2) 미완성 시 시드로 단독 동작(idle 금지).
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    if (!planResult) {
      setPlanResult({
        expert_tip: t("f3.seed.expertTip"),
        steps: SEED_STEPS,
        atom_info: structureInfo ?? SEED_ATOM_INFO,
      } as PlanResult);
      setSeeded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const steps: PlanStep[] = planResult?.steps ?? [];
  const atomInfo = structureInfo ?? planResult?.atom_info ?? SEED_ATOM_INFO;
  const options = inpOptions ?? SEED_OPTIONS;
  // 물성: f2가 단일 선택(12종 중 1개). 미선택 시 안전 기본값.
  const property =
    Object.keys(selectedProperties).find((k) => selectedProperties[k]) ??
    "energy";

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /**
   * 제외 토글 — ★ cross-feature 단일 소스:
   * planResult.steps[i].exclude 를 직접 갱신(step-5/f4 가 selected!==false && exclude!==true 로 자동 필터).
   * 동시에 f3 excludedSteps 맵도 미러(persist 대상; 새로고침 보존).
   */
  const handleToggleExclude = React.useCallback(
    (i: number, excluded: boolean) => {
      const current = useWizardStore.getState().planResult;
      if (!current) return;
      const nextSteps = current.steps.map((s, idx) =>
        idx === i ? { ...s, exclude: excluded } : s
      );
      setPlanResult({ ...current, steps: nextSteps });
      toggleStepExcluded(i, excluded);
    },
    [setPlanResult, toggleStepExcluded]
  );

  const activeSteps = steps.filter(isStepActive);
  const canGenerate = activeSteps.length > 0 && !loading;

  const handleGenerate = React.useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // 다중-CIF면 multi_atom_info 로 함께 전달(구조별 × 스텝별 .inp).
      const multi =
        structuresInfo && structuresInfo.length > 1 ? structuresInfo : null;
      const req = buildInpRequest({
        atomInfo,
        steps, // selected/exclude 포함 — 백엔드가 동일 규칙으로 필터
        property,
        options,
        multiAtomInfo: multi,
      });
      const result = await generateInp(req);
      setGeneratedFiles(result.generated_files);
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setError(msg);
      setGeneratedFiles(undefined);
    } finally {
      setLoading(false);
    }
  }, [atomInfo, steps, property, options, structuresInfo, setGeneratedFiles]);

  const isMultiCif = !!(structuresInfo && structuresInfo.length > 1);
  const hasFiles = !!generatedFiles && generatedFiles.length > 0;

  const goNext = React.useCallback(() => {
    goToStep(5);
    router.push("/step-5");
  }, [goToStep, router]);

  return (
    <div className="flex flex-col gap-s4">
      {seeded && !structureInfo && (
        <Card variant="accent">
          <CardContent className="flex items-center gap-s2 text-accent-ink">
            <Sparkles className="h-[16px] w-[16px] flex-none" />
            {t("f3.seed.notice")}
          </CardContent>
        </Card>
      )}

      {/* 1) AI 워크플로 검토(가변 N-스텝 타임라인 + 제외 토글) */}
      <PlanReview
        steps={steps}
        expertTip={planResult?.expert_tip}
        onToggleExclude={handleToggleExclude}
      />

      {/* 2) INP 생성 */}
      <Card>
        <CardHead
          icon={<FileCog />}
          title={t("f3.generate.title")}
          sub={
            isMultiCif
              ? t("f3.generate.multi", {
                  n: structuresInfo!.length,
                  s: activeSteps.length,
                })
              : t("f3.generate.single", { s: activeSteps.length })
          }
        />
        <CardContent>
          <p className="text-ink-soft">{t("f3.generate.desc")}</p>

          <div className="mt-s4 flex flex-wrap items-center gap-s3">
            <Button
              variant="primary"
              size="lg"
              loading={loading}
              disabled={!canGenerate}
              onClick={handleGenerate}
            >
              <FileCog className="h-[16px] w-[16px]" />
              {t("f3.generate.action")}
            </Button>
            {activeSteps.length === 0 && (
              <span className="text-sm text-oxblood">
                {t("f3.review.noneActive")}
              </span>
            )}
            {hasFiles && !loading && (
              <Badge variant="green">
                {t("f3.generate.done", { n: generatedFiles!.length })}
              </Badge>
            )}
          </div>

          {error && (
            <div className="mt-s4 flex items-start gap-s2 rounded-md border border-oxblood/30 bg-oxblood-wash px-s3 py-s2">
              <AlertTriangle className="mt-px h-[16px] w-[16px] flex-none text-oxblood" />
              <div className="text-sm text-oxblood">
                <span className="font-semibold">{t("common.error")}: </span>
                {error}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3) INP 미리보기 + 다음 */}
      {hasFiles && (
        <>
          <InpPreview files={generatedFiles!} />
          <div className="flex items-center justify-end gap-s3">
            {isMultiCif && (
              <span className="text-sm text-ink-faint">
                {t("f3.next.multiHint", { n: structuresInfo!.length })}
              </span>
            )}
            <Button variant="primary" size="lg" onClick={goNext}>
              {t("f3.next.submit")}
              <ArrowRight className="h-[16px] w-[16px]" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
