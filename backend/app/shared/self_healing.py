"""app/shared/self_healing.py — CP2KHealingEngine (be/05 §B 재구현).

자가치유 엔진: 실패 로그를 진단(diagnose) → 지식베이스 처방(heal) → 조건부 AI 처방
(heal_with_ai) → validate_and_correct 로 정규화. 지식베이스는 app/shared/healing_knowledge.json
(`{signature: {reason, fixes:[경로형줄]}}`).

자가치유는 KB heal → (조건부) AI heal 두 단계뿐이며 heal_with_ai 는 3-튜플 (options, logs, msg).
@PARAM/param_overrides/byte-compare 게이트/사다리 주경로 호출은 없다(폐기된 가공물).

의존: schema_engine(validate_and_relocate / get_manual_snippet / _deep_update / build_full_inp)·
options.parse_path_based_options 는 be/04 소유라 지연·방어 import 한다(be/04 미빌드여도 앱은 뜬다).
AI 호출은 app.core.llm 경유, 프롬프트는 app/features/jobs/prompts.py(healing-prompt.md 원문).
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.shared import physics_rules

# 지식베이스 경로(이 모듈 디렉터리 = app/shared).
_KB_PATH = os.path.join(os.path.dirname(__file__), "healing_knowledge.json")

# md5("UNKNOWN") — 파싱 불가한 모든 에러가 collapse 되는 버킷. 캐시/저장에서 반드시 제외.
UNKNOWN_SIGNATURE = hashlib.md5("UNKNOWN".encode()).hexdigest()  # 696b031073e74bf2cb98e5ef201d4aa3


# ──────────────────────────────────────────────────────────────────────────
# be/04 소유 공유물 지연 import 헬퍼 (be/04 미빌드여도 import 시 죽지 않게)
# ──────────────────────────────────────────────────────────────────────────
def _parse_path_based_options(path_list):
    """app.shared.options.parse_path_based_options 위임. 미구현이면 단순 폴백 파서."""
    try:
        from app.shared.options import parse_path_based_options  # type: ignore

        return parse_path_based_options(path_list)
    except Exception:
        return _fallback_parse(path_list)


def _fallback_parse(path_list) -> Dict[str, Any]:
    """be/04 options 미구현 시 최소 경로형 파서(`&` 제거, `/` 분해, 중복은 list)."""
    root: Dict[str, Any] = {}
    if not isinstance(path_list, (list, tuple)):
        return root
    for raw in path_list:
        line = str(raw).strip()
        if not line:
            continue
        m = re.match(r"^(.*/)?([A-Za-z0-9_&]+)(?:\s+(.*))?$", line)
        if not m:
            continue
        path_part = (m.group(1) or "").strip("/")
        key = m.group(2).lstrip("&").strip()
        value = (m.group(3) or "").strip()
        node = root
        if path_part:
            for seg in path_part.split("/"):
                seg = seg.lstrip("&").strip()
                if not seg:
                    continue
                nxt = node.get(seg)
                if not isinstance(nxt, dict):
                    nxt = {}
                    node[seg] = nxt
                node = nxt
        node[key] = value
    return root


def _deep_update(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    """schema_engine._deep_update 위임. 미구현이면 재귀 deep-merge 폴백."""
    try:
        from app.shared.schema_engine import _deep_update as se_deep_update  # type: ignore

        return se_deep_update(base, update)
    except Exception:
        return _fallback_deep_update(base, update)


def _fallback_deep_update(base: Dict[str, Any], update: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(base, dict):
        return update
    for k, v in (update or {}).items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            _fallback_deep_update(base[k], v)
        else:
            base[k] = v
    return base


def _schema_validate_and_relocate(options, mandatory) -> Tuple[Dict[str, Any], List[str]]:
    """schema_engine.validate_and_relocate 위임. 미구현이면 (options, []) 통과."""
    try:
        from app.shared import schema_engine  # type: ignore

        engine = getattr(schema_engine, "engine", None)
        if engine is not None and hasattr(engine, "validate_and_relocate"):
            return engine.validate_and_relocate(options, mandatory)
        if hasattr(schema_engine, "validate_and_relocate"):
            return schema_engine.validate_and_relocate(options, mandatory)
    except Exception:
        pass
    return options, []


def _get_manual_snippet(token: str) -> str:
    """schema_engine.get_manual_snippet 위임(xml_context). 미구현이면 빈 문자열."""
    try:
        from app.shared import schema_engine  # type: ignore

        if hasattr(schema_engine, "get_manual_snippet"):
            return schema_engine.get_manual_snippet(token) or ""
        engine = getattr(schema_engine, "engine", None)
        if engine is not None and hasattr(engine, "get_manual_snippet"):
            return engine.get_manual_snippet(token) or ""
    except Exception:
        pass
    return ""


def _build_full_inp(options, atom_info, **kw) -> str:
    """build_full_inp(be/04) 위임. 미구현이면 빈 문자열(프롬프트 current_inp 폴백)."""
    try:
        from app.features.inp.service import build_full_inp  # type: ignore

        return build_full_inp(options, atom_info, **kw)
    except Exception:
        return ""


# ──────────────────────────────────────────────────────────────────────────
# CP2KHealingEngine
# ──────────────────────────────────────────────────────────────────────────
class CP2KHealingEngine:
    """진단(diagnose) → KB 처방(heal) → 조건부 AI 처방(heal_with_ai) → validate_and_correct."""

    def __init__(self) -> None:
        self.knowledge: Dict[str, Any] = self._load_knowledge()

    # --- 지식베이스 로드/저장 ---

    def _load_knowledge(self) -> Dict[str, Any]:
        try:
            with open(_KB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _save_knowledge(self) -> None:
        try:
            tmp = _KB_PATH + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self.knowledge, f, ensure_ascii=False, indent=2)
            os.replace(tmp, _KB_PATH)
        except Exception:
            pass

    # --- B-1. 로그 시그니처 ---

    def _extract_clean_abort(self, log_tail: str) -> str:
        """ABORT 박스에서 핵심 에러 텍스트 추출(드로잉 문자/파일:라인 줄 제거)."""
        m = re.search(
            r"\[ABORT\](.*?)(?=\n\s*={5,}|\n\s*===== Routine Calling Stack =====|\Z)",
            log_tail,
            re.DOTALL,
        )
        if not m:
            m = re.search(r"\*+ \[ABORT\] \*+\s*(.*?)\s*\*+", log_tail, re.DOTALL)
        if not m:
            return ""
        cleaned_lines: List[str] = []
        for raw in m.group(1).splitlines():
            line = raw.strip().strip("*").strip()
            line = re.sub(r"^\\___/\s*", "", line)
            line = re.sub(r"^\|\s*", "", line)
            line = re.sub(r"^O/\|\s*", "", line)
            line = re.sub(r"^/\|\s*\|\s*", "", line)
            line = re.sub(r"^/\s*\\\s*", "", line)
            if not line:
                continue
            if line.startswith("*****") or line.startswith("___"):
                continue
            if "/" in line and ".F:" in line:  # 파일:라인 정보 줄 버림
                continue
            cleaned_lines.append(line)
        return " ".join(cleaned_lines).strip()

    def _get_log_signature(self, log_tail: str) -> str:
        """핵심 에러를 일반화(숫자→N, 경로→PATH)해 md5 hex 반환."""
        error_msg = self._extract_clean_abort(log_tail)
        if not error_msg:
            rt = re.search(
                r"((?:Segmentation fault|KeyError|File not found|Error reading|invalid|"
                r"Fortran runtime error|runtime error|Error termination).*)$",
                log_tail,
                re.MULTILINE | re.IGNORECASE,
            )
            error_msg = rt.group(1) if rt else "UNKNOWN"
        clean = re.sub(r"\d+\.?\d*(?:[Ee][-+]?\d+)?", "N", error_msg)
        clean = re.sub(r"/[^ ]+", "PATH", clean)
        clean = " ".join(clean.split()).upper()
        return hashlib.md5(clean.encode()).hexdigest()

    # --- B-2. diagnose ---

    def diagnose(self, log_tail: str, lang: str = "ko") -> Tuple[Optional[str], Dict[str, Any], str]:
        """(diag_id, {signature, extracted}, human_msg). 정상이면 (None, {}, "")."""
        is_ko = lang != "en"

        # 1. GEO_OPT 미수렴 먼저.
        if (
            "MAXIMUM NUMBER OF OPTIMIZATION STEPS" in log_tail
            or "MAXIMUM NUMBER OF GEO_OPT STEPS" in log_tail
        ):
            extracted = "MAXIMUM NUMBER OF OPTIMIZATION STEPS REACHED"
            msg = (
                "구조 최적화 최대 단계 도달 (수렴 실패)"
                if is_ko
                else "Maximum optimization steps reached (convergence failed)"
            )
            return (
                "GEO_OPT_NOT_CONVERGED",
                {"signature": self._get_log_signature(extracted), "extracted": extracted},
                msg,
            )

        # 2. 성공 마커(전부 verbatim)가 있고 [ABORT] 없으면 정상.
        success_markers = (
            "GEOMETRY OPTIMIZATION COMPLETED",
            "ENERGY| Total FORCE_EVAL",
            "SCF WAVEFUNCTION OPTIMIZATION  DONE",  # DONE 앞 공백 2칸
            "VIBRATIONAL FREQUENCIES",
            "PROGRAM ENDED AT",
        )
        if any(mk in log_tail for mk in success_markers) and "[ABORT]" not in log_tail:
            return (None, {}, "")

        # 3. error_msg 분류.
        abort_text = self._extract_clean_abort(log_tail)
        if abort_text:
            error_msg = "CP2K_ABORT"
        else:
            rt = re.search(
                r"((?:Segmentation fault|KeyError|File not found|Error reading|invalid|"
                r"Fortran runtime error|runtime error|Error termination).*)$",
                log_tail,
                re.MULTILINE | re.IGNORECASE,
            )
            error_msg = "RUNTIME_ERROR" if rt else "UNKNOWN_ERROR"

        # 4. 스마트 번역(human_reason 기본값).
        human_reason = "원인을 분석 중입니다..." if is_ko else "Analyzing the root cause..."
        target = (abort_text or log_tail).upper()
        translation_table = [
            (["DIMER SHOULD NOT REPEAT"], "DIMER 섹션 중복 정의", "Duplicate definition of DIMER section"),
            (
                ["LINE SEARCH TYPE NOT YET IMPLEMENTED"],
                "지원하지 않는 Line Search 방식",
                "Unsupported Line Search type",
            ),
            (["BASIS", "NOT FOUND"], "기저집합 파일 유실 또는 오매칭", "Basis set file missing or mismatched"),
            (
                ["UNKNOWN KEYWORD", "UNKNOWN SUBSECTION"],
                "잘못된 키워드/섹션 사용",
                "Incorrect keyword or subsection",
                "OR",
            ),
            (["SCF", "NOT CONVERGED"], "SCF 수렴 실패", "SCF convergence failed"),
            (
                ["SECTION XC SHOULD NOT REPEAT"],
                "XC Functional 중복 정의",
                "Duplicate definition of XC Functional",
            ),
            (
                ["INVALID SET OF CELL VECTORS"],
                "잘못된 격자 벡터(Cell Vector) 지정",
                "Invalid cell vector specification",
            ),
            (
                ["REFERENCE_FUNCTIONAL", "DISPERSION", "GRIMME"],
                "D3 분산 보정 REFERENCE_FUNCTIONAL 미지정 오류",
                "D3 dispersion correction REFERENCE_FUNCTIONAL missing",
                "OR",
            ),
        ]
        translated_desc = None
        for entry in translation_table:
            keys = entry[0]
            ko_txt, en_txt = entry[1], entry[2]
            mode = entry[3] if len(entry) > 3 else "AND"
            matched = (
                any(k in target for k in keys) if mode == "OR" else all(k in target for k in keys)
            )
            if matched:
                human_reason = ko_txt if is_ko else en_txt
                translated_desc = human_reason
                break

        # 5. diag_id 선택: KB 시그니처 우선.
        sig = self._get_log_signature(log_tail)
        if sig in self.knowledge and sig != UNKNOWN_SIGNATURE:
            kb_reason = self.knowledge[sig].get("reason", "")
            if kb_reason:
                if len(kb_reason) > 80:
                    first_sentence = kb_reason.split(".")[0].strip()
                    kb_reason = first_sentence if len(first_sentence) <= 80 else (kb_reason[:77] + "...")
                human_reason = kb_reason
            final_msg = (
                f"{translated_desc} ({human_reason})" if translated_desc else human_reason
            )
            return ("KNOWN_ERROR", {"signature": sig, "extracted": abort_text}, final_msg)

        final_msg = f"{translated_desc} ({human_reason})" if translated_desc else human_reason
        return (error_msg, {"signature": sig, "extracted": abort_text}, final_msg)

    # --- B-3. heal (KB 결정론적 처방) ---

    def heal(
        self,
        options: Dict[str, Any],
        diag_id: Optional[str],
        match_groups: Dict[str, Any],
        retry_count: int = 0,
        lang: str = "ko",
    ) -> Tuple[Dict[str, Any], List[str]]:
        """KB 시그니처에 검증된 fix 가 있으면 트리에 병합. (new_options, logs)."""
        sig = (match_groups or {}).get("signature")
        if sig and sig in self.knowledge and sig != UNKNOWN_SIGNATURE:
            fixes = self.knowledge[sig].get("fixes", [])
            fix_dict = _parse_path_based_options(fixes)
            _deep_update(options, fix_dict)
            reason = self.knowledge[sig].get("reason", "검증된 해결책")
            return options, [f"경험 기반 처방 적용: {reason}"]
        return options, []

    # --- B-4. heal_with_ai (3-튜플) ---

    async def heal_with_ai(
        self,
        options: Dict[str, Any],
        log_tail: str,
        retry_count: int = 0,
        previous_fixes=None,
        job_dir: Optional[str] = None,
        failure_history=None,
        ai_meta: Optional[Dict[str, Any]] = None,
        lang: str = "ko",
    ) -> Tuple[Dict[str, Any], List[str], str]:
        """AI 치유. 3-튜플 (new_options, logs, msg). 실패 시 msg=실패문자열(빈 문자열 아님)."""
        is_ko = lang != "en"
        ai_meta = ai_meta or {}
        fail_msg = "AI 분석 실패" if is_ko else "AI analysis failed"

        try:
            # 1. 스마트 캐시: KB 시그니처가 있고 UNKNOWN 이 아니면 KB fix 적용 후 정규화.
            sig = self._get_log_signature(log_tail)
            if sig in self.knowledge and sig != UNKNOWN_SIGNATURE:
                fixes = self.knowledge[sig].get("fixes", [])
                _deep_update(options, _parse_path_based_options(fixes))
                sanitized, _logs = self.validate_and_correct(
                    options, mandatory_params={"atom_info": ai_meta, **ai_meta}
                )
                reason = self.knowledge[sig].get("reason", "검증된 해결책")
                desc = (
                    f"[AI Cache] 검증된 처방 재적용: {reason}"
                    if is_ko
                    else f"[AI Cache] Reapplied verified fix: {reason}"
                )
                detail = reason
                return sanitized, [desc], detail

            # 2. previous_fixes 보강.
            if failure_history and not previous_fixes:
                previous_fixes = failure_history

            # 3. 로그 압축(만들기만 하고 프롬프트엔 원본 log_tail 사용 — reference 특이점).
            self._compress_log(log_tail)

            # 4. 현재 .inp 읽기.
            current_inp = self._read_current_inp(job_dir, options)

            # 5. core_error.
            core_error = self._extract_core_error(log_tail)

            # 6. xml_context.
            xml_context = self._build_xml_context(core_error)

            # 7. has_kpts.
            has_kpts = (
                "YES"
                if any(
                    k in ai_meta for k in ("kpoints", "kpoints_scheme", "kpoints_active")
                )
                and (
                    ai_meta.get("kpoints")
                    or ai_meta.get("kpoints_scheme")
                    or ai_meta.get("kpoints_active")
                )
                else "NO"
            )

            # 8. 프롬프트 구성.
            from app.features.jobs import prompts as healing_prompts

            system_context = healing_prompts.build_system_context(
                atom_count=ai_meta.get("atom_count", 0),
                cell=ai_meta.get("cell", []),
                periodic=ai_meta.get("periodic", "XYZ"),
                mode=ai_meta.get("mode", "SIMULATION"),
                scf_algo=ai_meta.get("scf_algo", "OT"),
                target_property=ai_meta.get("property", "energy"),
                elements=ai_meta.get("elements", []),
            )
            history_msg = self._format_history(previous_fixes)
            user_prompt = healing_prompts.build_healing_prompt(
                system_context=system_context,
                has_kpts=has_kpts,
                current_inp=current_inp,
                xml_context=xml_context,
                core_error=core_error,
                log_tail=log_tail,  # ★ 원본 log_tail 그대로
                history_msg=history_msg,
            )

            # 9. LLM 호출(max_tokens=1000). 모델/파라미터는 app.core.llm(claude-api 스킬 기준).
            from app.core import llm

            text = await self._acomplete(llm, healing_prompts.HEALING_SYSTEM, user_prompt)

            # 10. 응답 파싱(verbatim 정규식).
            reason_kr = (
                re.search(r"REASON_KR:\s*(.*)", text).group(1)
                if "REASON_KR:" in text
                else "분석 중..."
            )
            fix_kr = (
                re.search(r"FIX_KR:\s*(.*)", text).group(1) if "FIX_KR:" in text else "수정 중..."
            )
            reason_en = (
                re.search(r"REASON:\s*(.*)", text).group(1) if "REASON:" in text else "AI Analysis"
            )
            fix_part = text.split("FIX:")[1] if "FIX:" in text else text
            fix_lines = [
                l.strip()
                for l in fix_part.splitlines()
                if "/" in l and len(l.split()) >= 2
            ]

            # 11. 적용.
            if fix_lines:
                self.last_attempt = {
                    "signature": sig,
                    "reason": reason_en,
                    "fixes": fix_lines,
                }
                _deep_update(options, _parse_path_based_options(fix_lines))
                sanitized, _logs = self.validate_and_correct(
                    options, {"atom_info": ai_meta, **ai_meta}
                )
                heal_log = (
                    f"[AI Fix] {reason_kr} / 처방: {fix_kr}"
                    if is_ko
                    else f"[AI Fix] {reason_en}"
                )
                heal_msg = fix_kr if is_ko else reason_en
                return sanitized, [heal_log], heal_msg

            # 12. 무 FIX.
            return options, [fail_msg], fail_msg
        except Exception:
            return options, [fail_msg], fail_msg

    async def _acomplete(self, llm, system: str, user: str) -> str:
        """app.core.llm 의 async/sync complete 중 사용 가능한 것으로 호출(max_tokens=1000)."""
        if hasattr(llm, "acomplete"):
            return await llm.acomplete(system, user, max_tokens=1000)
        if hasattr(llm, "complete"):
            return llm.complete(system, user, max_tokens=1000)
        raise RuntimeError("app.core.llm 에 complete/acomplete 가 없습니다.")

    def _compress_log(self, log_tail: str) -> str:
        """len(lines)>200 일 때만 압축본 생성(프롬프트엔 미사용 — reference 특이점 충실 재현)."""
        lines = log_tail.splitlines()
        if len(lines) <= 200:
            return log_tail
        header = lines[:50]
        footer = lines[-70:]
        scf_idx = None
        for i, l in enumerate(lines):
            if "SCF WAVEFUNCTION OPTIMIZATION" in l:
                scf_idx = i
        scf_block: List[str] = []
        if scf_idx is not None:
            scf_block = lines[scf_idx : scf_idx + 100]
        parts = ["--- [LOG HEADER] ---"]
        parts += header
        parts.append("... (intermediate logs omitted) ...")
        if scf_block:
            parts.append("--- [LAST SCF CONVERGENCE TABLE] ---")
            parts += scf_block
        parts.append("--- [ERROR MESSAGE & STACK TRACE] ---")
        parts += footer
        return "\n".join(parts)

    def _read_current_inp(self, job_dir: Optional[str], options: Dict[str, Any]) -> str:
        """step1.inp 우선, 없으면 마지막 *.inp, 없으면 build_full_inp 렌더."""
        try:
            if job_dir and os.path.isdir(job_dir):
                step1 = os.path.join(job_dir, "step1.inp")
                if os.path.exists(step1):
                    with open(step1, "r", encoding="utf-8", errors="replace") as f:
                        return f.read()
                inps = sorted(
                    [
                        os.path.join(job_dir, fn)
                        for fn in os.listdir(job_dir)
                        if fn.endswith(".inp")
                    ]
                )
                if inps:
                    with open(inps[-1], "r", encoding="utf-8", errors="replace") as f:
                        return f.read()
        except Exception:
            pass
        return _build_full_inp(options, {"atoms": []}, step_idx=1)

    def _extract_core_error(self, log_tail: str) -> str:
        """MAXIMUM ... STEPS / [ABORT] / 폴백."""
        if re.search(r"MAXIMUM NUMBER OF (OPTIMIZATION|GEO_OPT) STEPS", log_tail):
            return (
                "Geometry optimization did not converge within the maximum number of steps. "
                "Force/EPS thresholds (MAX_FORCE/RMS_FORCE/EPS_SCF) likely too tight or "
                "the optimizer needs relaxation."
            )
        if "[ABORT]" in log_tail:
            after = log_tail.split("[ABORT]", 1)[1]
            picked: List[str] = []
            for line in after.splitlines():
                s = line.strip()
                if not s:
                    continue
                if any(ch in s for ch in ("*", "\\", "/", "---")):
                    continue
                picked.append(s)
                if len(picked) >= 2:
                    break
            if picked:
                return " ".join(picked)
            return "CP2K aborted."
        return self._extract_clean_abort(log_tail) or "Unknown error."

    def _build_xml_context(self, core_error: str) -> str:
        """relevant_tokens + core_error 대문자 토큰 + 값-에러 키워드 → get_manual_snippet 합본."""
        relevant_tokens = ["SCF", "MIXING", "DIAGONALIZATION", "OT", "QS"]
        tokens = list(relevant_tokens)
        for t in re.findall(r"([A-Z_]{3,})", core_error or ""):
            if t not in tokens:
                tokens.append(t)
        if any(kw in (core_error or "").upper() for kw in ("VALUE", "INVALID", "ENUM")):
            for t in ("CELL", "KIND", "POISSON"):
                if t not in tokens:
                    tokens.append(t)
        snippets: List[str] = []
        for t in tokens:
            snip = _get_manual_snippet(t)
            if snip:
                snippets.append(snip)
        return "\n".join(snippets)

    def _format_history(self, previous_fixes) -> str:
        if not previous_fixes:
            return "(No previous attempts.)"
        if isinstance(previous_fixes, (list, tuple)):
            return "\n".join(str(x) for x in previous_fixes)
        return str(previous_fixes)

    # --- B-5. validate_and_correct (단일 패스) ---

    def validate_and_correct(
        self, options: Dict[str, Any], mandatory_params: Dict[str, Any]
    ) -> Tuple[Dict[str, Any], List[str]]:
        """schema_engine.validate_and_relocate → physics_rules.apply_physics_rules. 단일 패스.

        3-pass 루프는 _submit_step 안에서 돈다(build_full_inp 가 아님).
        """
        new_options, relocate_logs = _schema_validate_and_relocate(options, mandatory_params)
        physics_logs = physics_rules.apply_physics_rules(new_options)
        logs: List[str] = []
        if relocate_logs:
            logs.extend(relocate_logs)
        if physics_logs:
            logs.extend(physics_logs)
        if not logs:
            logs = ["✅ [Integrity] 수정 불필요 (무결함)"]
        return new_options, logs

    # --- B-6. record_success ---

    def record_success(self) -> None:
        """last_attempt 가 있고 signature != UNKNOWN 일 때만 KB 저장. 이후 last_attempt 삭제."""
        last = getattr(self, "last_attempt", None)
        if last:
            sig = last.get("signature")
            if sig and sig != UNKNOWN_SIGNATURE:
                self.knowledge[sig] = {
                    "reason": last.get("reason", ""),
                    "fixes": last.get("fixes", []),
                }
                self._save_knowledge()
            try:
                delattr(self, "last_attempt")
            except AttributeError:
                pass

    # --- B-7. get_retry_filenames ---

    def get_retry_filenames(
        self, step_dir: str, base_inp: str, retry_count: int
    ) -> Tuple[str, str, str]:
        """(step_dir, {name}_retry_{n}.inp, {name}_retry_{n}.sh)."""
        name = base_inp.replace(".inp", "")
        return (
            step_dir,
            f"{name}_retry_{retry_count}.inp",
            f"{name}_retry_{retry_count}.sh",
        )


# 모듈 싱글톤 — f4/f6 가 `from app.shared.self_healing import healing_engine` 로 import.
healing_engine = CP2KHealingEngine()
