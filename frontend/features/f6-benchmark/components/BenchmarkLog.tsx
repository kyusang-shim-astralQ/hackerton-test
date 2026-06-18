"use client";
// features/f6-benchmark/components/BenchmarkLog.tsx — 실시간 로그 콘솔 (LogTerminal 재사용)
import { Terminal } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { LogTerminal, tone, type LogLine } from "@/components/ui/log-terminal";
import { useT } from "@/lib/i18n/provider";

interface BenchmarkLogProps {
  logs: string[];
}

/** 로그 라인 머리 이모지/키워드에 톤 색 부여 */
function toLine(raw: string, i: number): LogLine {
  let t: Parameters<typeof tone>[0] = "default";
  if (/✅|통과|SUCCESS|🏁/.test(raw)) t = "g";
  else if (/🚀|▶️|Starting|기동/.test(raw)) t = "b";
  else if (/🔧|HEAL|치유|Recovering/.test(raw)) t = "y";
  else if (/❌|⚠️|🛑|⏹️|실패|FAILURE|오답|중지|Abort/.test(raw)) t = "y";
  return { id: i, html: tone(t, raw) };
}

export function BenchmarkLog({ logs }: BenchmarkLogProps) {
  const { t } = useT();
  const lines: LogLine[] = logs.map(toLine);
  return (
    <Card>
      <CardHead
        icon={<Terminal size={18} strokeWidth={1.8} />}
        title={t("bench.logs.title")}
        sub={<span className="mono">{logs.length} lines</span>}
      />
      <LogTerminal lines={lines} header="benchmark · live" height={260} maxLines={120} />
    </Card>
  );
}
