"""app/features/jobs/prompts.py — f4 자가치유(heal_with_ai) LLM 프롬프트.

CLAUDE.md §6: Claude API 호출 지점 3곳 중 하나(② 에러 진단·수정). 프롬프트는 호출 코드에
흩지 않고 docs/prompts/healing-prompt.md 원문을 이 모듈로 모은다(반입 자산). 호출부(self_healing
.heal_with_ai)는 build_healing_prompt 만 import 한다.

원문: docs/prompts/healing-prompt.md (영문, {xml_context} 포함, K-POINTS ACTIVE 줄, EXPERT
KNOWLEDGE 6항목, FIX 예시는 &-경로형). 임의로 줄이거나 @PARAM/한글화로 바꾸지 말 것.
"""

from __future__ import annotations

# heal_with_ai 가 system 으로 쓰는 짧은 역할 지시(프롬프트 본문이 사실상 전체 컨텍스트를 담는다).
HEALING_SYSTEM = (
    "You are a CP2K computational chemistry expert. You read a failed CP2K calculation "
    "log and its input file, then propose a precise, schema-valid fix in path-based format. "
    "You never invent keywords; you follow the provided CP2K XML schema reference strictly."
)

# docs/prompts/healing-prompt.md 의 "프롬프트 본문 (verbatim)" 그대로. placeholders(f-string):
# system_context / has_kpts / current_inp / xml_context / core_error / log_tail / history_msg.
HEALING_PROMPT_TEMPLATE = """[SYSTEM CONTEXT]
{system_context}
K-POINTS ACTIVE: {has_kpts} (CRITICAL: If YES, OT algorithm is NOT allowed!)

[FAILED INPUT STRUCTURE]
This is the input file that caused the error. Look for logical contradictions in its hierarchy:
{current_inp}

[CP2K XML SCHEMA REFERENCE]
{xml_context}

[CORE ERROR MESSAGE FROM LOG]
{core_error}

[DETAILED LOG FOOTER]
{log_tail}

[VALIDATION & ATTEMPT HISTORY]
{history_msg}
(Note: If keywords were recently dropped, suggest a different path or parameter combination that fits the schema.)

[CP2K EXPERT KNOWLEDGE]
1. OT Compatibility: OT (Orbital Transformation) is FAST but works ONLY for systems with a Large Gap and NO K-POINTS.
   - If K-POINTS is YES, suggest &DFT/&SCF/&DIAGONALIZATION.
2. Large Systems (>100 atoms): Convergence often requires Smearing.
   - Suggest adding &DFT/&SCF/&SMEAR with &DFT/&SCF/ADDED_MOS (at least 20-50).
3. Memory/Convergence: If SCF sloshes, reduce &DFT/&SCF/&MIXING/ALPHA to 0.1.
4. Benchmark Sync: If Mode is BENCHMARK, preserve the original section names (e.g., &XC_FUNCTIONAL PBE) instead of splitting them.
5. NO SUBSYS: Do NOT suggest or modify anything under &SUBSYS (COORD, CELL, KIND). This is strictly managed by the agent.
6. PRESERVE the user's requested [Current SCF Algo]. If convergence fails, adjust MIXING, ALPHA, SMEAR, or ADDED_MOS instead of changing the algorithm itself.

[MISSION]
1. Analyze the [CORE ERROR MESSAGE] in the context of [SYSTEM CONTEXT] and [FAILED INPUT STRUCTURE].
2. Identify why the current input failed (e.g., path mismatch, invalid algo for system size, or missing required sub-section).
3. Provide a contextual fix in 'Path-based' format. Ensure paths are precise and follow the [CP2K XML SCHEMA REFERENCE].
4. DO NOT include &END tags.
5. NEVER suggest modifications to COORD, CELL, or KIND.
6. PRESERVE the user's requested [Current SCF Algo]. If convergence fails, adjust MIXING, ALPHA, SMEAR, or ADDED_MOS instead of changing the algorithm itself.

[FORMAT]
REASON_KR: (에러 원인에 대한 정밀한 분석 결과, 한글 1문장)
FIX_KR: (이 시스템 맥락에 맞는 구체적인 해결책, 한글 1문장)
REASON: (Brief English explanation focusing on why this fix works for this specific system)
FIX:
&DFT/&SCF/&DIAGONALIZATION/ALGORITHM STANDARD
&DFT/&SCF/&MIXING/ALPHA 0.1
"""


def build_system_context(
    *,
    atom_count,
    cell,
    periodic: str,
    mode: str,
    scf_algo: str,
    target_property: str,
    elements,
) -> str:
    """healing-prompt.md 의 system_context 블록(reference 그대로) 구성."""
    el_str = ", ".join(str(e) for e in (elements or []))
    return (
        f"- Atom Count: {atom_count}\n"
        f"- Cell Size: {cell}\n"
        f"- Periodic: {periodic}\n"
        f"- Mode: {mode} (If BENCHMARK, follow reference paths strictly)\n"
        f"- Current SCF Algo: {scf_algo} (USER INTENT: Do NOT change this algorithm. "
        f"Focus on adjusting parameters instead.)\n"
        f"- Target Property: {target_property}\n"
        f"- Elements: {el_str}"
    )


def build_healing_prompt(
    *,
    system_context: str,
    has_kpts: str,
    current_inp: str,
    xml_context: str,
    core_error: str,
    log_tail: str,
    history_msg: str,
) -> str:
    """healing-prompt.md 본문에 placeholder 를 채워 사용자 프롬프트 텍스트를 만든다."""
    return HEALING_PROMPT_TEMPLATE.format(
        system_context=system_context,
        has_kpts=has_kpts,
        current_inp=current_inp,
        xml_context=xml_context,
        core_error=core_error,
        log_tail=log_tail,
        history_msg=history_msg,
    )
