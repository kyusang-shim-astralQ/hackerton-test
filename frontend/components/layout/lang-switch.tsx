// components/layout/lang-switch.tsx — ko/en 토글
"use client";

import { Languages } from "lucide-react";
import { useT } from "@/lib/i18n/use-t";
import { cn } from "@/lib/utils";

export function LangSwitch({ className }: { className?: string }) {
  const { lang, toggleLang } = useT();
  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label="Toggle language"
      className={cn(
        "inline-flex items-center gap-s1 rounded-md border border-hairline-2 bg-card px-s2 py-s1 text-meta font-semibold uppercase tracking-[0.08em] text-ink-soft hover:bg-inset",
        className
      )}
    >
      <Languages className="h-[13px] w-[13px]" />
      {lang === "ko" ? "KO" : "EN"}
    </button>
  );
}
