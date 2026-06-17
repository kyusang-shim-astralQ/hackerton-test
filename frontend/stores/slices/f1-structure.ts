// stores/slices/f1-structure.ts — 구조 슬라이스 (f1 담당이 필드/액션을 사용·확장. 골격은 여기에 선언).
import type { StateCreator } from "zustand";
import type { WizardState } from "../wizard-store";
import type { AtomInfo } from "../types";

export interface F1Slice {
  /** 단일 구조 (단일-CIF) */
  structureInfo?: AtomInfo;
  /** 다중 구조 (다중-CIF) */
  structuresInfo?: AtomInfo[];
  /** 활성 구조 인덱스(다중-CIF 전환) */
  activeStructureIndex: number;
  contentHash?: string;

  setStructureInfo: (info?: AtomInfo) => void;
  setStructuresInfo: (infos?: AtomInfo[]) => void;
  setActiveStructureIndex: (i: number) => void;
  setContentHash: (h?: string) => void;
}

export const F1_INITIAL = {
  structureInfo: undefined,
  structuresInfo: undefined,
  activeStructureIndex: 0,
  contentHash: undefined,
};

/** 입력 영속(§4.6): 구조 정보는 저장. */
export const F1_PERSIST_KEYS: (keyof F1Slice)[] = [
  "structureInfo",
  "structuresInfo",
  "activeStructureIndex",
  "contentHash",
];

export const createF1Slice: StateCreator<WizardState, [], [], F1Slice> = (
  set
) => ({
  ...F1_INITIAL,
  setStructureInfo: (structureInfo) => set({ structureInfo }),
  setStructuresInfo: (structuresInfo) => set({ structuresInfo }),
  setActiveStructureIndex: (activeStructureIndex) =>
    set({ activeStructureIndex }),
  setContentHash: (contentHash) => set({ contentHash }),
});
