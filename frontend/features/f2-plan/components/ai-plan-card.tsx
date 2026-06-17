// features/f2-plan/components/ai-plan-card.tsx — 3단계 AI 계산 플랜(전체 폭, 두 카드 아래).
// [플랜 생성] → POST /generate-plan(목 폴백) → steps[]/expert_tip 을 store 에 저장 + 로그 표시.
"use client";

import * as React from "react";
import { Sparkles, Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogTerminal, type LogLine } from "@/components/ui/log-terminal";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";
import { useLangStore } from "@/stores/lang-store";
import { cn } from "@/lib/utils";
import {
  buildPlanRequest,
  generatePlan,
  SEED_ATOM_INFO,
} from "../api";
import { IS_MOCK } from "@/lib/api";
import { F2_DEFAULT_INP_OPTIONS } from "@/stores/slices/f2-plan";
import type { PlanStep } from "@/stores/types";

type Phase = "idle" | "running" | "done" | "error";

const RUNTYPE_TONE: Record<string, "indigo" | "green" | "neutral"> = {
  GEO_OPT: "indigo",
  CELL_OPT: "indigo",
  ENERGY: "neutral",
  MD: "indigo",
  TDDFPT: "green",
};

function StepRow({ step, index }: { step: PlanStep; index: number }) {
  const reason = step.physics_reason || step.objective || step.description;
  return (
    <div className="border-b border-hairline-soft py-s3 last:border-b-0">
      <div className="flex items-center gap-s2">
        <span className="inline-flex h-[22px] w-[22px] flex-none items-center justify-center rounded-pill bg-accent-wash font-mono num text-meta font-semibold text-accent-ink">
          {step.step_idx ?? index + 1}
        </span>
        <span className="text-base font-medium text-ink">{step.step_name}</span>
        <Badge
          variant={RUNTYPE_TONE[step.run_type] ?? "neutral"}
          className="ml-auto font-mono"
        >
          {step.run_type}
        </Badge>
        {step.importance && (
          <span className="text-meta uppercase tracking-[0.06em] text-ink-faint">
            {step.importance}
          </span>
        )}
      </div>
      {reason && (
        <p className="mt-s1 pl-[30px] text-sm leading-snug text-ink-soft">
          {reason}
        </p>
      )}
    </div>
  );
}

