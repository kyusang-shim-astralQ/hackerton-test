// features/f2-plan/hooks/use-inp-options.ts — step-3 폼이 쓰는 inpOptions 접근 + 기본값 보장.
"use client";

import * as React from "react";
import { useWizardStore } from "@/stores/wizard-store";
import { F2_DEFAULT_INP_OPTIONS } from "@/stores/slices/f2-plan";
import type { InpOptions } from "@/stores/types";

/**
 * inpOptions 를 항상 채워진 형태로 반환.
 * 최초 마운트 시 store 에 기본값을 1회 주입(없을 때만) → step-3 도달로 핵심 옵션 요약이 채워진다.
 */
export function useInpOptions(): {
  opts: InpOptions;
  patch: (p: Partial<InpOptions>) => void;
} {
  const stored = useWizardStore((s) => s.inpOptions);
  const setInpOptions = useWizardStore((s) => s.setInpOptions);
  const patch = useWizardStore((s) => s.patchInpOptions);

  React.useEffect(() => {
    if (!useWizardStore.getState().inpOptions) {
      setInpOptions({ ...F2_DEFAULT_INP_OPTIONS });
    }
  }, [setInpOptions]);

  const opts = stored ?? F2_DEFAULT_INP_OPTIONS;
  return { opts, patch };
}
