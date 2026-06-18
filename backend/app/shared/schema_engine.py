"""app/shared/schema_engine.py — CP2K 스키마 인식 거버넌스 엔진 (be/04 §A 재구현).

34MB CP2K 입력 스키마(`cp2k_input.xml`)를 인덱싱해, 플랜(f2)이 낸 경로형 옵션을 **실제 스키마
계층의 올바른 위치로 재배치(relocate)** 하고, **물리 정합성을 강제**한 뒤 스키마 인식 트리로
렌더한다(문자열 템플릿 금지 — CLAUDE.md §5 환각 방지).

핵심 공개 표면(반드시 둘 다 노출):
  engine = CP2KSchemaEngine()                  # 모듈 싱글톤
  def get_manual_snippet(token) -> str         # 모듈 함수 (= engine.get_manual_snippet)

f2(plan)·f4(self_healing)는 `from app.shared.schema_engine import engine`(또는 모듈함수)로
`get_manual_snippet` 을 호출한다 — `from ... import schema_engine`(존재하지 않는 이름) 금지.
"""

from __future__ import annotations

import copy
import json
import os
import pickle
import re
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Tuple

from app.shared.options import (
    deep_merge,
    parse_path_based_options,
    tree_to_lines,
)

_HERE = os.path.dirname(os.path.abspath(__file__))
_XML_PATH = os.path.join(_HERE, "cp2k_input.xml")
_CACHE_PATH = os.path.join(_HERE, "cp2k_input.xml.cache.pkl")
_BASIS_MAP_PATH = os.path.join(_HERE, "basis_map.json")

# 프루닝 시 ROOT 직속/대표 표준 섹션 (★ 20개 전부 — '...' 금지)
STANDARD_SECTIONS = [
    "DFT", "SCF", "MGRID", "SUBSYS", "CELL", "COORD", "MOTION", "GEO_OPT",
    "MD", "PROPERTIES", "TDDFPT", "XC", "XC_FUNCTIONAL", "GLOBAL", "FORCE_EVAL",
    "EXT_RESTART", "VIBRATIONAL_ANALYSIS", "FARMING", "OPTIMIZE_BASIS", "TEST",
]

# resolve_files 표준 basis 파일 목록
STANDARD_BASIS_FILES = [
    "GTH_BASIS_SETS", "BASIS_MOLOPT", "BASIS_SET", "HFX_BASIS", "EMSL_BASIS_SETS",
]

# XC_FUNCTIONAL 의 SECTION_PARAMETERS 로 인정하는 functional 이름
_XCF_PARAMS = ["PBE", "BLYP", "PADE", "LDA", "GPW", "TPSS", "B3LYP"]

# 데모용 고정 NSTATES (운영 전환 시 None 이면 plan 값 유지)
_DEMO_TDDFPT_NSTATES: Optional[int] = 5


