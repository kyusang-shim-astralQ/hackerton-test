"""app/shared/options.py — 경로형 옵션 파싱·병합·렌더 유틸 (be/04 §B 재구현).

플랜(f2)/제출(f4)이 내는 **경로형 옵션**(`"FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6"`, `&` 없이
`/` 구분 FULL PATH)을 중첩 dict 로 파싱하고, custom_options 를 step 별로 병합하며, 거버넌스를
거친 트리를 다시 `.inp` 줄로 렌더한다. f3-inp 의 build_full_inp 와 f4-jobs 가 공유한다.

공개 심볼:
  parse_path_based_options(lines)  : list[str] → 중첩 dict (중복 키는 list)
  deep_merge(base, update)         : 재귀 dict 병합 (update 가 이김)
  merge_custom_options(tree, custom, step_idx) : custom 을 step 별 병합 (step{i}/ 접두 분기)
  resolve_smart_placeholders(...)  : FIXED_ATOMS ELEMENTS → 1-based 인덱스 치환
  tree_to_lines(node)              : section/keyword/freetext 노드 트리 → .inp 줄 리스트
"""

from __future__ import annotations

import copy
import re
from typing import Any, Dict, List

# 경로형 옵션 한 줄: (선택적 경로/)KEY (값) 형태.
#   "FORCE_EVAL/DFT/SCF/EPS_SCF 1.0E-6" → path="FORCE_EVAL/DFT/SCF/", key="EPS_SCF", val="1.0E-6"
#   "MOTION/GEO_OPT/OPTIMIZER BFGS"     → ...
_LINE_RE = re.compile(r"^(.*/)?([A-Za-z0-9_]+)(?:\s+(.*))?$")


def parse_path_based_options(lines: List[str]) -> Dict[str, Any]:
    """경로형 옵션 줄 리스트 → 중첩 dict.

    각 줄을 `^(.*/)?([A-Za-z0-9_]+)(?:\\s+(.*))?$` 로 분해하여 경로/키/값을 얻고,
    `&` 를 제거한 뒤 `/` 로 split 해 중첩 dict 로 쌓는다. 같은 위치에 키가 여러 번 오면
    list 로 누적한다(반복 키워드 지원).
    """
    root: Dict[str, Any] = {}
    if not isinstance(lines, list):
        return root
    for raw in lines:
        if not isinstance(raw, str):
            continue
        line = raw.strip()
        if not line:
            continue
        m = _LINE_RE.match(line)
        if not m:
            continue
        path_part = (m.group(1) or "").replace("&", "")
        key = m.group(2).replace("&", "").strip()
        value = m.group(3)
        value = value.strip() if value is not None else ""

        # 경로 성분(상위 섹션) + 마지막 키
        segments = [s for s in path_part.split("/") if s]
        node = root
        for seg in segments:
            seg = seg.strip()
            if not seg:
                continue
            existing = node.get(seg)
            if not isinstance(existing, dict):
                node[seg] = {}
            node = node[seg]

        # 마지막 키 = 값(스칼라) 또는 섹션(값 없음)
        if value == "":
            # 섹션으로 취급 (이미 dict 면 유지)
            if not isinstance(node.get(key), dict):
                node[key] = {}
        else:
            if key in node:
                cur = node[key]
                if isinstance(cur, list):
                    cur.append(value)
                else:
                    node[key] = [cur, value]
            else:
                node[key] = value
    return root


def deep_merge(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """재귀 dict 병합. update 의 값이 우선(이김). 양쪽이 dict 면 재귀.

    in-place 가 아니라 base 의 deepcopy 를 갱신해 반환한다(부수효과 방지).
    """
    if not isinstance(base, dict):
        return copy.deepcopy(update) if isinstance(update, dict) else update
    result = copy.deepcopy(base)
    if not isinstance(update, dict):
        return result
    for k, v in update.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = deep_merge(result[k], v)
        else:
            result[k] = copy.deepcopy(v)
    return result


def merge_custom_options(
    tree: Dict[str, Any], custom: Dict[str, Any], step_idx: int = 1
) -> Dict[str, Any]:
    """custom_options 를 step 별로 병합.

    custom 은 (1) 경로형 줄 리스트, (2) `{경로문자열: 값}` dict, (3) 이미 중첩된 dict 형태가
    올 수 있다. `step{i}/` 접두 경로는 해당 스텝에만, 비접두 경로는 전 스텝 공통으로 적용한다.
    """
    base = copy.deepcopy(tree) if isinstance(tree, dict) else {}
    if not custom:
        return base

    lines: List[str] = []

    def _collect(prefix: str, obj: Any):
        if isinstance(obj, dict):
            for k, v in obj.items():
                key = k.replace("&", "").strip()
                if isinstance(v, dict):
                    _collect(f"{prefix}{key}/", v)
                elif isinstance(v, list):
                    for item in v:
                        lines.append(f"{prefix}{key} {item}".strip())
                else:
                    lines.append(f"{prefix}{key} {v}".strip())
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, str):
                    lines.append(item.strip())

    if isinstance(custom, list):
        lines = [str(x).strip() for x in custom if str(x).strip()]
    elif isinstance(custom, dict):
        _collect("", custom)
    else:
        return base

    # step{i}/ 접두 분기: 현재 스텝에 해당하는 줄만(접두 제거) + 비접두 공통 줄
    prefix_re = re.compile(r"^step(\d+)/", re.IGNORECASE)
    applicable: List[str] = []
    for ln in lines:
        m = prefix_re.match(ln)
        if m:
            if int(m.group(1)) == step_idx:
                applicable.append(ln[m.end():])
        else:
            applicable.append(ln)

    custom_tree = parse_path_based_options(applicable)
    return deep_merge(base, custom_tree)


