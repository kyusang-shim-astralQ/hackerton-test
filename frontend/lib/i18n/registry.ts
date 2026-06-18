// lib/i18n/registry.ts — 기능별 사전 등록 레지스트리 (공유 골격)
// 각 기능은 lib/i18n/<도메인>.ts 에서 registerDict(<도메인사전>)만 호출한다.
// (기능은 이 파일을 수정하지 않는다 — 자기 사전 파일만 추가.)
import { coreDict, type Lang, type LangDict, type Dict } from "./core";

// 등록된 사전들(core 포함). 같은 키 충돌 시 나중 등록이 우선.
const registered: LangDict[] = [coreDict];

/** 기능 사전 등록 — lib/i18n/<도메인>.ts 가 import 시점에 호출 */
export function registerDict(dict: LangDict): void {
  registered.push(dict);
}

/** 특정 언어의 병합 사전 반환 */
export function mergedDict(lang: Lang): Dict {
  const out: Dict = {};
  for (const d of registered) {
    Object.assign(out, d[lang] ?? {});
  }
  return out;
}

export type { Lang, LangDict, Dict };
