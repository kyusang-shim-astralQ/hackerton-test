// features/f2-plan/components/property-selector.tsx — 2단계 물성 단일 선택(라디오, 12종).
"use client";

import * as React from "react";
import { Check, Info } from "lucide-react";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/use-t";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PROPERTIES,
  CATEGORY_ORDER,
  isOpticalProperty,
  type PropertyCategory,
} from "../properties";

/** 단일 물성 라디오 카드. */
function PropertyOption({
  label,
  desc,
  Icon,
  selected,
  onSelect,
}: {
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group flex flex-col gap-s1 rounded-md border p-s3 text-left transition-colors duration-150",
        selected
          ? "border-accent bg-accent-wash"
          : "border-hairline-2 bg-card hover:border-ink-faint hover:bg-inset"
      )}
    >
      <span className="flex items-center gap-s2">
        <span
          className={cn(
            "inline-flex h-[26px] w-[26px] flex-none items-center justify-center rounded-md border",
            selected
              ? "border-accent bg-accent text-white"
              : "border-hairline-2 bg-card text-ink-soft"
          )}
        >
          {selected ? <Check className="h-[15px] w-[15px]" /> : <Icon className="h-[15px] w-[15px]" />}
        </span>
        <span
          className={cn(
            "text-base font-medium",
            selected ? "text-accent-ink" : "text-ink"
          )}
        >
          {label}
        </span>
      </span>
      <span className="text-sm leading-snug text-ink-faint">{desc}</span>
    </button>
  );
}

export function PropertySelector() {
  const { t } = useT();
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const setSelectedProperty = useWizardStore((s) => s.setSelectedProperty);
  const goToStep = useWizardStore((s) => s.goToStep);

  const selectedKey = Object.keys(selectedProperties).find(
    (k) => selectedProperties[k]
  );

  const select = (key: string) => {
    setSelectedProperty(key);
    // 물성 선택 = 2단계 충족 → 3단계 도달 허용.
    goToStep(3);
  };

  const byCategory = React.useMemo(() => {
    const map = new Map<PropertyCategory, typeof PROPERTIES>();
    for (const p of PROPERTIES) {
      const arr = map.get(p.category) ?? [];
      arr.push(p);
      map.set(p.category, arr);
    }
    return map;
  }, []);

  const showOpticalNote = isOpticalProperty(selectedKey);

  return (
    <div className="flex flex-col gap-s4">
      <Card>
        <CardHead
          icon={<Info />}
          title={t("f2.step2.title")}
          sub={t("f2.plan.stepCount", { n: PROPERTIES.length })}
        />
        <p className="mb-s4 text-base text-ink-soft">{t("f2.step2.help")}</p>

        <div
          role="radiogroup"
          aria-label={t("f2.step2.title")}
          className="flex flex-col gap-s6"
        >
          {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
            <div key={cat}>
              <div className="mb-s2 text-label font-semibold uppercase tracking-[0.10em] text-ink-faint">
                {t(`f2.cat.${cat}`)}
              </div>
              <div className="grid grid-cols-1 gap-s3 sm:grid-cols-2 lg:grid-cols-3">
                {(byCategory.get(cat) ?? []).map((p) => (
                  <PropertyOption
                    key={p.key}
                    label={t(`f2.prop.${p.key}.label`)}
                    desc={t(`f2.prop.${p.key}.desc`)}
                    Icon={p.icon}
                    selected={selectedKey === p.key}
                    onSelect={() => select(p.key)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {showOpticalNote && (
          <div className="mt-s4 flex items-start gap-s2 rounded-md border border-accent-edge bg-accent-wash px-s3 py-s2 text-sm text-accent-ink">
            <Info className="mt-[2px] h-[15px] w-[15px] flex-none" />
            <span>{t("f2.step2.optical.note")}</span>
          </div>
        )}
      </Card>

      {/* 선택 요약 */}
      <Card>
        <div className="text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
          {t("f2.step2.selected")}
        </div>
        <div className="mt-s2">
          {selectedKey ? (
            <Badge variant="indigo">{t(`f2.prop.${selectedKey}.label`)}</Badge>
          ) : (
            <span className="text-base text-ink-faint">{t("f2.step2.none")}</span>
          )}
        </div>
      </Card>
    </div>
  );
}