export function AiPlanCard() {
  const { t } = useT();
  const lang = useLangStore((s) => s.lang);

  const structureInfo = useWizardStore((s) => s.structureInfo);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const planResult = useWizardStore((s) => s.planResult);
  const setPlanResult = useWizardStore((s) => s.setPlanResult);
  const goToStep = useWizardStore((s) => s.goToStep);

  const [phase, setPhase] = React.useState<Phase>(planResult ? "done" : "idle");
  const [logs, setLogs] = React.useState<LogLine[]>([]);
  const [errMsg, setErrMsg] = React.useState<string>("");
  const counter = React.useRef(0);

  const selectedKey = Object.keys(selectedProperties).find(
    (k) => selectedProperties[k]
  );

  const pushLog = React.useCallback(
    (text: string, tone: LogLine["tone"] = "default") => {
      const ts = new Date().toLocaleTimeString("en-GB");
      setLogs((prev) => [
        ...prev,
        {
          id: counter.current++,
          tone,
          html: (
            <span>
              <span className="text-[var(--term-ts)]">[{ts}]</span> {text}
            </span>
          ),
        },
      ]);
    },
    []
  );

  const onGenerate = async () => {
    if (!selectedKey) {
      setPhase("error");
      setErrMsg(t("f2.plan.needProperty"));
      return;
    }

    const opts = inpOptions ?? F2_DEFAULT_INP_OPTIONS;
    const atomInfo = structureInfo ?? SEED_ATOM_INFO;

    setPhase("running");
    setErrMsg("");
    setLogs([]);
    pushLog(t("f2.log.start"), "b");
    pushLog(
      t("f2.log.payload", {
        prop: selectedKey,
        func: opts.functional,
        basis: opts.basis_set,
        cutoff: opts.cutoff,
      })
    );
    if (!structureInfo) pushLog(t("f2.plan.seedNotice"), "y");
    pushLog(t("f2.log.keyword"));
    pushLog(t("f2.log.design"));

    try {
      const req = buildPlanRequest({
        atomInfo,
        property: selectedKey,
        opts,
        lang,
      });
      const result = await generatePlan(req);

      if (IS_MOCK) pushLog(t("f2.log.mock"), "y");
      pushLog(t("f2.log.received", { n: result.steps.length }), "g");

      setPlanResult(result);

      if (result.steps.length > 0) {
        setPhase("done");
        // 플랜 생성 성공 = 3단계 충족 → 4단계 도달 허용.
        goToStep(4);
      } else {
        // graceful degradation: 200 + steps:[] — 저장은 하되 진행은 막는다.
        setPhase("error");
        setErrMsg(t("f2.plan.fallbackEmpty"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      pushLog(t("f2.log.failed", { msg }), "y");
      setPhase("error");
      setErrMsg(t("f2.plan.error"));
    }
  };

  const running = phase === "running";
  const steps = planResult?.steps ?? [];

  return (
    <Card variant="aiplan">
      <CardHead
        icon={<Sparkles />}
        title={t("f2.plan.title")}
        sub={t("f2.plan.sub")}
      />

      <div className="flex flex-wrap items-center gap-s3">
        <Button
          variant="primary"
          size="lg"
          loading={running}
          disabled={running}
          onClick={onGenerate}
        >
          <Sparkles className="h-[16px] w-[16px]" />
          {steps.length > 0
            ? t("f2.plan.regenerate")
            : t("f2.plan.generate")}
        </Button>
        {!selectedKey && (
          <span className="text-sm text-ink-faint">
            {t("f2.plan.needProperty")}
          </span>
        )}
        {phase === "done" && (
          <span className="inline-flex items-center gap-s1 text-sm font-medium text-ok">
            <CheckCircle2 className="h-[15px] w-[15px]" />
            {t("f2.plan.done")}
          </span>
        )}
        {phase === "error" && (
          <span className="inline-flex items-center gap-s1 text-sm font-medium text-oxblood">
            <AlertTriangle className="h-[15px] w-[15px]" />
            {errMsg}
          </span>
        )}
      </div>

      {/* 플래너 로그 영역 (생성 중/직후 노출) */}
      {(running || logs.length > 0) && (
        <div className="mt-s4">
          {running && (
            <p className="mb-s2 text-sm text-ink-soft">{t("f2.plan.generating")}</p>
          )}
          <LogTerminal
            lines={logs}
            height={150}
            header="plan.generate · claude"
          />
        </div>
      )}

      {/* 결과: expert_tip + steps */}
      {steps.length > 0 ? (
        <div className="mt-s4 flex flex-col gap-s4">
          {planResult?.expert_tip && (
            <div className="flex items-start gap-s2 rounded-md border border-accent-edge bg-card px-s3 py-s3">
              <Lightbulb className="mt-[2px] h-[16px] w-[16px] flex-none text-accent" />
              <div>
                <div className="text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {t("f2.plan.experttip")}
                </div>
                <p className="mt-s1 text-base leading-snug text-ink">
                  {planResult.expert_tip}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-md border border-hairline bg-card px-s4 py-s2">
            <div className="flex items-center gap-s2 border-b border-hairline-soft py-s2">
              <span className="text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
                {t("f2.plan.steps")}
              </span>
              <Badge variant="indigo" className="ml-auto">
                {t("f2.plan.stepCount", { n: steps.length })}
              </Badge>
            </div>
            {steps.map((s, i) => (
              <StepRow key={s.step_idx ?? i} step={s} index={i} />
            ))}
          </div>
        </div>
      ) : (
        !running && (
          <p
            className={cn(
              "mt-s4 text-base",
              phase === "error" ? "text-oxblood" : "text-ink-faint"
            )}
          >
            {phase === "error" ? errMsg : t("f2.plan.empty")}
          </p>
        )
      )}
    </Card>
  );
}
