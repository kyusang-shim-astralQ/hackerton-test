// stores/wizard-store.ts — 6개 슬라이스 합성 + persist (입력만 영속 + version/migrate + reset).
// ★ store 골격 파일 — 기능 프롬프트(fe/02~07)는 이 파일을 수정하지 않는다(자기 슬라이스만 수정).
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  createCoreSlice,
  CORE_INITIAL,
  CORE_PERSIST_KEYS,
  type CoreSlice,
} from "./slices/core";
import {
  createF1Slice,
  F1_INITIAL,
  F1_PERSIST_KEYS,
  type F1Slice,
} from "./slices/f1-structure";
import {
  createF2Slice,
  F2_INITIAL,
  F2_PERSIST_KEYS,
  type F2Slice,
} from "./slices/f2-plan";
import {
  createF3Slice,
  F3_INITIAL,
  F3_PERSIST_KEYS,
  type F3Slice,
} from "./slices/f3-inp";
import {
  createF4Slice,
  F4_INITIAL,
  F4_PERSIST_KEYS,
  type F4Slice,
} from "./slices/f4-jobs";
import {
  createF5Slice,
  F5_INITIAL,
  F5_PERSIST_KEYS,
  type F5Slice,
} from "./slices/f5-report";
import {
  createF6Slice,
  F6_INITIAL,
  F6_PERSIST_KEYS,
  type F6Slice,
} from "./slices/f6-benchmark";

/** 전체 합성 상태 = 코어 + f1~f6 슬라이스. */
export interface WizardState
  extends CoreSlice,
    F1Slice,
    F2Slice,
    F3Slice,
    F4Slice,
    F5Slice,
    F6Slice {
  /** 내부 reset 헬퍼(core.reset 이 호출). 외부에서 직접 쓰지 말 것. */
  __resetAll: () => void;
}

/** 모든 슬라이스 초기값 합집합. */
const INITIAL = {
  ...CORE_INITIAL,
  ...F1_INITIAL,
  ...F2_INITIAL,
  ...F3_INITIAL,
  ...F4_INITIAL,
  ...F5_INITIAL,
  ...F6_INITIAL,
};

/**
 * partialize 키 = 각 슬라이스가 선언한 *_PERSIST_KEYS 의 합집합.
 * (키를 store 에 다시 하드코딩하지 않는다 — fe/01 §6: 슬라이스가 선언한 영속 키가 누락되지 않도록.)
 * ✅ 입력만 영속(core/f1/f2/f3). 런타임·잡 상태(f4/f5/f6)는 PERSIST_KEYS 가 비어 있어 자동 제외.
 */
const PERSIST_KEYS: string[] = [
  ...CORE_PERSIST_KEYS,
  ...F1_PERSIST_KEYS,
  ...F2_PERSIST_KEYS,
  ...F3_PERSIST_KEYS,
  ...F4_PERSIST_KEYS,
  ...F5_PERSIST_KEYS,
  ...F6_PERSIST_KEYS,
] as string[];

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get, store) => ({
      ...createCoreSlice(set, get, store),
      ...createF1Slice(set, get, store),
      ...createF2Slice(set, get, store),
      ...createF3Slice(set, get, store),
      ...createF4Slice(set, get, store),
      ...createF5Slice(set, get, store),
      ...createF6Slice(set, get, store),
      __resetAll: () => set({ ...(INITIAL as Partial<WizardState>) }),
    }),
    {
      name: "cp2k_agent_session",
      version: 2, // 스키마 바뀌면 올림 → 옛 데이터 자동 폐기
      migrate: () => undefined, // 버전 불일치 시 폐기(깨진 상태 로드 방지)
      // 입력만 영속(슬라이스 선언 키 합집합).
      partialize: (state) => {
        const out: Record<string, unknown> = {};
        const src = state as unknown as Record<string, unknown>;
        for (const key of PERSIST_KEYS) {
          out[key] = src[key];
        }
        return out;
      },
    }
  )
);

// reset() = 상태 초기화 + localStorage 비움 (design-system §4.6).
// core.reset 은 __resetAll 만 호출하므로, 여기서 clearStorage 를 더해 래핑.
const baseReset = useWizardStore.getState().reset;
useWizardStore.setState({
  reset: () => {
    try {
      useWizardStore.persist.clearStorage();
    } catch {
      // no-op (SSR/스토리지 없음)
    }
    baseReset();
  },
});
