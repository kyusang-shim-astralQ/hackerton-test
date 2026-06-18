"use client";
// components/layout/lang-switch.tsx — ko/en 토글
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/provider";

export function LangSwitch() {
  const { lang, setLang, t } = useT();
  return (
    <Segmented
      aria-label={t("lang.switch")}
      value={lang}
      onValueChange={(v) => setLang(v as "ko" | "en")}
      items={[
        { value: "ko", label: "한국어" },
        { value: "en", label: "EN" },
      ]}
    />
  );
}
