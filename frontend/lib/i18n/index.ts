// lib/i18n/index.ts — 경량 사전 + t() 훅 (원본 data-i18n 대체). 기본 ko.
// 기능은 자기 사전 파일(lib/i18n/<feature>.ts)만 추가하고, 아래 registerDict 로 합류시킨다.

export type Lang = "ko" | "en";
/** 한 언어의 키→문자열 맵 */
export type LangDict = Record<string, string>;
/** ko/en 두 언어 사전 */
export type Dict = Record<Lang, LangDict>;

import { commonDict } from "./common";
import { f1Dict } from "./f1-structure";
import { f2Dict } from "./f2-plan";
import { f3Dict } from "./f3-inp";
import { f4Dict } from "./f4-jobs";
import { f5Dict } from "./f5-report";
import { f6Dict } from "./f6-benchmark";

/** 모든 기능 사전을 한 곳에서 합성(키 충돌 시 뒤에 오는 것이 우선이나, 기능별 prefix 권장). */
const REGISTRY: Dict[] = [
  commonDict,
  f1Dict,
  f2Dict,
  f3Dict,
  f4Dict,
  f5Dict,
  f6Dict,
];

function mergeDicts(dicts: Dict[]): Dict {
  const out: Dict = { ko: {}, en: {} };
  for (const d of dicts) {
    Object.assign(out.ko, d.ko);
    Object.assign(out.en, d.en);
  }
  return out;
}

export const MESSAGES: Dict = mergeDicts(REGISTRY);

export const LANG_STORAGE_KEY = "cp2k_agent_lang";

/**
 * 키를 현재 언어로 번역. {param} 치환 지원.
 * 키가 없으면 키 문자열을 그대로 반환(개발 중 누락 가시화).
 */
export function translate(
  lang: Lang,
  key: string,
  params?: Record<string, string | number>
): string {
  const table = MESSAGES[lang] ?? MESSAGES.ko;
  let value = table[key] ?? MESSAGES.ko[key] ?? key;
  if (params) {
    for (const [p, v] of Object.entries(params)) {
      value = value.replace(new RegExp(`\\{${p}\\}`, "g"), String(v));
    }
  }
  return value;
}
