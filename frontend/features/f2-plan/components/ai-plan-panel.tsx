"use client";
// features/f2-plan/components/ai-plan-panel.tsx — 3단계 전체폭 AI 계산 플랜. 소유: f2 담당.
// [플랜 생성] → POST /generate-plan (store 에서 PlanRequest 조립, 대용량 좌표 제거 후 전송).
// 응답의 steps[]/expert_tip 을 store.planResult 에 저장 + 플래너 로그에 진행/결과 표시.
import React, { useState } from "react";
import { Sparkles, Lightbulb, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogTerminal, tone, type LogLine } from "@/components/ui/log-terminal";
import { useT } from "@/lib/i18n/provider";
import { useWizardStore } from "@/stores/wizard-store";
import { ApiError, MOCK } from "@/lib/api";
import type { PlanStep } from "@/stores/types";
import { buildPlanRequest, generatePlan } from "../api";
import { isOptical } from "../constants";
import { selectedPropertyKey } from "./property-select";

let logSeq = 0;

export function AiPlanPanel() {
  const { t, lang } = useT();
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const setInpOptions = useWizardStore((s) => s.setInpOptions);
  const planResult = useWizardStore((s) => s.planResult);
  const setPlanResult = useWizardStore((s) => s.setPlanResult);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);

  const property = selectedPropertyKey(selectedProperties);
  const canGenerate = !!structureInfo && !!property && !loading;

  function pushLog(node: React.ReactNode) {
    setLogs((prev) => [...prev, { id: ++logSeq, html: node }]);
  }

  async function onGenerate() {
    if (!structureInfo) {
      setError(t("f2.plan.need_structure"));
      return;
    }
    if (!property) {
      setError(t("f2.plan.need_property"));
      return;
    }
    setError(null);
    setLoading(true);
    setLogs([]);

    const optical = isOptical(property);
    // 광학(흡수/방출)은 TDDFPT → DIAGONALIZATION 고정을 store 에도 반영(SSOT 일관)
    const options = optical
      ? { ...(inpOptions ?? {}), scf_algo: "DIAGONALIZATION" }
      : inpOptions ?? {};
    if (optical && inpOptions?.scf_algo !== "DIAGONALIZATION") {
      setInpOptions(options);
    }

    const req = buildPlanRequest({ atomInfo: structureInfo, property, options, lang });

    pushLog(<>{tone("ts", "▸ ")}{t("f2.log.start")}</>);
    pushLog(
      <>
        {tone("b", "$ ")}
        {t("f2.log.payload", { prop: property, func: req.functional, cut: req.cutoff })}
      </>,
    );
    pushLog(<>{tone("ts", "  ")}{t("f2.log.strip")}</>);
    pushLog(<>{tone("y", "→ ")}{MOCK ? t("f2.log.mock") : t("f2.log.call")}</>);

    try {
      const result = await generatePlan(req);
      setPlanResult(result);
      const n = result.steps?.length ?? 0;
      if (n > 0) {
        pushLog(<>{tone("g", "✓ ")}{t("f2.log.ok", { n })}</>);
        // 플랜 성공 → step-4 는 이미 reachable(canEnter: index<=maxReached+1).
        // Workspace 헤더의 [다음]으로 step-4 진입.
      } else {
        pushLog(<>{tone("y", "! ")}{t("f2.log.fallback")}</>);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e);
      setError(msg);
      pushLog(<>{tone("y", "✗ ")}{t("f2.log.fail", { msg })}</>);
    } finally {
      setLoading(false);
    }
  }

  const steps = planResult?.steps ?? [];
  const hasResult = !!planResult;

  return (
    <Card variant="aiplan" className="mt-s4">
      <CardHead
        icon={<Sparkles size={18} strokeWidth={1.8} />}
        title={t("f2.plan.title")}
        sub={t("f2.plan.sub")}
      />
      <p className="text-sm text-ink-soft mb-s4 max-w-[72ch]">{t("f2.plan.intro")}</p>

      <div className="flex items-center gap-s4 flex-wrap">
        <Button
          variant="primary"
          size="lg"
          loading={loading}
          disabled={!canGenerate}
          onClick={onGenerate}
        >
          <Sparkles size={16} strokeWidth={2} />
          {hasResult ? t("f2.plan.regenerate") : t("f2.plan.generate")}
        </Button>
        {!structureInfo ? (
          <span className="text-sm text-ink-faint">{t("f2.plan.need_structure")}</span>
        ) : !property ? (
          <span className="text-sm text-ink-faint">{t("f2.plan.need_property")}</span>
        ) : hasResult && steps.length > 0 ? (
          <span className="inline-flex items-center gap-s1 text-sm text-ok">
            {t("f2.plan.next_hint")}
          </span>
        ) : null}
      </div>

      {/* 에러 */}
      {error ? (
        <div className="mt-s4 flex items-start gap-s2 rounded-md border border-oxblood bg-oxblood-wash p-s3 text-sm text-oxblood">
          <AlertTriangle size={16} strokeWidth={1.8} className="mt-px shrink-0" />
          <span>
            <strong>{t("f2.plan.error")}:</strong> {error}
          </span>
        </div>
      ) : null}

      {/* 플래너 로그 (로딩/진행/결과) */}
      {(loading || logs.length > 0) && (
        <div className="mt-s4">
          <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s2">
            {t("f2.log.title")}
          </div>
          <LogTerminal lines={logs} height={140} header="planner · /generate-plan" />
          {loading ? (
            <p className="mt-s2 text-sm text-ink-faint">{t("f2.plan.loading")}</p>
          ) : null}
        </div>
      )}

      {/* 결과: expert_tip + steps[] */}
      {hasResult ? (
        <div className="mt-s6 flex flex-col gap-s4">
          {planResult?.expert_tip ? (
            <div className="flex items-start gap-s2 rounded-md border border-accent-edge bg-accent-wash p-s3">
              <Lightbulb size={16} strokeWidth={1.8} className="mt-px shrink-0 text-accent" />
              <div>
                <div className="text-label uppercase tracking-[0.08em] text-accent-ink mb-s1">
                  {t("f2.plan.expert_tip")}
                </div>
                <p className="text-sm text-ink leading-relaxed">{planResult.expert_tip}</p>
              </div>
            </div>
          ) : null}

          {steps.length > 0 ? (
            <div>
              <div className="flex items-center gap-s2 mb-s2">
                <span className="text-label uppercase tracking-[0.10em] text-ink-faint">
                  {t("summary.block.stages")}
                </span>
                <Badge variant="indigo">{t("f2.plan.steps_count", { n: steps.length })}</Badge>
              </div>
              <ol className="flex flex-col gap-s2">
                {steps.map((st, i) => (
                  <StepRow key={st.step_idx ?? i} step={st} index={i + 1} />
                ))}
              </ol>
            </div>
          ) : (
            <div className="flex items-start gap-s2 rounded-md border border-hairline-2 bg-inset p-s3 text-sm text-ink-soft">
              <AlertTriangle size={16} strokeWidth={1.8} className="mt-px shrink-0 text-ink-faint" />
              <span>{t("f2.plan.empty_steps")}</span>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function StepRow({ step, index }: { step: PlanStep; index: number }) {
  const { t } = useT();
  const opts = Array.isArray(step.inp_options)
    ? step.inp_options
    : Object.entries(step.inp_options ?? {}).map(([k, v]) => `${k} ${String(v)}`);
  return (
    <li className="rounded-md border border-hairline bg-card p-s3">
      <div className="flex items-center gap-s2 flex-wrap">
        <span className="mono text-meta text-ink-faint">{t("f2.plan.step_idx", { n: index })}</span>
        <ChevronRight size={13} strokeWidth={2} className="text-ink-faint" />
        <span className="text-base font-medium text-ink">{step.step_name}</span>
        <span className="mono text-meta text-accent-ink bg-accent-wash border border-accent-edge rounded-pill px-s2 py-px">
          {step.run_type}
        </span>
        {step.importance ? (
          <span className="text-meta text-ink-faint">{step.importance}</span>
        ) : null}
      </div>
      {step.objective || step.physics_reason ? (
        <p className="mt-s1 text-sm text-ink-soft">{step.objective ?? step.physics_reason}</p>
      ) : null}
      {opts.length > 0 ? (
        <details className="mt-s2 group">
          <summary className="cursor-pointer text-meta uppercase tracking-[0.08em] text-ink-faint hover:text-accent">
            inp_options ({opts.length})
          </summary>
          <ul className="mt-s1 flex flex-col gap-px">
            {opts.map((line, i) => (
              <li key={i} className="mono text-meta text-ink-soft break-all">
                {line}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
