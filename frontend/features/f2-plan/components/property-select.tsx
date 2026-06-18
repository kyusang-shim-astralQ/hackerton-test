"use client";
// features/f2-plan/components/property-select.tsx — 2단계 물성 단일 선택. 소유: f2 담당.
// 12개 물성 중 라디오 단일 선택 → store.selectedProperties (정확히 1개만 true).
// 광학(absorption/emission) 선택 시 TDDFPT→DIAGONALIZATION 고정 안내.
import React from "react";
import { Check, Info } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { useWizardStore } from "@/stores/wizard-store";
import { PROPERTY_CATEGORIES, isOptical, type PropertyKey } from "../constants";

/** store 의 selectedProperties 맵에서 단일 선택 키를 추출. */
export function selectedPropertyKey(map: Record<string, boolean> | undefined): string | undefined {
  return Object.entries(map ?? {}).find(([, v]) => v)?.[0];
}

export function PropertySelect() {
  const { t } = useT();
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const setSelectedProperties = useWizardStore((s) => s.setSelectedProperties);

  const selected = selectedPropertyKey(selectedProperties);

  function pick(key: PropertyKey) {
    // 단일 선택: 맵 전체를 {key: true} 로 교체
    setSelectedProperties({ [key]: true });
  }

  return (
    <div className="cards-stack max-w-[920px]">
      <Card>
        <CardHead
          title={t("f2.prop.heading")}
          sub={selected ? <Badge variant="indigo">{t("f2.prop.selected")}</Badge> : undefined}
        />
        <p className="text-sm text-ink-soft mb-s4">{t("f2.prop.hint")}</p>

        <div className="flex flex-col gap-s6">
          {PROPERTY_CATEGORIES.map((cat) => (
            <section key={cat.id}>
              <div className="text-label uppercase tracking-[0.10em] text-ink-faint mb-s2">
                {t(`f2.cat.${cat.id}`)}
              </div>
              <div
                role="radiogroup"
                aria-label={t(`f2.cat.${cat.id}`)}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-s3"
              >
                {cat.items.map((p) => {
                  const on = selected === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => pick(p.key)}
                      className={cn(
                        "group flex items-start gap-s2 text-left rounded-md border p-s3 transition-colors",
                        on
                          ? "border-accent bg-accent-wash"
                          : "border-hairline-2 bg-card hover:bg-inset hover:border-ink-faint",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-px inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-pill border",
                          on ? "border-accent bg-accent text-white" : "border-hairline-2 bg-card",
                        )}
                        aria-hidden="true"
                      >
                        {on ? <Check size={12} strokeWidth={2.6} /> : null}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            "block text-base font-medium leading-tight",
                            on ? "text-accent-ink" : "text-ink",
                          )}
                        >
                          {t(`f2.prop.${p.key}`)}
                        </span>
                        <span className="mt-px block text-sm text-ink-faint">
                          {t(`f2.prop.${p.key}.desc`)}
                        </span>
                        <span className="mono text-meta text-ink-faint">{p.run_type}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* 광학 안내: TDDFPT → DIAGONALIZATION 고정 */}
        {isOptical(selected) ? (
          <div className="mt-s6 flex items-start gap-s2 rounded-md border border-accent-edge bg-accent-wash p-s3 text-sm text-accent-ink">
            <Info size={16} strokeWidth={1.8} className="mt-px shrink-0" />
            <span>{t("f2.optical.note")}</span>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