def _deep_update(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """in-place 재귀 병합 (self_healing 이 위임). update 가 이김."""
    if not isinstance(base, dict) or not isinstance(update, dict):
        return update
    for k, v in update.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            _deep_update(base[k], v)
        else:
            base[k] = v
    return base


def _is_float(s: str) -> bool:
    try:
        float(s)
        return True
    except (ValueError, TypeError):
        return False


class CP2KSchemaEngine:
    """cp2k_input.xml 인덱스 기반 옵션 거버넌스/렌더 엔진."""

    def __init__(self):
        self.forward: Dict[Tuple[str, ...], Dict[str, Any]] = {}
        self.sections: set = set()
        self.alias_map: Dict[Tuple[Tuple[str, ...], str], str] = {}
        self.basis_map: Dict[str, str] = {}
        self._load_basis_map()
        self._load_schema()

    # ── A-1. 스키마 인덱싱 ────────────────────────────────────────────────
    def _load_basis_map(self):
        try:
            with open(_BASIS_MAP_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.basis_map = data.get("file_mapping", {}) or {}
        except Exception:
            self.basis_map = {}

    def _load_schema(self):
        if os.path.exists(_CACHE_PATH):
            try:
                with open(_CACHE_PATH, "rb") as f:
                    cached = pickle.load(f)
                self.forward = cached["forward"]
                self.sections = cached["sections"]
                self.alias_map = cached["alias_map"]
                return
            except Exception:
                pass  # 캐시 손상 → 재파싱

        tree = ET.parse(_XML_PATH)
        root = tree.getroot()
        # ROOT 경로로 walk 시작 (root element 자체가 ROOT)
        self._walk(root, ("ROOT",))

        try:
            with open(_CACHE_PATH, "wb") as f:
                pickle.dump(
                    {
                        "forward": self.forward,
                        "sections": self.sections,
                        "alias_map": self.alias_map,
                    },
                    f,
                    protocol=pickle.HIGHEST_PROTOCOL,
                )
        except Exception:
            pass  # 캐시 쓰기 실패는 치명 아님

    def _section_names(self, sec_el) -> List[str]:
        names = [n.text.strip().upper() for n in sec_el.findall("NAME")
                 if n is not None and n.text]
        if not names:
            return []
        return names

    def _keyword_meta(self, kw_el) -> Tuple[List[str], Dict[str, Any]]:
        names = [n.text.strip().upper() for n in kw_el.findall("NAME")
                 if n is not None and n.text]
        dt = kw_el.find("DATA_TYPE")
        kind = dt.get("kind") if dt is not None else None
        dv = kw_el.find("DEFAULT_VALUE")
        default = dv.text.strip() if (dv is not None and dv.text) else None
        enums = [i.find("NAME").text.strip().upper()
                 for i in kw_el.findall(".//ENUMERATION/ITEM")
                 if i.find("NAME") is not None and i.find("NAME").text]
        meta = {
            "type": "keyword",
            "repeats": (kw_el.get("repeats", "no") == "yes"),
            "DEFAULT": default,
            "ENUM": enums or None,
            "KIND": kind,
        }
        return names, meta

    def _walk(self, sec_el, path: Tuple[str, ...]):
        """재귀로 forward/sections/alias_map 채움. sec_el 은 SECTION(또는 ROOT)."""
        # 현재 경로 마지막 = 섹션명
        sec_name = path[-1]
        self.sections.add(sec_name)

        entry = self.forward.setdefault(path, {"keywords": {}, "sub_sections": []})
        # 섹션 메타: repeats, SECTION_PARAMETERS 존재 여부
        entry["repeats"] = (sec_el.get("repeats", "no") == "yes")
        entry["has_params"] = (sec_el.find("SECTION_PARAMETERS") is not None)

        # KEYWORD 들
        for kw in sec_el.findall("KEYWORD"):
            names, meta = self._keyword_meta(kw)
            if not names:
                continue
            primary = names[0]
            entry["keywords"][primary] = meta
            for alias in names:
                self.alias_map[(path, alias)] = primary

        # 하위 SECTION 들
        for sub in sec_el.findall("SECTION"):
            sub_names = self._section_names(sub)
            if not sub_names:
                continue
            sub_primary = sub_names[0]
            if sub_primary not in entry["sub_sections"]:
                entry["sub_sections"].append(sub_primary)
            # 섹션 이름 별칭도 alias_map 에 등록
            for alias in sub_names:
                self.alias_map[(path, alias)] = sub_primary
            self._walk(sub, path + (sub_primary,))

    # ── 도우미: 경로 유효성/탐색 ──────────────────────────────────────────
    def _is_valid_at_path(self, name: str, path: Tuple[str, ...], is_section: bool) -> bool:
        entry = self.forward.get(path)
        if not entry:
            return False
        if is_section:
            return name in entry.get("sub_sections", [])
        return name in entry.get("keywords", {})

    def fuzzy_correct(self, name: str, path: Tuple[str, ...]) -> Optional[str]:
        """alias_map → 현재경로 keyword/sub_section → 전역 sections 순으로 정식명 찾기."""
        name_up = name.upper()
        # 1) alias_map (현재 경로 기준 정식명)
        alias = self.alias_map.get((path, name_up))
        if alias:
            return alias
        entry = self.forward.get(path, {})
        # 2) 현재 경로 keyword
        if name_up in entry.get("keywords", {}):
            return name_up
        # 3) 현재 경로 sub_section
        if name_up in entry.get("sub_sections", []):
            return name_up
        # 4) 전역 섹션 (다른 경로에 존재)
        if name_up in self.sections:
            return name_up
        return None

    def _score_path(self, candidate: Tuple[str, ...], current: Tuple[str, ...]) -> int:
        """현재 경로와 동일 prefix 성분 수 (첫 불일치에서 중단)."""
        score = 0
        for a, b in zip(candidate, current):
            if a == b:
                score += 1
            else:
                break
        return score

    def _find_best_parent(
        self, name: str, current_path: Tuple[str, ...], is_section: bool
    ) -> Tuple[str, ...]:
        """name 을 배치할 최적 부모 경로. 현재 경로에 유효하면 맥락 우선."""
        if self._is_valid_at_path(name, current_path, is_section):
            return current_path
        # forward 에서 name 을 (섹션이면 자식으로) 가진 경로 수집
        candidates: List[Tuple[str, ...]] = []
        for p, entry in self.forward.items():
            if is_section:
                if name in entry.get("sub_sections", []):
                    candidates.append(p)
            else:
                if name in entry.get("keywords", {}):
                    candidates.append(p)
        if not candidates:
            return current_path
        candidates.sort(key=lambda p: self._score_path(p, current_path), reverse=True)
        return candidates[0]

    # ── A-2. validate_and_relocate ───────────────────────────────────────
    def normalize_dict_keys(self, d: Any) -> Any:
        """모든 키 UPPER + 재귀, 충돌 시 deep merge.

        ★ `_SECTION_PARAMETERS_`(밑줄 양쪽 변종) → 정식 `SECTION_PARAMETERS` 로 정규화.
        """
        if not isinstance(d, dict):
            return d
        out: Dict[str, Any] = {}
        for k, v in d.items():
            ku = str(k).upper()
            if ku == "_SECTION_PARAMETERS_":
                ku = "SECTION_PARAMETERS"
            nv = self.normalize_dict_keys(v) if isinstance(v, dict) else v
            if ku in out and isinstance(out[ku], dict) and isinstance(nv, dict):
                out[ku] = deep_merge(out[ku], nv)
            else:
                out[ku] = nv
        return out

    def validate_and_relocate(
        self, raw_options: Dict[str, Any], mandatory: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], List[str]]:
        logs: List[str] = []
        force_sync = bool(mandatory.get("force_sync"))

        # 1. 키 정규화
        opts = self.normalize_dict_keys(copy.deepcopy(raw_options) if raw_options else {})

        # 2. 환각 보정: EXCITATION_KIND → TDDFPT/RKS_TRIPLETS
        def _scan_excitation(node: Any):
            found = None
            if isinstance(node, dict):
                for k, v in node.items():
                    if "EXCITATION_KIND" in str(k).upper():
                        found = str(v).upper()
                    sub = _scan_excitation(v)
                    if sub is not None:
                        found = sub
            return found

        exc = _scan_excitation(opts)
        if exc is not None:
            rks = "T" if "TRIPLET" in exc else "F"
            fe = opts.setdefault("FORCE_EVAL", {})
            props = fe.setdefault("PROPERTIES", {})
            tddfpt = props.setdefault("TDDFPT", {})
            tddfpt["RKS_TRIPLETS"] = rks
            logs.append(f"[FIX] EXCITATION_KIND → TDDFPT/RKS_TRIPLETS {rks}")

        # 3. 프루닝 (force_sync 아니면)
        if not force_sync:
            clean = {
                k: v for k, v in opts.items()
                if k and (
                    k.split("_DUPL_")[0].split()[0].upper() in STANDARD_SECTIONS
                    or "/" in k
                )
            }
        else:
            clean = opts

        # 4. govern + enforce
        governed_root: Dict[str, Any] = {}
        self._recursive_govern(clean, ("ROOT",), governed_root, logs, set(),
                               governed_root, force_sync)
        self._enforce_physics(governed_root, mandatory, logs)
        return governed_root, logs

    # ── A-3. _recursive_govern ───────────────────────────────────────────
    _META_KEYS = {"@CHILDREN", "@PARAM", "SECTION_PARAMETERS", "_EXIST"}

    def _recursive_govern(
        self,
        options: Dict[str, Any],
        current_path: Tuple[str, ...],
        current_dic: Dict[str, Any],
        logs: List[str],
        tokens: set,
        global_root: Dict[str, Any],
        force_sync: bool,
    ):
        if not isinstance(options, dict):
            return
        for raw_key, value in list(options.items()):
            k = str(raw_key)
            k_up = k.upper()

            # 메타 키는 통과
            if k_up in self._META_KEYS:
                current_dic[k_up if k_up != "SECTION_PARAMETERS" else k_up] = value
                continue
            # ROOT 키는 펼침
            if k_up == "ROOT" and isinstance(value, dict):
                self._recursive_govern(value, current_path, current_dic, logs,
                                       tokens, global_root, force_sync)
                continue

            # 공백 분리 (KIND H → k=KIND, param=H)
            param = None
            base_k = k
            if " " in k.strip():
                parts = k.strip().split(None, 1)
                base_k = parts[0]
                param = parts[1] if len(parts) > 1 else None

            # ★ _DUPL_N 접미사는 fuzzy_correct 전에 벗긴다
            base_clean = base_k.split("_DUPL_")[0]

            # 섹션/키워드 판정
            is_section = isinstance(value, dict)
            base_up = base_clean.upper()
            if not is_section:
                entry = self.forward.get(current_path, {})
                if base_up in entry.get("keywords", {}):
                    is_section = False
                elif base_up in self.sections:
                    is_section = True

            # 좌표 가드 (★ return — 형제까지 중단)
            if not is_section:
                toks = str(k).split()
                if len(toks) >= 4 and all(_is_float(t) for t in toks[1:4]):
                    logs.append(f"[REJECT] Coordinate-like leaked key: {k}")
                    return
                if base_up == "KIND" and param is None:
                    logs.append("[REJECT] Bare KIND without element")
                    return

            # 정식명
            target_name = self.fuzzy_correct(base_clean, current_path)
            if not target_name:
                if base_clean.startswith("@"):
                    current_dic[k] = value  # 전처리 지시문 보존
                    continue
                # ★ 환각: force_sync 여도 보존하지 않음
                if is_section:
                    logs.append(f"[PRUNE] Unknown section: {base_clean}")
                else:
                    logs.append(f"[PRUNE] Unknown: {base_clean}")
                continue

            # best parent 탐색
            best = self._find_best_parent(target_name, current_path, is_section)

            # ★ 재배치 거리 가드 (섹션) — 무관한 먼 가지면 프루닝
            if is_section and best != current_path:
                shared = self._score_path(best, current_path)
                if shared < len(current_path) - 1:
                    logs.append(f"[PRUNE] Distant relocation rejected: {target_name}")
                    continue

            # 타겟 부모로 내려감
            target_root = current_dic
            target_path = current_path
            if best != current_path:
                # best 경로로 setdefault 하며 내려감 (ROOT 이후 성분)
                target_root = global_root
                walk_path: Tuple[str, ...] = ("ROOT",)
                for seg in best[1:]:
                    target_root = target_root.setdefault(seg, {})
                    walk_path = walk_path + (seg,)
                target_path = best

            # repeats/KIND actual_key
            sec_entry = self.forward.get(target_path + (target_name,), {})
            repeats = sec_entry.get("repeats", False)
            if repeats or target_name == "KIND":
                if param:
                    actual_key = f"{target_name} {param.upper()}"
                elif "_DUPL_" in base_k:
                    actual_key = f"{target_name}_DUPL_{base_k.split('_DUPL_')[1]}"
                else:
                    has_dupl_sibling = any(
                        str(sk).startswith(f"{target_name}_DUPL_")
                        for sk in target_root.keys()
                    )
                    if has_dupl_sibling:
                        logs.append(f"[PRUNE] redundant bare section: {target_name}")
                        continue
                    actual_key = target_name
            else:
                actual_key = target_name

            if is_section:
                # 값이 문자열이면 dict 화
                if isinstance(value, str):
                    sval = value
                    if sval.upper().startswith("SECTION_PARAMETERS "):
                        sval = sval[len("SECTION_PARAMETERS "):].strip()
                    sval = sval.strip()
                    if target_name == "XC_FUNCTIONAL" and sval.upper() in _XCF_PARAMS:
                        value = {sval.upper(): {}}
                    elif sval:
                        value = {"@param": sval}
                    else:
                        value = {"@children": []}
                elif isinstance(value, dict):
                    value = copy.deepcopy(value)
                    # SECTION_PARAMETERS → @param 승격
                    for spk in ("SECTION_PARAMETERS", "@PARAM", "@CHILDREN", "_EXIST"):
                        if spk in value:
                            lower = {
                                "SECTION_PARAMETERS": "@param",
                                "@PARAM": "@param",
                                "@CHILDREN": "@children",
                                "_EXIST": "_exist",
                            }[spk]
                            if lower not in value or value.get(lower) in (None, "", []):
                                value[lower] = value[spk]
                            if spk != lower:
                                value.pop(spk, None)
                else:
                    value = {"@children": []}

                child_dic = target_root.setdefault(actual_key, {})
                if not isinstance(child_dic, dict):
                    child_dic = {}
                    target_root[actual_key] = child_dic
                self._recursive_govern(value, target_path + (target_name,), child_dic,
                                       logs, tokens, global_root, force_sync)
            else:
                # 키워드
                kw_entry = self.forward.get(target_path, {}).get("keywords", {}).get(
                    target_name, {})
                if kw_entry.get("repeats"):
                    cur = target_root.get(actual_key)
                    if isinstance(cur, list):
                        cur.append(value)
                    elif cur is not None:
                        target_root[actual_key] = [cur, value]
                    else:
                        target_root[actual_key] = [value] if not isinstance(value, list) else value
                else:
                    if isinstance(target_root.get(actual_key), dict) and isinstance(value, dict):
                        for vk, vv in value.items():
                            target_root[actual_key][str(vk).upper()] = vv
                    else:
                        target_root[actual_key] = value

    # ── A-7. resolve_files ───────────────────────────────────────────────
    def resolve_files(
        self, basis: str, functional: str, mandatory: Dict[str, Any]
    ) -> Tuple[str, str]:
        basis = (basis or "").strip()
        functional = (functional or "").strip()
        b_file = mandatory.get("basis_file")
        p_file = mandatory.get("pot_file")

        if b_file and (b_file == "ALL_BASIS_SETS" or b_file not in STANDARD_BASIS_FILES):
            b_file = None

        if not b_file:
            bu = basis.upper()
            fu = functional.upper()
            mapped = self.basis_map.get(bu)
            if mapped:
                if mapped == "BASIS_MOLOPT_UCL" and "UCL" not in bu:
                    b_file = "BASIS_MOLOPT"
                else:
                    b_file = mapped
            elif "MOLOPT" in bu:
                b_file = "BASIS_MOLOPT"
            elif "-GTH" in bu:
                b_file = "GTH_BASIS_SETS"
            elif "6-31" in bu or "CC-P" in bu or "AUG-CC" in bu:
                b_file = "BASIS_SET"
            elif "DEF2" in bu:
                b_file = "BASIS_def2_QZVP_RI_ALL"
            elif any(g in fu for g in ("PBE", "PADE", "BLYP", "LDA")):
                b_file = "GTH_BASIS_SETS"
            else:
                b_file = "GTH_BASIS_SETS BASIS_MOLOPT BASIS_SET"

        if not p_file:
            fu = functional.upper()
            if "HFX" in fu or "HYB" in fu:
                p_file = "HFX_BASIS"
            else:
                p_file = "GTH_POTENTIALS"

        return b_file, p_file

    # ── A-4. _enforce_physics ────────────────────────────────────────────
    def _enforce_physics(
        self, root: Dict[str, Any], mandatory: Dict[str, Any], logs: List[str]
    ):
        try:
            force_sync = bool(mandatory.get("force_sync"))

            def set_if_missing(d: Dict[str, Any], k: str, v: Any):
                if v is None:
                    return
                if (k not in d) or (force_sync and v is not None):
                    d[k] = v

            atom_info = mandatory.get("atom_info") or {}
            elements = atom_info.get("elements") or list(
                (atom_info.get("element_counts") or {}).keys())
            func = (mandatory.get("functional") or "PBE")
            basis = (mandatory.get("basis_set") or "")

            # 1. GLOBAL
            glob = root.setdefault("GLOBAL", {})
            glob["PROJECT_NAME"] = "CP2K_AGENT_FORCE_WRITE_V1"  # 무조건
            run_type = str(mandatory.get("run_type", "ENERGY")).upper()
            set_if_missing(glob, "RUN_TYPE", run_type)

            fe = root.setdefault("FORCE_EVAL", {})
            dft = fe.setdefault("DFT", {})

            # 2. METHOD (무조건)
            req_method = str(mandatory.get("method") or "GPW").upper()
            qs = dft.setdefault("QS", {})
            if req_method == "QUICKSTEP":
                fe["METHOD"] = "QUICKSTEP"
                qs.pop("METHOD", None)
            else:
                qs["METHOD"] = req_method
                fe.pop("METHOD", None)
            if not qs:
                dft.pop("QS", None)

            # 3. 파일 해석
            b_file, p_file = self.resolve_files(basis, func, mandatory)
            cur_b = dft.get("BASIS_SET_FILE_NAME")
            if (cur_b is None) or ("BASIS_SET" in str(cur_b).upper()) or (not force_sync):
                dft["BASIS_SET_FILE_NAME"] = b_file
            cur_p = dft.get("POTENTIAL_FILE_NAME")
            if (cur_p is None) or ("POTENTIAL" in str(cur_p).upper()) or (not force_sync):
                dft["POTENTIAL_FILE_NAME"] = p_file

            subsys = fe.setdefault("SUBSYS", {})

            # 4. SUBSYS — COORD / CELL / KIND
            def _tree_has_key_containing(node: Any, needle: str) -> bool:
                if isinstance(node, dict):
                    for k, v in node.items():
                        if needle in str(k).upper():
                            return True
                        if _tree_has_key_containing(v, needle):
                            return True
                return False

            # COORD
            if _tree_has_key_containing(subsys, "COORD_FILE_NAME") or \
               _tree_has_key_containing(dft, "COORD_FILE_NAME"):
                subsys.pop("COORD", None)
            else:
                coord_text = atom_info.get("full_coord_text", "") or ""
                coord_lines = [ln for ln in coord_text.splitlines() if ln.strip()]
                coord = subsys.setdefault("COORD", {})
                coord["@children"] = coord_lines
                if atom_info.get("use_scaled"):
                    coord["SCALED"] = ".TRUE."
                else:
                    coord.pop("SCALED", None)

            # CELL
            periodic = (mandatory.get("periodic") or atom_info.get("periodic") or "XYZ")
            poisson = dft.get("POISSON", {})
            if isinstance(poisson, dict) and str(poisson.get("PERIODIC", "")).upper() == "NONE":
                periodic = "NONE"
            cell = subsys.setdefault("CELL", {})
            cell["PERIODIC"] = periodic
            cvec = atom_info.get("cell") or []
            if len(cvec) >= 3:
                c0, c1, c2 = float(cvec[0]), float(cvec[1]), float(cvec[2])
                cell["ABC"] = f"{c0:.10f} {c1:.10f} {c2:.10f}"
            full_cell = atom_info.get("full_cell_text", "") or ""
            m = re.search(r"ALPHA_BETA_GAMMA\s+([\d\.\s]+)", full_cell)
            if m:
                cell["ALPHA_BETA_GAMMA"] = m.group(1).strip()

            # KIND per element
            b_up = b_file.upper()
            if "GTH_BASIS" in b_up and "MOLOPT" in basis.upper():
                basis_name = "DZVP-GTH"
            elif "BASIS_SET" in b_up and "MOLOPT" in basis.upper():
                func_suffix = "PADE" if "PADE" in func.upper() else (
                    "PBE" if "PBE" in func.upper() else "PADE")
                basis_name = f"DZVP-GTH-{func_suffix}"
            else:
                basis_name = basis or "DZVP-MOLOPT-GTH"
            default_pot = "GTH-PBE" if "PBE" in func.upper() else "GTH-PADE"
            pot_map: Dict[str, str] = {}
            for el in set(elements):
                el_up = str(el).upper()
                kind_key = f"KIND {el_up}"
                existing = subsys.get(kind_key)
                has_basis = isinstance(existing, dict) and "BASIS_SET" in existing
                has_pot = isinstance(existing, dict) and "POTENTIAL" in existing
                if (not isinstance(existing, dict)) or (not has_basis and not has_pot):
                    subsys[kind_key] = {
                        "BASIS_SET": basis_name,
                        "POTENTIAL": pot_map.get(el_up, default_pot),
                    }

            # 5. XC
            has_xc_directive = any(str(k).upper().startswith("@XC") for k in dft.keys())
            if not has_xc_directive and func:
                xc = dft.setdefault("XC", {})
                xc_sec = xc.setdefault("XC_FUNCTIONAL", {})
                if not force_sync:
                    xc_sec.clear()
                xc_sec["@param"] = func.upper()
                xc_sec.pop(func.upper(), None)

            # 6. OT vs DIAGONALIZATION
            scf = dft.setdefault("SCF", {})
            kpts_val = mandatory.get("kpoints")
            valid_kpts = bool(kpts_val) and str(kpts_val).strip().upper() not in (
                "", "NONE", "NULL", "GAMMA", "GAMMA-POINT")
            has_kpts = ("KPOINTS" in dft) or valid_kpts
            is_tddfpt = (run_type == "TDDFPT" or "TDDFPT" in dft or
                         _tree_has_key_containing(fe, "TDDFPT"))
            use_smear = mandatory.get("use_smear")

            def _read_nstates() -> int:
                try:
                    n = fe.get("PROPERTIES", {}).get("TDDFPT", {}).get("NSTATES")
                    return int(n) if n else 20
                except Exception:
                    return 20

            if has_kpts or is_tddfpt or use_smear is True:
                scf.setdefault("DIAGONALIZATION", {})
                scf.pop("OT", None)
                if is_tddfpt:
                    if "ADDED_MOS" not in scf:
                        nstates = _read_nstates()
                        scf["ADDED_MOS"] = str(max(nstates, 20))
                    # NSTATES 데모 고정
                    try:
                        tddfpt = fe.setdefault("PROPERTIES", {}).setdefault("TDDFPT", {})
                        if _DEMO_TDDFPT_NSTATES is not None:
                            tddfpt["NSTATES"] = str(_DEMO_TDDFPT_NSTATES)
                    except Exception:
                        pass
                if has_kpts and not is_tddfpt:
                    kp = dft.setdefault("KPOINTS", {})
                    kp["SYMMETRY"] = "F"
                    if valid_kpts:
                        k = str(kpts_val).strip()
                        if "MONKHORST" in k.upper():
                            kp["SCHEME"] = k
                        else:
                            kp["SCHEME"] = "MONKHORST-PACK " + k
            else:
                scf_algo = str(mandatory.get("scf_algo") or "").upper()
                if not scf_algo:
                    if "OT" in scf:
                        scf_algo = "OT"
                    elif "DIAGONALIZATION" in scf:
                        scf_algo = "DIAGONALIZATION"
                    else:
                        scf_algo = "OT"
                if scf_algo == "OT":
                    ot = scf.setdefault("OT", {})
                    ot.setdefault("MINIMIZER", "DIIS")
                    ot.setdefault("PRECONDITIONER", "FULL_SINGLE_INVERSE")
                    scf.pop("DIAGONALIZATION", None)
                    scf.pop("MIXING", None)
                else:
                    scf.setdefault("DIAGONALIZATION", {})
                    scf.pop("OT", None)

            # 7. 최종 (없을 때만)
            mgrid = dft.setdefault("MGRID", {})
            set_if_missing(mgrid, "CUTOFF", mandatory.get("cutoff"))
            set_if_missing(scf, "EPS_SCF", mandatory.get("eps_scf"))
            set_if_missing(scf, "MAX_SCF", mandatory.get("max_scf"))
            if mandatory.get("ignore_scf_failure"):
                scf["IGNORE_CONVERGENCE_FAILURE"] = ".TRUE."
            if use_smear is False:
                scf.pop("SMEAR", None)
        except Exception as e:
            logs.append(f"[PHYSICS] enforcement skipped due to error: {e}")

    # ── A-5. dict_to_tree_schema_aware ───────────────────────────────────
    def dict_to_tree_schema_aware(
        self, options: Dict[str, Any], current_path: Tuple[str, ...] = ("ROOT",)
    ) -> List[Dict[str, Any]]:
        """거버넌스 dict → 렌더 노드 리스트."""
        nodes: List[Dict[str, Any]] = []
        if not isinstance(options, dict):
            return nodes
        for key, value in options.items():
            k = str(key)
            k_up = k.upper()
            if k_up in ("@PARAM", "@CHILDREN", "_EXIST", "SECTION_PARAMETERS"):
                continue  # 부모 노드가 흡수

            # 순수명 / param (공백 또는 _DUPL_ 앞)
            if " " in k.strip():
                pure, key_param = k.strip().split(None, 1)
            else:
                pure, key_param = k, None
            pure = pure.split("_DUPL_")[0]
            pure_up = pure.upper()

            if k_up == "@CHILDREN" or key == "@children":
                continue

            if isinstance(value, dict):
                # 섹션 노드
                param = key_param
                if "@param" in value:
                    param = value.get("@param")
                children = self.dict_to_tree_schema_aware(
                    value, current_path + (pure_up,))
                # @children freetext
                ch = value.get("@children")
                if isinstance(ch, list):
                    for line in ch:
                        children.append({"type": "freetext", "text": str(line)})
                nodes.append({
                    "type": "section",
                    "name": pure,
                    "param": param,
                    "children": children,
                })
            elif isinstance(value, list):
                # 반복 keyword 노드들
                for item in value:
                    nodes.append(self._keyword_node(pure, item, current_path))
            else:
                nodes.append(self._keyword_node(pure, value, current_path))
        return nodes

    def _keyword_node(self, name: str, value: Any, current_path: Tuple[str, ...]):
        name_up = name.upper()
        kw = self.forward.get(current_path, {}).get("keywords", {}).get(name_up, {})
        val = value
        if val is not None and not isinstance(val, (dict, list)):
            enum = kw.get("ENUM")
            if enum and str(val).upper() in enum:
                val = str(val).upper()
        return {"type": "keyword", "name": name, "value": val}

    # ── A-6. get_manual_snippet ──────────────────────────────────────────
    def get_manual_snippet(self, token: str) -> str:
        """경로 끝이 token 인 섹션/해당 token 키워드를 찾아 스니펫(최대 5개)."""
        if not token:
            return ""
        token_up = str(token).upper()
        snippets: List[str] = []

        # 섹션 매치
        for path, entry in self.forward.items():
            if path and path[-1] == token_up:
                kws = list(entry.get("keywords", {}).keys())
                subs = entry.get("sub_sections", [])
                snip = (
                    f"### [SECTION] {'/'.join(path)}\n"
                    f"Keywords: {', '.join(kws[:20]) or '(none)'}\n"
                    f"Sub-sections: {', '.join(subs[:20]) or '(none)'}"
                )
                snippets.append(snip)
                if len(snippets) >= 5:
                    return "\n\n".join(snippets)

        # 키워드 매치
        for path, entry in self.forward.items():
            kw = entry.get("keywords", {}).get(token_up)
            if kw:
                snip = (
                    f"### [KEYWORD] {'/'.join(path)}/{token_up}\n"
                    f"Default: {kw.get('DEFAULT')}\n"
                    f"Enums: {', '.join(kw.get('ENUM') or []) or '(none)'}\n"
                    f"Type: {kw.get('KIND')}"
                )
                snippets.append(snip)
                if len(snippets) >= 5:
                    break

        return "\n\n".join(snippets)


# ── 모듈 싱글톤 + 모듈 함수 (외부 노출 2가지 — 둘 다 필수) ──────────────────
engine = CP2KSchemaEngine()


def get_manual_snippet(token: str) -> str:
    """모듈 레벨 get_manual_snippet (= engine.get_manual_snippet)."""
    return engine.get_manual_snippet(token)


# self_healing 이 위임하는 _deep_update 도 노출
def deep_update(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    return _deep_update(base, update)
