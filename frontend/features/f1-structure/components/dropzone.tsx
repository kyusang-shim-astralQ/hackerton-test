// features/f1-structure/components/dropzone.tsx — 파일 드롭존 (design-system §3 도메인 카드 Dropzone)
// 1.5px dashed + inset, hover accent. 드래그&클릭, 다중 업로드 허용.
"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  accept?: string;
}

export function Dropzone({
  onFiles,
  disabled,
  accept = ".cif,.xyz,POSCAR",
}: DropzoneProps) {
  const { t } = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-s2 rounded-md",
        "border-[1.5px] border-dashed bg-inset px-s6 py-s8 text-center",
        "transition-[border-color,background] duration-150 ease-smooth",
        dragOver
          ? "border-accent bg-accent-wash"
          : "border-hairline-2 hover:border-accent",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <span className="text-accent [&>svg]:h-[26px] [&>svg]:w-[26px]">
        <UploadCloud />
      </span>
      <div className="text-base font-medium text-ink">
        {dragOver ? t("f1.drop.active") : t("f1.drop.idle")}
      </div>
      <div className="text-meta uppercase tracking-[0.08em] text-ink-faint">
        {t("f1.drop.hint")}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          // 같은 파일 재업로드 허용
          e.target.value = "";
        }}
      />
    </div>
  );
}
