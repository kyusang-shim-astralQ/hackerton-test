// app/(wizard)/step-1/page.tsx — f1-structure: CIF 업로드 + 구조 분석 + 3D 뷰어 (design-system §4.2 단계 1)
// 실제 백엔드(:8000) /analyze-cif 로 동작(클러스터 불필요). NEXT_PUBLIC_MOCK=1 이면 시드로 단독 동작.
"use client";

import * as React from "react";
import { FileUp } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSyncStep } from "@/lib/use-sync-step";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";
import { ApiError } from "@/lib/api";
import type { AtomInfo } from "@/stores/types";

import { analyzeCif } from "@/features/f1-structure/api";
import { isAtomInfoFailed } from "@/features/f1-structure/lib/structure";
import { Dropzone } from "@/features/f1-structure/components/dropzone";
import {
  StructureList,
  type UploadSlot,
} from "@/features/f1-structure/components/structure-list";
import { StructureMetaCard } from "@/features/f1-structure/components/structure-meta-card";
import { StructureViewerCard } from "@/features/f1-structure/components/structure-viewer-card";

let slotSeq = 0;
const nextSlotId = () => `slot-${Date.now()}-${slotSeq++}`;

export default function Step1Page() {
  useSyncStep(1);
  const { t } = useT();

  // 업로드 슬롯(로딩/에러 포함) = 로컬 상태. 성공 구조만 store 로 미러.
  const [slots, setSlots] = React.useState<UploadSlot[]>([]);

  const structuresInfo = useWizardStore((s) => s.structuresInfo);
  const structureInfo = useWizardStore((s) => s.structureInfo);
  const activeStructureIndex = useWizardStore((s) => s.activeStructureIndex);
  const setStructureInfo = useWizardStore((s) => s.setStructureInfo);
  const setStructuresInfo = useWizardStore((s) => s.setStructuresInfo);
  const setActiveStructureIndex = useWizardStore(
    (s) => s.setActiveStructureIndex
  );
  const setContentHash = useWizardStore((s) => s.setContentHash);

  // 새로고침 후(persist 복원) store 에 구조가 있는데 로컬 슬롯이 비면 슬롯을 재구성.
  React.useEffect(() => {
    if (slots.length > 0) return;
    if (structuresInfo && structuresInfo.length > 0) {
      setSlots(
        structuresInfo.map((info) => ({
          id: nextSlotId(),
          filename: info.filename,
          status: "ok" as const,
          info,
        }))
      );
    } else if (structureInfo) {
      setSlots([
        {
          id: nextSlotId(),
          filename: structureInfo.filename,
          status: "ok",
          info: structureInfo,
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 성공 슬롯 → store 동기화(structuresInfo 배열 + 단일/다중 분기 + 활성 구조). */
  const syncStore = React.useCallback(
    (allSlots: UploadSlot[], firstHash?: string) => {
      const okInfos: AtomInfo[] = allSlots
        .filter((s) => s.status === "ok" && s.info && !isAtomInfoFailed(s.info))
        .map((s) => s.info as AtomInfo);

      if (okInfos.length === 0) {
        setStructuresInfo(undefined);
        setStructureInfo(undefined);
        setActiveStructureIndex(0);
        return;
      }

      const active = Math.min(activeStructureIndex, okInfos.length - 1);
      // 1개면 단일 구조, 2개 이상이면 다중-CIF 흐름.
      setStructuresInfo(okInfos.length > 1 ? okInfos : undefined);
      setStructureInfo(okInfos[active]);
      setActiveStructureIndex(active);
      if (firstHash) setContentHash(firstHash);
    },
    [
      activeStructureIndex,
      setStructuresInfo,
      setStructureInfo,
      setActiveStructureIndex,
      setContentHash,
    ]
  );

  /** 파일 업로드 → 각 파일마다 /analyze-cif 병렬 호출(개별 방어). */
  const handleFiles = React.useCallback(
    (files: File[]) => {
      const newSlots: UploadSlot[] = files.map((f) => ({
        id: nextSlotId(),
        filename: f.name,
        status: "loading" as const,
      }));

      setSlots((prev) => [...prev, ...newSlots]);

      files.forEach((file, i) => {
        const slotId = newSlots[i].id;
        analyzeCif(file)
          .then((res) => {
            const failed = isAtomInfoFailed(res.atom_info);
            setSlots((prev) => {
              const next = prev.map((s) =>
                s.id === slotId
                  ? {
                      ...s,
                      status: failed ? ("error" as const) : ("ok" as const),
                      info: res.atom_info,
                      errorMessage: failed
                        ? (res.atom_info.error ?? t("f1.parseFailed"))
                        : undefined,
                    }
                  : s
              );
              syncStore(next, res.content_hash);
              return next;
            });
          })
          .catch((err: unknown) => {
            const msg =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : t("f1.fileError");
            setSlots((prev) => {
              const next = prev.map((s) =>
                s.id === slotId
                  ? { ...s, status: "error" as const, errorMessage: msg }
                  : s
              );
              syncStore(next);
              return next;
            });
          });
      });
    },
    [syncStore, t]
  );

  const handleRemove = React.useCallback(
    (slotId: string) => {
      setSlots((prev) => {
        const next = prev.filter((s) => s.id !== slotId);
        syncStore(next);
        return next;
      });
    },
    [syncStore]
  );

  const handleClearAll = React.useCallback(() => {
    setSlots([]);
    setStructuresInfo(undefined);
    setStructureInfo(undefined);
    setActiveStructureIndex(0);
    setContentHash(undefined);
  }, [
    setStructuresInfo,
    setStructureInfo,
    setActiveStructureIndex,
    setContentHash,
  ]);

  const handleSelect = React.useCallback(
    (structuresIndex: number) => {
      setActiveStructureIndex(structuresIndex);
      const okInfos: AtomInfo[] = slots
        .filter((s) => s.status === "ok" && s.info && !isAtomInfoFailed(s.info))
        .map((s) => s.info as AtomInfo);
      if (okInfos[structuresIndex]) setStructureInfo(okInfos[structuresIndex]);
    },
    [slots, setActiveStructureIndex, setStructureInfo]
  );

  // 활성 구조(메타/뷰어 소스). store 의 structureInfo 가 활성 구조다.
  const activeInfo = structureInfo;
  const okCount = slots.filter(
    (s) => s.status === "ok" && s.info && !isAtomInfoFailed(s.info)
  ).length;
  const isMulti = okCount > 1;
  const anyLoading = slots.some((s) => s.status === "loading");

  return (
    <div className="grid grid-cols-1 gap-s4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* 좌측 컬럼: 입력 + 메타 (col-stack) */}
      <div className="flex flex-col gap-s4">
        {/* 구조 입력 카드 */}
        <Card>
          <CardHead
            icon={<FileUp />}
            title={t("f1.input.title")}
            sub={t("f1.input.sub")}
          />
          <Dropzone onFiles={handleFiles} disabled={anyLoading} />

          {slots.length > 0 ? (
            <div className="mt-s4 flex flex-col gap-s3">
              <div className="flex items-center justify-between">
                <span className="text-label font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {t("f1.structures.title")}
                </span>
                <div className="flex items-center gap-s2">
                  {isMulti && (
                    <Badge variant="indigo">
                      {t("f1.structures.count", { n: okCount })}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    onClick={handleClearAll}
                    className="h-[26px] px-s2 text-meta"
                  >
                    {t("f1.clearAll")}
                  </Button>
                </div>
              </div>
              <StructureList
                slots={slots}
                activeIndex={activeStructureIndex}
                onSelect={handleSelect}
                onRemove={handleRemove}
              />
            </div>
          ) : (
            <div className="mt-s4 rounded-md border border-dashed border-hairline-2 bg-inset px-s4 py-s6 text-center">
              <div className="text-base font-medium text-ink">
                {t("f1.empty.title")}
              </div>
              <p className="mx-auto mt-s1 max-w-[40ch] text-sm text-ink-faint">
                {t("f1.empty.desc")}
              </p>
            </div>
          )}
        </Card>

        {/* 구조 메타데이터 카드 (활성 구조) */}
        <StructureMetaCard info={activeInfo} />
      </div>

      {/* 우측 컬럼: 3D 뷰어 (활성 구조 1개만 렌더) */}
      <div className="flex flex-col gap-s4">
        <StructureViewerCard
          info={activeInfo}
          activeKey={`${activeInfo?.filename ?? "none"}-${activeStructureIndex}`}
        />
      </div>
    </div>
  );
}
