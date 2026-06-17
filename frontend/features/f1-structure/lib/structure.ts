// features/f1-structure/lib/structure.ts — AtomInfo 파생 헬퍼 (뷰어 소스/포뮬러/방어 접근)
import type { AtomInfo } from "@/stores/types";
import type { MoleculeSource } from "@/components/ui/molecule-viewer";

/** AtomInfo 가 파싱 실패/빈 CIF 폴백인지 (atom_count==0 또는 error 키). */
export function isAtomInfoFailed(info?: AtomInfo): boolean {
  if (!info) return true;
  return (info.atom_count ?? 0) <= 0 || Boolean(info.error);
}

/** 화학식 문자열 (element_counts → "Ti2 O4"). 비면 파일명 폴백. */
export function chemicalFormula(info?: AtomInfo): string {
  if (!info) return "";
  const counts = info.element_counts ?? {};
  const parts = Object.entries(counts).map(([el, n]) =>
    n > 1 ? `${el}${n}` : el
  );
  return parts.join(" ") || info.filename || "";
}

/**
 * 3Dmol 입력용 XYZ 텍스트 생성.
 * 입력 CIF 포맷 의존을 피하고 atoms(element/x/y/z, 계약 보장 키)로 항상 XYZ 를 만든다.
 * (좌표는 LLM 이 아니라 ASE 파싱 값 — CLAUDE.md §5: 좌표는 파싱값을 쓴다.)
 */
export function atomInfoToViewerSource(info?: AtomInfo): MoleculeSource | undefined {
  if (!info || isAtomInfoFailed(info)) return undefined;
  const atoms = info.atoms ?? [];
  if (atoms.length === 0) return undefined;
  const lines = atoms.map(
    (a) =>
      `${a.element} ${(+a.x).toFixed(6)} ${(+a.y).toFixed(6)} ${(+a.z).toFixed(6)}`
  );
  const xyz = `${atoms.length}\n${info.filename ?? "structure"}\n${lines.join("\n")}`;
  return { format: "xyz", data: xyz };
}

/** 뷰어 칩 라벨: "화학식 · 상 · a×b×c". 선택 키는 방어적으로 처리. */
export function viewerTagLabel(info?: AtomInfo): string {
  if (!info) return "";
  const formula = chemicalFormula(info);
  const phase = info.phase;
  const cell = info.cell;
  const cellStr =
    Array.isArray(cell) && cell.length >= 3
      ? `${cell[0].toFixed(2)}×${cell[1].toFixed(2)}×${cell[2].toFixed(2)} Å`
      : undefined;
  return [formula, phase, cellStr].filter(Boolean).join(" · ");
}