def resolve_smart_placeholders(
    tree: Dict[str, Any], atom_info: Dict[str, Any]
) -> Dict[str, Any]:
    """FIXED_ATOMS 의 `ELEMENTS <기호>` 플레이스홀더를 1-based 인덱스 LIST 로 치환.

    예: `MOTION/CONSTRAINT/FIXED_ATOMS/LIST ELEMENTS O` → atom_info.element_indices['O'] 의
    1-based 인덱스들을 공백 join. element_indices 가 없으면 atoms 순회로 직접 계산한다.
    원본 tree 를 deepcopy 해 치환 후 반환한다.
    """
    result = copy.deepcopy(tree) if isinstance(tree, dict) else {}
    if not isinstance(atom_info, dict):
        return result

    elem_indices = atom_info.get("element_indices") or {}
    atoms = atom_info.get("atoms") or []

    def _indices_for(symbol: str) -> List[int]:
        symbol = symbol.strip()
        if elem_indices and symbol in elem_indices:
            return list(elem_indices[symbol])
        # 폴백: atoms 순회 (1-based)
        out = []
        for i, a in enumerate(atoms, 1):
            el = a.get("element") if isinstance(a, dict) else None
            if el == symbol:
                out.append(i)
        return out

    elements_re = re.compile(r"^ELEMENTS\s+(.+)$", re.IGNORECASE)

    def _walk(node: Any):
        if isinstance(node, dict):
            for k, v in list(node.items()):
                if isinstance(v, str):
                    m = elements_re.match(v.strip())
                    if m and k.upper() in ("LIST", "LIST_EXCLUDE_QM", "LIST_EXCLUDE_MM"):
                        syms = m.group(1).split()
                        idxs: List[int] = []
                        for s in syms:
                            idxs.extend(_indices_for(s))
                        node[k] = " ".join(str(i) for i in idxs)
                else:
                    _walk(v)
        elif isinstance(node, list):
            for item in node:
                _walk(item)

    _walk(result)
    return result


# ──────────────────────────────────────────────────────────────────────────
# tree_to_lines — section/keyword/freetext 노드 트리 → .inp 텍스트 줄
#   노드 형태(schema_engine.dict_to_tree_schema_aware 가 생성):
#     {"type":"section",  "name":str, "param":str|None, "children":[...]}
#     {"type":"keyword",  "name":str, "value":str}
#     {"type":"freetext", "text":str}
# ──────────────────────────────────────────────────────────────────────────
# ROOT 자식 정렬 우선순위: GLOBAL → FORCE_EVAL → MOTION → 그 외(원순서).
_ROOT_ORDER = {"GLOBAL": 0, "FORCE_EVAL": 1, "MOTION": 2}


def tree_to_lines(node: Dict[str, Any], indent: int = 0) -> List[str]:
    """렌더 트리(노드) → CP2K `.inp` 줄 리스트. 2-space 들여쓰기.

    ROOT 섹션이면 자식을 GLOBAL/FORCE_EVAL/MOTION 순으로 정렬 후 그 외는 원순서 유지.
    """
    lines: List[str] = []
    if not isinstance(node, dict):
        return lines

    ntype = node.get("type")
    pad = "  " * indent

    if ntype == "freetext":
        text = node.get("text", "")
        # 멀티라인 freetext 는 줄 단위로 들여쓰기
        for ln in str(text).splitlines() or [str(text)]:
            lines.append(f"{pad}{ln}" if ln.strip() else ln)
        return lines

    if ntype == "keyword":
        name = node.get("name", "")
        value = node.get("value", "")
        if value is None or value == "":
            lines.append(f"{pad}{name}")
        else:
            lines.append(f"{pad}{name} {value}")
        return lines

    # section (ROOT 포함)
    name = node.get("name", "ROOT")
    children = node.get("children", []) or []

    if name == "ROOT":
        ordered = sorted(
            children,
            key=lambda c: _ROOT_ORDER.get(str(c.get("name", "")).upper(), 99),
        )
        for child in ordered:
            lines.extend(tree_to_lines(child, indent))
        return lines

    param = node.get("param")
    header = f"{pad}&{name}"
    if param not in (None, ""):
        header += f" {param}"
    lines.append(header)
    for child in children:
        lines.extend(tree_to_lines(child, indent + 1))
    lines.append(f"{pad}&END {name}")
    return lines
