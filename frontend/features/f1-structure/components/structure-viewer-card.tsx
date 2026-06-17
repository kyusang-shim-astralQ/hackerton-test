// features/f1-structure/components/structure-viewer-card.tsx — 3D 구조 뷰어 카드 (§3.11 MoleculeViewer 래핑)
// 활성 구조 1개만 렌더 → WebGL 컨텍스트 최소화. 활성 전환 시 key 로 뷰어를 새로 마운트(이전 뷰어는 cleanup 에서 완전 해제).
"use client";

import * as React from "react";
import { Boxes } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { MoleculeViewer } from "@/components/ui/molecule-viewer";
import { useT } from "@/lib/i18n/use-t";
import type { AtomInfo } from "@/stores/types";
import { atomInfoToViewerSource, viewerTagLabel } from "../lib/structure";

export interface StructureViewerCardProps {
  info?: AtomInfo;
  /** 활성 구조 식별 키(전환 시 뷰어 재마운트로 이전 WebGL 컨텍스트 해제). */
  activeKey: string | number;
  className?: string;
}

export function StructureViewerCard({
  info,
  activeKey,
  className,
}: StructureViewerCardProps) {
  const { t } = useT();
  const source = React.useMemo(() => atomInfoToViewerSource(info), [info]);
  const tag = info ? viewerTagLabel(info) : undefined;

  return (
    <Card className={className}>
      <CardHead
        icon={<Boxes />}
        title={t("f1.viewer.title")}
        sub={t("f1.viewer.sub")}
      />
      {source ? (
        // ★ activeKey 로 활성 구조 전환 시 뷰어를 새로 마운트 → 언마운트 cleanup(spin(false)+clear()+캔버스 제거)으로
        //   이전 WebGL 컨텍스트를 확실히 해제(다중-CIF 동시 렌더 금지, 활성 1개만).
        <MoleculeViewer
          key={`viewer-${activeKey}`}
          source={source}
          autoSpin
          height={340}
          tag={tag}
        />
      ) : (
        <div className="flex h-[340px] items-center justify-center rounded-lg border border-dashed border-hairline-2 bg-inset text-base text-ink-faint">
          {t("f1.viewer.empty")}
        </div>
      )}
    </Card>
  );
}
