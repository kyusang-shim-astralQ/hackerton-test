// features/f1-structure/lib.ts — f1 표시 파생값 헬퍼 (소유: f1 담당)
// AtomInfo 의 선택적 키는 모두 ?. / 기본값으로 방어적으로 읽는다 (data-models §1 계약).
import type { AtomInfo } from "@/stores/types";

/** element_counts → "Ti2 O4" 형태 화학식. 없으면 elements 나열, 그것도 없으면 파일명. */
export function deriveFormula(info?: AtomInfo): string {
  if (!info) return "—";
  const counts = info.element_counts ?? {};
  const entries = Object.entries(counts);
  if (entries.length > 0) {
    return entries
      .map(([el, n]) => (n > 1 ? `${el}${n}` : el))
      .join(" ");
  }
  if ((info.elements ?? []).length > 0) return info.elements.join(" ");
  return info.filename || "—";
}

/** 구조가 파싱 실패/빈 CIF 폴백인지 (소비자 방어: atom_count==0 또는 error 키). */
export function isFailedStructure(info?: AtomInfo): boolean {
  if (!info) return true;
  return (info.atom_count ?? 0) === 0 || Boolean(info.error);
}

/**
 * AtomInfo.atoms → XYZ 텍스트 (MoleculeViewer source.format="xyz").
 * 3Dmol은 XYZ를 안정적으로 파싱하므로 좌표(ASE가 파싱한 실제 값)를 그대로 쓴다.
 * 원자가 없으면 빈 문자열 → 뷰어가 폴백 SVG로 렌더된다.
 */
export function atomsToXyz(info?: AtomInfo): string {
  const atoms = info?.atoms ?? [];
  if (atoms.length === 0) return "";
  const lines = [String(atoms.length), info?.filename ?? "structure"];
  for (const a of atoms) {
    const el = a.element ?? "X";
    const x = Number.isFinite(a.x) ? a.x : 0;
    const y = Number.isFinite(a.y) ? a.y : 0;
    const z = Number.isFinite(a.z) ? a.z : 0;
    lines.push(`${el} ${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
  }
  return lines.join("\n");
}

/** [a,b,c] → "5.430 · 5.430 · 5.430 Å" (mono 표시). 길이 부족하면 — */
export function latticeStr(cell?: number[]): string {
  if (!cell || cell.length < 3) return "—";
  return `${fmt(cell[0])} · ${fmt(cell[1])} · ${fmt(cell[2])} Å`;
}

/** [α,β,γ] → "90.0 · 90.0 · 90.0°". 폴백 구조엔 cell_angles 부재 → 90도 기본. */
export function anglesStr(angles?: number[]): string {
  const a = angles ?? [90, 90, 90];
  if (a.length < 3) return "—";
  return `${fmt1(a[0])} · ${fmt1(a[1])} · ${fmt1(a[2])}°`;
}

export function volumeStr(volume?: number): string {
  if (volume == null || !Number.isFinite(volume)) return "—";
  return `${volume.toFixed(2)} Å³`;
}

function fmt(n: number): string {
  return Number.isFinite(n) ? n.toFixed(3) : "—";
}
function fmt1(n: number): string {
  return Number.isFinite(n) ? n.toFixed(1) : "—";
}
