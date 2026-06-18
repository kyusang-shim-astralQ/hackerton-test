"use client";
// features/f6-benchmark/components/BenchmarkEntryButton.tsx — 보조 진입 버튼(→ /benchmark)
// step-6(리포트, f5 소유) 화면 맨 아래에서 import 해 사용하는 보조 진입점.
// 주 진입은 좌측 StepRail 상시 행(파운데이션이 이미 /benchmark 라우팅). 둘 다 같은 /benchmark.
import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import "@/lib/i18n/f6-benchmark"; // 사전 등록(import 시점)

interface BenchmarkEntryButtonProps {
  className?: string;
}

export function BenchmarkEntryButton({ className }: BenchmarkEntryButtonProps) {
  const router = useRouter();
  const { t } = useT();
  return (
    <Button
      variant="default"
      className={className}
      onClick={() => router.push("/benchmark")}
    >
      <FlaskConical size={16} strokeWidth={1.8} />
      {t("rail.benchmark.title")}
    </Button>
  );
}
