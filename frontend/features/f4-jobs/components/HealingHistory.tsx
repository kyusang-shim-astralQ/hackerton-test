"use client";
// features/f4-jobs/components/HealingHistory.tsx — 자가치유 이력(AI가 에러를 읽고 스스로 고친 기록).
// CLAUDE.md §6: 자가수정 과정을 UI에 노출 = 데모 하이라이트.
import React from "react";
import { Wrench } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

export function HealingHistory({ history }: { history?: string[] }) {
  const { t } = useT();
  const items = history ?? [];
  return (
    <div className="rounded-lg border border-hairline bg-card p-s4">
      <div className="flex items-center gap-s2 mb-s2">
        <Wrench size={15} strokeWidth={1.8} className="text-accent" />
        <h3 className="font-serif text-base font-medium text-ink">{t("f4.healing.title")}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint italic">{t("f4.healing.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-s2">
          {items.map((h, i) => (
            <li
              key={i}
              className="flex gap-s2 rounded-md bg-accent-wash border border-accent-edge px-s3 py-s2 text-sm text-accent-ink"
            >
              <span className="mono text-meta text-accent shrink-0 mt-px">AI</span>
              <span className="break-words">{h.replace(/^\[AI Fix\]\s*/, "")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
