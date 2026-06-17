// components/layout/summary-panel.tsx — 우측 step-aware 요약/진행 패널 (design-system §4.1·§4.4)
"use client";

import * as React from "react";
import { PanelRightClose } from "lucide-react";
import { STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useUiStore } from "@/stores/ui-store";
import { useT } from "@/lib/i18n/use-t";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

/** data-fills 블록: maxReached >= fills 일 때만 값 노출, 그 전엔 is-pending. */
function SumBlock({
  title,
  fills,
  maxReached,
  pendingText,
  children,
}: {
  title: string;
  fills: number;
  maxReached: number;
  pendingText: string;
  children?: React.ReactNode;
}) {
  const ready = maxReached >= fills;
  return (
    <div className="border-b border-hairline-soft px-s4 py-s3">
      <div className="mb-s1 text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
        {title}
      </div>
      {ready ? (
        <div className="text-base text-ink">{children}</div>
      ) : (
        <div className="text-base text-ink-faint">{pendingText}</div>
      )}
    </div>
  );
}

export function SummaryPanel() {
  const { t } = useT();
  const collapsed = useUiStore((s) => s.summaryCollapsed);
  const toggle = useUiStore((s) => s.toggleSummary);

  const currentStep = useWizardStore((s) => s.currentStep);
  const maxReached = useWizardStore((s) => s.maxReached);
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const planResult = useWizardStore((s) => s.planResult);
  const jobLive = useWizardStore((s) => s.jobLive);

  const structCount = structuresInfo?.length ?? (structureInfo ? 1 : 0);
  const selectedProp = Object.keys(selectedProperties).find(
    (k) => selectedProperties[k]
  );
  const planSteps = planResult?.steps ?? [];
  const isRun = currentStep === 5;

  const progressPct = Math.min(100, Math.round((currentStep / STEPS.length) * 100));

  return (
    <aside
      className="zone-scroll flex h-full flex-col border-l border-hairline bg-card"
      aria-hidden={collapsed}
    >
      {/* 헤더 + 접기 토글 */}
      <div className="flex items-center justify-between border-b border-hairline px-s4 py-s4">
        <span className="font-serif text-title font-medium text-ink">
          {t("summary.title")}
        </span>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={t("summary.collapse")}
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-hairline-2 bg-card text-ink-soft hover:bg-inset"
        >
          <PanelRightClose className="h-[16px] w-[16px]" />
        </button>
      </div>

      {/* 전체 진행 카드 */}
      <div className="border-b border-hairline-soft px-s4 py-s3">
        <div className="mb-s1 flex items-center justify-between text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
          <span>{t("summary.progress")}</span>
          <span className="font-mono num text-ink-soft">
            {currentStep}/{STEPS.length}
          </span>
        </div>
        <div className="h-[6px] w-full overflow-hidden rounded-pill bg-inset">
          <div
            className="h-full rounded-pill bg-accent transition-[width] duration-300 ease-smooth"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <SumBlock
        title={t("summary.block.structure")}
        fills={1}
        maxReached={maxReached}
        pendingText={t("summary.pending")}
      >
        {structCount > 1 ? (
          <span>
            {structCount}개 구조 ·{" "}
            <span className="font-mono num">
              {structuresInfo?.map((s) => s.filename).join(", ")}
            </span>
          </span>
        ) : structureInfo ? (
          <span>
            {Object.entries(structureInfo.element_counts ?? {})
              .map(([el, n]) => `${el}${n}`)
              .join(" ") || structureInfo.filename}{" "}
            ·{" "}
            <span className="font-mono num">
              {structureInfo.atom_count} atoms
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">{t("summary.pending")}</span>
        )}
      </SumBlock>

      <SumBlock
        title={t("summary.block.property")}
        fills={2}
        maxReached={maxReached}
        pendingText={t("summary.unselected")}
      >
        {selectedProp ? (
          <span className="inline-flex rounded-pill border border-accent-edge bg-accent-wash px-s2 py-[2px] text-meta font-semibold text-accent-ink">
            {selectedProp}
          </span>
        ) : (
          <span className="text-ink-faint">{t("summary.unselected")}</span>
        )}
      </SumBlock>

      <SumBlock
        title={t("summary.block.options")}
        fills={3}
        maxReached={maxReached}
        pendingText={t("summary.unset")}
      >
        {inpOptions ? (
          <div className="font-mono num text-sm leading-relaxed text-ink-soft">
            <div>{inpOptions.functional} · {inpOptions.basis_set}</div>
            <div>
              cutoff {inpOptions.cutoff} Ry · EPS_SCF{" "}
              {inpOptions.eps_scf ?? "1.0E-6"}
            </div>
          </div>
        ) : (
          <span className="text-ink-faint">{t("summary.unset")}</span>
        )}
      </SumBlock>

      <SumBlock
        title={t("summary.block.plan")}
        fills={4}
        maxReached={maxReached}
        pendingText={t("summary.pending")}
      >
        {planSteps.length > 0 ? (
          <span>
            {planSteps.length} stages ·{" "}
            <span className="font-mono num">
              {planSteps.map((s) => s.run_type).join(" → ")}
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">{t("summary.pending")}</span>
        )}
      </SumBlock>

      {/* 5단계: stage 목록 → 라이브 미러 전환 (§4.4) */}
      {isRun ? (
        <div className="border-b border-hairline-soft px-s4 py-s3">
          <div className="mb-s2 text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
            {t("summary.block.run")}
          </div>
          {jobLive ? (
            <StatusBadge
              status={jobLive.finished ? "done" : "running"}
              withPulse={!jobLive.finished}
            />
          ) : (
            <StatusBadge status="pending" label="제출 대기" />
          )}
        </div>
      ) : (
        <SumBlock
          title={t("summary.block.report")}
          fills={6}
          maxReached={maxReached}
          pendingText={t("summary.pending")}
        >
          <span className="font-mono num">{progressPct}%</span>
        </SumBlock>
      )}

      <div className="flex-1" />
      <div className="border-t border-hairline px-s4 py-s3">
        <span
          className={cn(
            "text-meta uppercase tracking-[0.08em] text-ink-faint"
          )}
        >
          {t("rail.session")} · cp2k_agent
        </span>
      </div>
    </aside>
  );
}
