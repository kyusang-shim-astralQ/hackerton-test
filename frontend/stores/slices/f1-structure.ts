// stores/slices/f1-structure.ts — 구조 입력 슬라이스. 소유: f1 담당.
// 공유 골격이 필드/액션을 미리 선언 → 기능은 자기 필드만 읽고 쓴다.
import type { StateCreator } from "zustand";
import type { AtomInfo } from "../types";

export interface F1Slice {
  structureInfo?: AtomInfo; // 단일 구조
  structuresInfo?: AtomInfo[]; // 다중 CIF (data-models 다중 분기)
  contentHash?: string; // CIF 본문 SHA-256
  setStructure: (info: AtomInfo, hash?: string) => void;
  setStructures: (infos: AtomInfo[]) => void;
  clearStructure: () => void;
}

export const F1_INITIAL = {
  structureInfo: undefined,
  structuresInfo: undefined,
  contentHash: undefined,
};

// 입력만 영속
export const F1_PERSIST_KEYS = ["structureInfo", "structuresInfo", "contentHash"] as const;

export const createF1Slice: StateCreator<F1Slice, [], [], F1Slice> = (set) => ({
  ...F1_INITIAL,
  setStructure: (structureInfo, contentHash) => set({ structureInfo, contentHash }),
  setStructures: (structuresInfo) => set({ structuresInfo }),
  clearStructure: () => set({ ...F1_INITIAL }),
});
