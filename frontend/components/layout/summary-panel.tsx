"use client";
// components/layout/summary-panel.tsx — 우측 요약/진행 패널 (design-system §4.1, §4.4)
// step-aware 점진 채움 + 접기/펼치기 + 전체 진행 카드. step-5는 라이브 미러(f4가 채움).
import React from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { TOTAL_STEPS } from "@/lib/steps";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { LangSwitch } from "./lang-switch";
import { cn } from "@/lib/utils";

export interface SummaryPanelProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function SummaryPanel({ collapsed, onToggle }: SummaryPanelProps) {
  const { t } = useT();
  const currentStep = useWizardStore((s) => s.currentStep);
  const maxReached = useWizardStore((s) => s.maxReached);

  const structureInfo = useWizardStore((s) => s.structureInfo);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const planResult = useWizardStore((s) => s.planResult);

  // 접힘 시 우측 가장자리 재오픈 탭
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={false}
        aria-label={t("summary.expand")}
        className="fixed right-0 top-1/2 z-20 -translate-y-1/2 rounded-l-md border border-r-0 border-hairline bg-card px-s1 py-s4 text-ink-faint hover:text-accent hover:bg-inset transition-colors"
      >
        <PanelRightOpen size={18} strokeWidth={1.8} />
      </button>
    );
  }

  const selectedProp = Object.entries(selectedProperties ?? {}).find(([, v]) => v)?.[0];

  return (
    <aside className="summary flex flex-col" aria-hidden={false}>
      {/* head */}
      <div className="flex items-center gap-s2 px-s4 py-s4 border-b border-hairline-soft">
        <h2 className="font-serif text-title font-medium text-ink">{t("summary.title")}</h2>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={true}
          aria-label={t("summary.collapse")}
          className="ml-auto inline-flex h-[30px] w-[30px] items-center justify-center rounded-md text-ink-faint hover:bg-inset hover:text-accent transition-colors"
        >
          <PanelRightClose size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-s4 py-s4 flex flex-col gap-s6">
        {/* 전체 진행 카드 */}
        <ProgressCard current={currentStep} />

        {/* 구조 블록 (fills=1) */}
        <SumBlock title={t("summary.block.structure")} reached={maxReached >= 1}>
          {structureInfo ? (
            <KV
              rows={[
                ["formula", structureInfo.formula ?? structureInfo.filename],
                ["atoms", String(structureInfo.atom_count ?? "—")],
                ["elements", (structureInfo.elements ?? []).join(", ") || "—"],
              ]}
            />
          ) : (
            <Pending text={t("summary.pending.select")} />
          )}
        </SumBlock>

        {/* 물성 블록 (fills=2) */}
        <SumBlock title={t("summary.block.property")} reached={maxReached >= 2}>
          {selectedProp ? (
            <span className="inline-flex rounded-pill bg-accent-wash border border-accent-edge px-s2 py-s1 text-meta font-semibold text-accent-ink">
              {selectedProp}
            </span>
          ) : (
            <Pending text={t("summary.pending.unselected")} />
          )}
        </SumBlock>

        {/* 핵심 옵션 블록 (fills=3) */}
        <SumBlock title={t("summary.block.options")} reached={maxReached >= 3}>
          {inpOptions ? (
            <KV
              rows={[
                ["functional", inpOptions.functional ?? "—"],
                ["basis", inpOptions.basis_set ?? "—"],
                ["cutoff", inpOptions.cutoff != null ? `${inpOptions.cutoff} Ry` : "—"],
                ["EPS_SCF", inpOptions.eps_scf ?? "—"],
              ]}
            />
          ) : (
            <Pending text={t("summary.pending.unset")} />
          )}
        </SumBlock>

        {/* 계산 단계 블록 (fills=4) */}
        <SumBlock title={t("summary.block.stages")} reached={maxReached >= 4}>
          {planResult?.steps?.length ? (
            <ul className="flex flex-col gap-s1">
              {planResult.steps.map((st, i) => (
                <li key={i} className="flex items-center gap-s2 text-sm text-ink-soft">
                  <span className="mono text-meta text-ink-faint">{i + 1}</span>
                  <span className="truncate">{st.step_name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Pending text={t("summary.pending.select")} />
          )}
        </SumBlock>
      </div>

      {/* foot: 언어 전환 */}
      <div className="border-t border-hairline-soft px-s4 py-s3 flex items-center justify-between">
        <span className="text-meta uppercase tracking-[0.08em] text-ink-faint">
          {t("lang.switch")}
        </span>
        <LangSwitch />
      </div>
    </aside>
  );
}

function ProgressCard({ current }: { current: number }) {
  const { t } = useT();
  const pct = Math.round((Math.min(current, TOTAL_STEPS) / TOTAL_STEPS) * 100);
  return (
    <div className="rounded-lg border border-accent-edge bg-accent-wash p-s4">
      <div className="flex items-center justify-between mb-s2">
        <span className="text-meta uppercase tracking-[0.08em] text-accent-ink">
          {t("summary.progress")}
        </span>
        <span className="mono text-sm text-accent-ink">
          {current}/{TOTAL_STEPS}
        </span>
      </div>
      <div className="h-[6px] rounded-pill bg-card overflow-hidden">
        <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-s2 grid grid-cols-6 gap-s1">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <span
            key={i}
            className={cn("h-[4px] rounded-pill", i < current ? "bg-accent" : "bg-card")}
          />
        ))}
      </div>
    </div>
  );
}

function SumBlock({
  title,
  reached,
  children,
}: {
  title: string;
  reached: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s2">{title}</div>
      <div className={cn(!reached && "opacity-60")}>{children}</div>
    </section>
  );
}

function KV({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-s2 py-s1 border-b border-hairline-soft last:border-b-0">
          <dt className="text-sm text-ink-faint">{k}</dt>
          <dd className="mono text-sm text-ink text-right truncate max-w-[60%]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Pending({ text }: { text: string }) {
  return <span className="text-sm text-ink-faint italic">{text}</span>;
}
