"use client";
// features/f1-structure/components/structure-step.tsx — 1단계 화면 조립 (소유: f1)
// - 드롭존 → 파일별 POST /analyze-cif (병렬, 개별 방어) → atom_info 수집
// - 1개=단일 구조 / 2개+=다중-CIF 흐름. 활성 구조 인덱스는 f1 로컬 상태(store 골격엔 필드 없음).
// - store: setStructure(활성 1개, hash) + setStructures(전체) 로 우측 패널/하위 단계가 재사용.
// - 3D 뷰어는 활성 구조만 렌더(컨텍스트 최소화). 언마운트/전환 시 MoleculeViewer가 WebGL 해제.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Atom, Boxes, AlertTriangle } from "lucide-react";
import { Card, CardHead, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MoleculeViewer } from "@/components/ui/molecule-viewer";
import { useWizardStore } from "@/stores/wizard-store";
import { useT } from "@/lib/i18n/provider";
import { ApiError } from "@/lib/api";
import { getStep } from "@/lib/steps";

import { analyzeCif } from "../api";
import { atomsToXyz, deriveFormula, isFailedStructure } from "../lib";
import { Dropzone } from "./dropzone";
import { StructureTabs } from "./structure-tabs";
import { StructureMeta } from "./structure-meta";
// 사전 자동 등록 (import 부수효과)
import "@/lib/i18n/f1-structure";

import type { AtomInfo } from "@/stores/types";

interface UploadError {
  name: string;
  message: string;
}

export function StructureStep() {
  const { t } = useT();
  const meta = getStep(1);

  const setStep = useWizardStore((s) => s.setStep);
  const setStructure = useWizardStore((s) => s.setStructure);
  const setStructures = useWizardStore((s) => s.setStructures);
  const clearStructure = useWizardStore((s) => s.clearStructure);

  // 라우트 진입 시 현재 단계 동기화 (레일/요약 step-aware)
  useEffect(() => {
    setStep(1);
  }, [setStep]);

  // 구조 목록은 f1 로컬에서 모으고, 활성 구조를 store에 반영한다.
  const [structures, setStructures_] = useState<AtomInfo[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<UploadError[]>([]);
  // content_hash 는 단일 구조일 때만 store에 의미가 있다.
  const hashRef = useRef<Record<string, string>>({});

  // 구조 목록/활성 인덱스가 바뀔 때마다 store 동기화 (단일 소스 유지)
  useEffect(() => {
    if (structures.length === 0) {
      // 모두 제거됨 → 우측 패널/메타가 pending 으로 복귀
      clearStructure();
      return;
    }
    const idx = Math.min(activeIndex, structures.length - 1);
    const active = structures[idx];
    // 다중-CIF면 전체를, 단일이면 undefined (하위 단계의 multi 분기 조건과 일치)
    setStructures(structures.length > 1 ? structures : (undefined as unknown as AtomInfo[]));
    // 활성 구조는 항상 structureInfo 로 — 우측 패널/메타/이후 단계가 이걸 읽는다.
    setStructure(active, hashRef.current[active.filename]);
  }, [structures, activeIndex, setStructure, setStructures, clearStructure]);

  const handleFiles = useCallback(async (files: File[]) => {
    setErrors([]);
    setLoading(true);

    // 파일별 분석을 병렬로, 일부 실패가 전체를 막지 않도록 개별 방어.
    const results = await Promise.allSettled(files.map((f) => analyzeCif(f).then((r) => ({ f, r }))));

    const ok: AtomInfo[] = [];
    const failed: UploadError[] = [];
    for (let i = 0; i < results.length; i += 1) {
      const res = results[i];
      const name = files[i]?.name ?? "?";
      if (res.status === "fulfilled") {
        const { r } = res.value;
        hashRef.current[r.filename] = r.content_hash;
        ok.push(r.atom_info);
      } else {
        const err = res.reason;
        if (err instanceof ApiError && err.status === 400) {
          failed.push({ name, message: t("f1.error.notcif", { name }) });
        } else {
          const m = err instanceof Error ? err.message : String(err);
          failed.push({ name, message: t("f1.error.upload", { name }) + ` — ${m}` });
        }
      }
    }

    setStructures_((prev) => {
      const next = [...prev, ...ok];
      // 새로 추가된 첫 구조를 활성으로
      if (ok.length > 0) setActiveIndex(prev.length);
      return next;
    });
    if (failed.length > 0) setErrors(failed);
    setLoading(false);
  }, [t]);

  const handleRemove = useCallback((i: number) => {
    setStructures_((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      setActiveIndex((cur) => {
        if (next.length === 0) return 0;
        if (i < cur) return cur - 1;
        return Math.min(cur, next.length - 1);
      });
      return next;
    });
  }, []);

  const hasStructures = structures.length > 0;
  const isMulti = structures.length > 1;
  const active: AtomInfo | undefined = hasStructures
    ? structures[Math.min(activeIndex, structures.length - 1)]
    : undefined;
  const activeXyz = atomsToXyz(active);
  const viewerTag = active
    ? `${deriveFormula(active)} · ${t("f1.viewer.tag.atoms", { n: active.atom_count ?? 0 })}`
    : meta?.title;

  return (
    <div className="max-w-[1080px] flex flex-col gap-s4">
      {/* 상단: 입력 카드 (전체폭) */}
      <Card>
        <CardHead
          icon={<Atom size={18} strokeWidth={1.8} />}
          title={t("f1.input.title")}
          sub={t("f1.input.sub")}
        />
        <CardContent className="flex flex-col gap-s4">
          <Dropzone onFiles={handleFiles} disabled={loading} />

          {loading ? (
            <p className="text-sm text-accent-ink">{t("f1.loading")}</p>
          ) : null}

          {errors.length > 0 ? (
            <ul className="flex flex-col gap-s1 rounded-md border border-[#e0c4c0] bg-oxblood-wash px-s3 py-s2">
              {errors.map((e) => (
                <li key={e.name} className="flex items-start gap-s2 text-sm text-oxblood">
                  <AlertTriangle size={14} strokeWidth={1.8} className="mt-[2px] shrink-0" />
                  <span>{e.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {isMulti ? (
            <StructureTabs
              structures={structures}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              onRemove={handleRemove}
            />
          ) : null}
        </CardContent>
      </Card>

      {hasStructures && active ? (
        // 2열: 좌 3D 뷰어 / 우 메타데이터 (동일 높이는 stretch — globals.css .grid-2.cards)
        <div className="grid-2 cards">
          <Card>
            <CardHead
              icon={<Boxes size={18} strokeWidth={1.8} />}
              title={t("f1.viewer.title")}
              sub={t("f1.viewer.sub")}
            />
            <CardContent>
              <MoleculeViewer
                // key=활성 구조 → 전환 시 이전 뷰어가 언마운트되며 WebGL 컨텍스트 해제
                key={`${active.filename}-${activeIndex}`}
                source={{ format: "xyz", data: activeXyz }}
                height={320}
                tag={viewerTag}
              />
            </CardContent>
          </Card>

          <StructureMeta info={active} />
        </div>
      ) : !loading ? (
        // 빈 상태 (idle 금지 — 안내)
        <Card>
          <CardContent className="flex flex-col items-center gap-s2 py-s8 text-center">
            <Boxes size={28} strokeWidth={1.5} className="text-ink-faint" />
            <p className="text-base text-ink">{t("f1.empty.title")}</p>
            <p className="text-sm text-ink-faint max-w-[48ch]">{t("f1.empty.desc")}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
