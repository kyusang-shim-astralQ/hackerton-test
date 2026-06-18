"use client";
// features/f3-inp/components/inp-preview.tsx — 생성된 .inp 모노 코드 뷰어.
// 파일 탭(다중-CIF면 구조별 그룹) + 줄번호 + 복사. 다크 표면(터미널 톤, design-system §2.1 다크 예외).
import React from "react";
import { Copy, FileCode2 } from "lucide-react";
import type { GeneratedFile } from "@/stores/types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface InpPreviewProps {
  files: GeneratedFile[];
  /** 외부(예: 단계 클릭)에서 강조할 파일명 */
  activeFilename?: string;
  onSelect?: (filename: string) => void;
  height?: number;
}

/** 다중-CIF면 "{base}_step{i}.inp" → base로 그룹핑, 아니면 단일 그룹 */
function groupFiles(files: GeneratedFile[]): { group: string | null; files: GeneratedFile[] }[] {
  const multi = files.some((f) => /_step\d+\.inp$/i.test(f.filename));
  if (!multi) return [{ group: null, files }];
  const map = new Map<string, GeneratedFile[]>();
  for (const f of files) {
    const base = f.filename.replace(/_step\d+\.inp$/i, "");
    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(f);
  }
  return [...map.entries()].map(([group, gf]) => ({ group, files: gf }));
}

export function InpPreview({ files, activeFilename, onSelect, height = 360 }: InpPreviewProps) {
  const { t } = useT();
  const [internalActive, setInternalActive] = React.useState<string | undefined>(files[0]?.filename);
  const [copied, setCopied] = React.useState(false);

  const active = activeFilename ?? internalActive;
  const current = files.find((f) => f.filename === active) ?? files[0];
  const groups = React.useMemo(() => groupFiles(files), [files]);

  React.useEffect(() => {
    // 파일 목록이 바뀌면 첫 파일을 활성화
    if (!files.find((f) => f.filename === internalActive)) {
      setInternalActive(files[0]?.filename);
    }
  }, [files, internalActive]);

  function select(name: string) {
    setInternalActive(name);
    onSelect?.(name);
    setCopied(false);
  }

  async function copy() {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(current.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 불가 환경 무시 */
    }
  }

  if (!files.length) {
    return (
      <p className="text-sm text-ink-faint italic">{t("f3.preview.empty")}</p>
    );
  }

  const lines = current ? current.content.split("\n") : [];

  return (
    <div className="flex flex-col gap-s3 lg:flex-row">
      {/* 파일 탭 (구조별 그룹) */}
      <div className="lg:w-[220px] shrink-0 flex flex-col gap-s3">
        {groups.map(({ group, files: gf }) => (
          <div key={group ?? "__single__"}>
            {group ? (
              <div className="text-meta uppercase tracking-[0.08em] text-ink-faint mb-s1 px-s1">
                {group}
              </div>
            ) : null}
            <ul className="flex flex-col gap-s1">
              {gf.map((f) => (
                <li key={f.filename}>
                  <button
                    type="button"
                    onClick={() => select(f.filename)}
                    className={cn(
                      "w-full flex items-center gap-s2 rounded-md px-s2 py-s2 text-left mono text-sm transition-colors",
                      f.filename === active
                        ? "bg-accent-wash text-accent-ink border border-accent-edge"
                        : "bg-card text-ink-soft border border-hairline-soft hover:bg-inset",
                    )}
                  >
                    <FileCode2 size={14} strokeWidth={1.8} className="shrink-0" />
                    <span className="truncate">{f.filename}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 코드 뷰어 (다크 표면) */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#2a2a38] bg-[#16161e]">
        <div className="flex items-center gap-s2 border-b border-[#2a2a38] px-s3 py-s2">
          <span className="flex gap-s1" aria-hidden="true">
            <span className="h-[10px] w-[10px] rounded-pill bg-[#e0605a]" />
            <span className="h-[10px] w-[10px] rounded-pill bg-[#e0b25a]" />
            <span className="h-[10px] w-[10px] rounded-pill bg-[#6fb86f]" />
          </span>
          <span className="mono text-meta text-[#5b5b72] truncate">{current?.filename}</span>
          <span className="ml-auto mono text-meta text-[#5b5b72]">
            {t("f3.preview.lines", { count: lines.length })}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-s1 rounded-md border border-[#2a2a38] px-s2 py-s1 text-meta text-[#c7c7d6] hover:bg-[#23232e] transition-colors"
          >
            <Copy size={12} strokeWidth={1.8} />
            {copied ? t("f3.preview.copied") : t("f3.preview.copy")}
          </button>
        </div>
        <div className="overflow-auto mono text-[12px] leading-[1.65]" style={{ maxHeight: height }}>
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="select-none whitespace-nowrap pl-s3 pr-s3 text-right align-top text-[#5b5b72]">
                    {i + 1}
                  </td>
                  <td className="w-full whitespace-pre pr-s4 align-top text-[#c7c7d6]">
                    {line || " "}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
