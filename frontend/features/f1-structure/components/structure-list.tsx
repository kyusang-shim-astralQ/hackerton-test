// features/f1-structure/components/structure-list.tsx
// 업로드된 구조 목록 = FileChip(파일명 mono + green 유효 배지) 행. 다중-CIF면 활성 구조 전환 리스트.
"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/use-t";
import type { AtomInfo } from "@/stores/types";
import { chemicalFormula, isAtomInfoFailed } from "../lib/structure";

/** 업로드 슬롯 — 분석 진행/성공/실패 상태를 가진다. */
export interface UploadSlot {
  id: string;
  filename: string;
  status: "loading" | "ok" | "error";
  info?: AtomInfo;
  errorMessage?: string;
}

export interface StructureListProps {
  slots: UploadSlot[];
  /** structuresInfo(성공 구조) 기준 활성 인덱스. */
  activeIndex: number;
  /** 성공 슬롯 클릭 시 활성 구조 전환(structuresInfo 인덱스). */
  onSelect: (structuresIndex: number) => void;
  onRemove: (slotId: string) => void;
}

export function StructureList({
  slots,
  activeIndex,
  onSelect,
  onRemove,
}: StructureListProps) {
  const { t } = useT();

  // 성공 슬롯만 structuresInfo 인덱스를 가진다(업로드 순서 유지).
  let okCursor = -1;

  return (
    <ul className="flex flex-col gap-s2">
      {slots.map((slot) => {
        const failed = slot.status === "error" || isAtomInfoFailed(slot.info);
        const isOk = slot.status === "ok" && !failed;
        const structuresIndex = isOk ? ++okCursor : -1;
        const active = isOk && structuresIndex === activeIndex;
        const formula = slot.info ? chemicalFormula(slot.info) : "";

        return (
          <li
            key={slot.id}
            className={cn(
              "flex items-center gap-s3 rounded-md border bg-card px-s3 py-s2",
              "transition-[background,border-color] duration-150 ease-smooth",
              active
                ? "border-accent-edge bg-accent-wash"
                : "border-hairline-2",
              isOk && !active && "cursor-pointer hover:bg-inset"
            )}
            onClick={() => {
              if (isOk && !active) onSelect(structuresIndex);
            }}
          >
            {/* 상태 아이콘 */}
            <span className="flex-none">
              {slot.status === "loading" ? (
                <Loader2 className="h-[16px] w-[16px] animate-spin text-accent" />
              ) : failed ? (
                <AlertTriangle className="h-[16px] w-[16px] text-oxblood" />
              ) : (
                <CheckCircle2 className="h-[16px] w-[16px] text-ok" />
              )}
            </span>

            {/* 파일명 + 화학식 */}
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-sm text-ink num">
                {slot.filename}
              </div>
              <div className="truncate text-meta text-ink-faint">
                {slot.status === "loading"
                  ? t("f1.analyzing")
                  : failed
                    ? (slot.errorMessage ?? t("f1.parseFailed"))
                    : `${formula} · ${slot.info?.atom_count ?? 0} ${t("f1.atomsUnit")}`}
              </div>
            </div>

            {/* 유효/활성 배지 */}
            {isOk &&
              (active ? (
                <Badge variant="indigo">{t("f1.active")}</Badge>
              ) : (
                <Badge variant="green">{t("f1.valid")}</Badge>
              ))}
            {failed && slot.status !== "loading" && (
              <Badge variant="oxblood">{t("f1.fileError")}</Badge>
            )}

            {/* 제거 */}
            <button
              type="button"
              aria-label={t("f1.removeFile")}
              className="flex-none rounded-sm p-s1 text-ink-faint hover:bg-inset hover:text-oxblood"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(slot.id);
              }}
            >
              <X className="h-[14px] w-[14px]" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
