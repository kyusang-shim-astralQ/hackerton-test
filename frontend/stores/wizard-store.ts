// stores/wizard-store.ts — Zustand + persist (슬라이스 합성). 공유 골격 — 기능은 수정하지 않는다.
// 저장 정책(design-system §4.6 / fe/01 §6):
//   ① 입력만 영속(구조/물성/플랜/제외상태/옵션/생성파일/진행단계) — 런타임/잡/리포트/벤치마크는 제외.
//   ② version + migrate(불일치 시 폐기). ③ reset() = 상태 초기화 + clearStorage.
//   ④ partialize는 각 슬라이스의 *_PERSIST_KEYS 를 합쳐 구성(키를 여기 다시 하드코딩하지 않음).
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createCoreSlice, CORE_INITIAL, CORE_PERSIST_KEYS, type CoreSlice } from "./slices/core";
import { createF1Slice, F1_INITIAL, F1_PERSIST_KEYS, type F1Slice } from "./slices/f1-structure";
import { createF2Slice, F2_INITIAL, F2_PERSIST_KEYS, type F2Slice } from "./slices/f2-plan";
import { createF3Slice, F3_INITIAL, F3_PERSIST_KEYS, type F3Slice } from "./slices/f3-inp";
import { createF4Slice, F4_INITIAL, F4_PERSIST_KEYS, type F4Slice } from "./slices/f4-jobs";
import { createF5Slice, F5_INITIAL, F5_PERSIST_KEYS, type F5Slice } from "./slices/f5-report";
import { createF6Slice, F6_INITIAL, F6_PERSIST_KEYS, type F6Slice } from "./slices/f6-benchmark";

export type WizardState = CoreSlice & F1Slice & F2Slice & F3Slice & F4Slice & F5Slice & F6Slice;

// 전 슬라이스 초기 상태 (reset 시 한 번에 복원)
const FULL_INITIAL = {
  ...CORE_INITIAL,
  ...F1_INITIAL,
  ...F2_INITIAL,
  ...F3_INITIAL,
  ...F4_INITIAL,
  ...F5_INITIAL,
  ...F6_INITIAL,
};

// 영속 키 = 각 슬라이스가 선언한 *_PERSIST_KEYS 의 합집합 (여기서 하드코딩 금지)
const PERSIST_KEYS: (keyof WizardState)[] = [
  ...CORE_PERSIST_KEYS,
  ...F1_PERSIST_KEYS,
  ...F2_PERSIST_KEYS,
  ...F3_PERSIST_KEYS,
  ...F4_PERSIST_KEYS,
  ...F5_PERSIST_KEYS,
  ...F6_PERSIST_KEYS,
] as (keyof WizardState)[];

export const STORE_NAME = "cp2k_agent_session";
export const STORE_VERSION = 2;

export const useWizardStore = create<WizardState>()(
  persist(
    (set, get, api) => ({
      ...createCoreSlice(set as never, get as never, api as never),
      ...createF1Slice(set as never, get as never, api as never),
      ...createF2Slice(set as never, get as never, api as never),
      ...createF3Slice(set as never, get as never, api as never),
      ...createF4Slice(set as never, get as never, api as never),
      ...createF5Slice(set as never, get as never, api as never),
      ...createF6Slice(set as never, get as never, api as never),
      // ★ reset 실제 구현 주입: 전 슬라이스 초기화 + localStorage 비움
      reset: () => {
        try {
          useWizardStore.persist.clearStorage();
        } catch {
          /* noop */
        }
        set({ ...FULL_INITIAL } as Partial<WizardState>);
      },
    }),
    {
      name: STORE_NAME,
      version: STORE_VERSION,
      // 버전 불일치 시 폐기(깨진 상태 로드 방지)
      migrate: () => undefined as unknown as WizardState,
      // ✅ 입력만 영속 — *_PERSIST_KEYS 합집합만 직렬화
      partialize: (state) => {
        const src = state as unknown as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of PERSIST_KEYS) {
          out[k as string] = src[k as string];
        }
        return out as Partial<WizardState>;
      },
    },
  ),
);
