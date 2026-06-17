// features/f3-inp/components/inp-preview.tsx — 생성된 .inp 미리보기(모노 코드 뷰어 + 파일 선택).
// 다중-CIF면 구조(base)별로 그룹핑. 파일 클릭 시 해당 .inp 강조.
"use client";

import * as React from "react";
import { FileCode2 } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { GeneratedFile } from "@/stores/types";

export interface InpPreviewProps {
  files: GeneratedFile[];
}

/** 다중 분기 파일명 `{base}_step{i}.inp` → base 추출(없으면 "" 단일 그룹). */
function groupKey(filename: string): string {
  const m = filename.match(/^(.*)_step\d+\.inp$/i);
  return m ? m[1] : "";
}

export function InpPreview({ files }: InpPreviewProps) {
  const { t } = useT();
  const [activeIdx, setActiveIdx] = React.useState(0);

  // files 가 바뀌면 선택 인덱스 보정
  React.useEffect(() => {
    if (activeIdx >= files.length) setActiveIdx(0);
  }, [files.length, activeIdx]);

  // 구조(base)별 그룹핑(다중-CIF). 단일이면 base="" 단일 그룹.
  const groups = React.useMemo(() => {
    const map = new Map<string, { file: GeneratedFile; idx: number }[]>();
    files.forEach((file, idx) => {
      const key = groupKey(file.filename);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ file, idx });
    });
    return Array.from(map.entries());
  }, [files]);

  if (files.length === 0) return null;

  const isMulti = groups.length > 1 || groups.some(([k]) => k !== "");
  const active = files[activeIdx] ?? files[0];

  return (
    <Card>
      <CardHead
        icon={<FileCode2 />}
        title={t("f3.preview.title")}
        sub={t("f3.preview.count", { n: files.length })}
      />

      <div className="grid grid-cols-[minmax(180px,240px)_1fr] gap-s4">
        {/* 파일 목록(다중-CIF면 구조별 그룹) */}
        <nav className="flex flex-col gap-s3 overflow-y-auto">
          {groups.map(([base, items]) => (
            <div key={base || "_single"}>
              {isMulti && (
                <div className="mb-s1 px-s1 text-meta font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {base || t("f3.preview.single")}
                </div>
              )}
              <ul className="flex flex-col gap-s1">
                {items.map(({ file, idx }) => (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(idx)}
                      className={cn(
                        "w-full rounded-md border px-s3 py-s2 text-left font-mono text-sm transition-colors",
                        idx === activeIdx
                          ? "border-accent bg-accent-wash text-accent-ink"
                          : "border-hairline-2 bg-card text-ink-soft hover:bg-inset"
                      )}
                    >
                      {file.filename}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* 모노 코드 뷰어 */}
        <div className="min-w-0">
          <div className="mb-s2 flex items-center gap-s2">
            <Badge variant="indigo" className="font-mono">
              {active.filename}
            </Badge>
          </div>
          <pre className="max-h-[420px] overflow-auto rounded-md border border-hairline-2 bg-inset p-s4 font-mono text-sm leading-relaxed text-ink">
            <code>{active.content}</code>
          </pre>
        </div>
      </div>
    </Card>
  );
}
