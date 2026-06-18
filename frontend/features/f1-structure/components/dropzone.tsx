"use client";
// features/f1-structure/components/dropzone.tsx — 구조 파일 드롭존 (소유: f1)
// 드래그&클릭, 다중 업로드 허용. 디자인: design-system §3 "Dropzone"(1.5px dashed + inset, hover accent).
import React, { useId, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

export interface DropzoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

export function Dropzone({ onFiles, disabled }: DropzoneProps) {
  const { t } = useT();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  }

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
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) handle(e.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-s2 rounded-lg px-s6 py-s8 text-center",
        "border-[1.5px] border-dashed bg-inset transition-colors cursor-pointer",
        over ? "border-accent bg-accent-wash" : "border-hairline-2 hover:border-accent",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <UploadCloud
        size={28}
        strokeWidth={1.6}
        className={cn("transition-colors", over ? "text-accent" : "text-ink-faint")}
      />
      <p className="text-base text-ink-soft">{t("f1.dropzone.hint")}</p>
      <p className="text-meta uppercase tracking-[0.08em] text-ink-faint">
        {t("f1.dropzone.formats")}
      </p>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept=".cif,.xyz,POSCAR,.poscar"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          handle(e.target.files);
          // 같은 파일 재업로드 허용 (값 초기화)
          e.target.value = "";
        }}
      />
    </div>
  );
}
