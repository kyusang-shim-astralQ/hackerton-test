"""app/schemas/common.py — cross-feature 데이터 계약의 코드본.

`docs/contracts/data-models.md` 의 기능 경계를 가로지르는 모델을 Pydantic 으로 1:1 정의한다.
이 파일이 FE·BE 공유 계약의 단일 소스이므로 **필드명·타입·기본값을 임의로 바꾸지 않는다.**
바꿔야 하면 먼저 data-models.md 를 고치고 팀에 알린다(계약 우선 원칙).

설계 메모:
- `AtomInfo` 는 세 형태(정상/parse-failure 폴백/empty-CIF 폴백)로 키 집합이 다르다. 따라서
  공통 키만 필수로 두고, 선택 키는 Optional + `model_config extra="allow"` 로 방어한다.
  소비자는 선택 키를 `.get()`(dict) 으로 읽어야 한다.
- 요청 모델(`PlanRequest`/`InpRequest`/`SubmitRequest`/`BenchmarkRequest`)은 모델별 기본값 차이가
  계약이다(예: SubmitRequest 의 cutoff=400.0 vs PlanRequest 의 cutoff 필수). 정확히 반영한다.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


# ──────────────────────────────────────────────────────────────────────────
# 1. AtomInfo  (produced_by: f1 / consumed_by: f2,f3,f4,f6)  — 파이프라인 SSOT
# ──────────────────────────────────────────────────────────────────────────
class AtomCoord(BaseModel):
    """atoms[] 의 단일 원자 좌표."""

    element: str
    x: float
    y: float
    z: float


class AtomInfo(BaseModel):
    """정규화된 구조 정보. 세 형태가 존재하며 선택 키 집합이 다르다.

    공통 키(세 형태 모두 존재): filename, atom_count, atoms, elements, element_counts,
    cell, full_coord_text, full_cell_text, use_scaled.
    선택 키(.get 필수): element_indices, cell_angles, volume, smear_*, periodic, error.
    """

    model_config = ConfigDict(extra="allow")  # 폴백/추가 키 허용 (SSOT 방어)

    # 공통 키
    filename: str
    atom_count: int
    atoms: List[Dict[str, Any]] = Field(default_factory=list)
    elements: List[str] = Field(default_factory=list)
    element_counts: Dict[str, int] = Field(default_factory=dict)
    cell: List[float] = Field(default_factory=list)  # [a, b, c]
    full_coord_text: str = ""
    full_cell_text: str = ""
    use_scaled: bool = False

    # 선택 키 (형태별 부재 가능)
    element_indices: Optional[Dict[str, List[int]]] = None  # 1-based
    cell_angles: Optional[List[float]] = None  # [alpha, beta, gamma] deg
    volume: Optional[float] = None
    smear_recommended: Optional[bool] = None
    smear_reason_ko: Optional[str] = None
    smear_reason_en: Optional[str] = None
    periodic: Optional[str] = None
    error: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────
# 2. AnalyzeCifResponse  (produced_by: f1)
# ──────────────────────────────────────────────────────────────────────────
class AnalyzeCifResponse(BaseModel):
    status: str = "success"
    filename: str
    atom_info: AtomInfo
    content_hash: str  # CIF 본문 SHA-256 hex(64자)


# ──────────────────────────────────────────────────────────────────────────
# 4. PlanStep  (produced_by: f2 / consumed_by: f3,f4,f6)  — 핵심 교차 계약
# ──────────────────────────────────────────────────────────────────────────
class PlanStep(BaseModel):
    """AI 가 생성하는 단일 플랜 스텝. 소비자는 모든 키를 방어적으로 읽는다."""

    model_config = ConfigDict(extra="allow")

    step_idx: Optional[int] = None  # 1-based
    step_name: str
    importance: Optional[str] = None  # 필수 | 권장 | 선택
    run_type: str = "ENERGY"
    physics_reason: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None
    # 경로기반 옵션: list[str] (FULL PATH, & 없이 / 구분) 또는 dict.
    inp_options: Union[List[str], Dict[str, Any]] = Field(default_factory=list)
    selected: Optional[bool] = True
    exclude: Optional[bool] = False
    # f3/f4 제출 단계 전용 키 (f2 는 생성하지 않음)
    active_tokens: Optional[List[str]] = None


# ──────────────────────────────────────────────────────────────────────────
# 공통 DFT 파라미터 베이스 — 요청 모델들이 공유하는 필드 (기본값 차이는 서브클래스에서)
# ──────────────────────────────────────────────────────────────────────────
class _DFTParamsBase(BaseModel):
    method: str = "GPW"
    scf_algo: str = "OT"
    charge: int = 0
    multiplicity: int = 1
    use_smear: bool = False
    smear_temp: float = 300.0
    custom_options: Dict[str, Any] = Field(default_factory=dict)
    eps_scf: str = "1.0E-6"
    periodic: str = "XYZ"
    max_scf: Optional[int] = None
    ignore_scf_failure: bool = False
    basis_file: Optional[str] = None
    pot_file: Optional[str] = None
    lsd: bool = False
    added_mos: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────
# 3. PlanRequest  (produced_by/consumed_by: f2)
#    특징: lang 필드 보유. active_tokens 는 동적 속성(모델 필드 아님) → extra="allow" 로 허용만.
# ──────────────────────────────────────────────────────────────────────────
class PlanRequest(_DFTParamsBase):
    model_config = ConfigDict(extra="allow")  # active_tokens setattr 주입 허용

    atom_info: AtomInfo
    property: str  # 12종 중 하나(단일 문자열)
    basis_set: str
    cutoff: float
    rel_cutoff: float
    functional: str
    lang: str = "ko"  # 이 모델에만 존재


# ──────────────────────────────────────────────────────────────────────────
# 5. PlanResult  (produced_by: f2 / consumed_by: f6)
# ──────────────────────────────────────────────────────────────────────────
class PlanResult(BaseModel):
    expert_tip: str
    steps: List[PlanStep] = Field(default_factory=list)
    atom_info: AtomInfo  # 요청 atom_info 에코 (SSOT)


# ──────────────────────────────────────────────────────────────────────────
# 7. GeneratedFile  (produced_by: f3 / consumed_by: f4,f6)
# ──────────────────────────────────────────────────────────────────────────
class GeneratedFile(BaseModel):
    """생성된 단일 .inp. 제출 측 FileItem 의 호환 형태(validation_logs 는 제출 모델에만)."""

    filename: str
    content: str
    validation_logs: Optional[List[Any]] = None


# ──────────────────────────────────────────────────────────────────────────
# 6. InpRequest  (produced_by/consumed_by: f3)  — lang 필드 없음
# ──────────────────────────────────────────────────────────────────────────
class InpRequest(_DFTParamsBase):
    atom_info: AtomInfo
    steps: List[PlanStep] = Field(default_factory=list)
    property: str
    basis_set: str
    cutoff: float
    rel_cutoff: float
    functional: str
    multi_atom_info: Optional[List[AtomInfo]] = None


# ──────────────────────────────────────────────────────────────────────────
# 8. GenerateInpResult  (produced_by: f3 / consumed_by: f4)
# ──────────────────────────────────────────────────────────────────────────
class GenerateInpResult(BaseModel):
    status: str = "success"
    generated_files: List[GeneratedFile] = Field(default_factory=list)


# ──────────────────────────────────────────────────────────────────────────
# 9. SubmitRequest  (produced_by/consumed_by: f4)
#    ⚠️ 다른 모델과 기본값이 다름: cutoff=400.0, rel_cutoff=50.0, functional='PBE',
#       basis_set='DZVP-MOLOPT-GTH', property='energy' (여기서는 필수가 아님).
# ──────────────────────────────────────────────────────────────────────────
class SubmitRequest(_DFTParamsBase):
    files: Optional[List[GeneratedFile]] = None  # None 이면 오케스트레이터 자동 생성
    atom_info: AtomInfo
    steps: List[PlanStep] = Field(default_factory=list)
    job_name: Optional[str] = None
    multi_atom_info: Optional[List[AtomInfo]] = None
    # 모델 고유 기본값
    cutoff: float = 400.0
    rel_cutoff: float = 50.0
    functional: str = "PBE"
    basis_set: str = "DZVP-MOLOPT-GTH"
    property: str = "energy"


# ──────────────────────────────────────────────────────────────────────────
# 10. SubmitJobResponse  (produced_by: f4 / consumed_by: f4, f5[directory만])
# ──────────────────────────────────────────────────────────────────────────
class SubJobRef(BaseModel):
    filename: str
    job_key: str


class SubmitJobResponse(BaseModel):
    status: str = "success"
    directory: str  # f5 가 ReportRequest.job_dir 로 쓰는 유일한 f4 소비 필드
    is_multi: Optional[bool] = None
    sub_jobs: Optional[List[SubJobRef]] = None
    message: str


# ──────────────────────────────────────────────────────────────────────────
# 12. StepHistory  (produced_by/consumed_by: f4)  — 단계별 시계열
# ──────────────────────────────────────────────────────────────────────────
class StepHistory(BaseModel):
    model_config = ConfigDict(extra="allow")

    run_type: str
    energy: List[float] = Field(default_factory=list)
    scf: List[float] = Field(default_factory=list)
    change: Optional[List[float]] = None  # orchestrator 초기화에만
    macro_energy: Optional[List[float]] = None
    macro_conv: Optional[List[float]] = None
    property: Optional[str] = None  # 동적복원 시에만


# ──────────────────────────────────────────────────────────────────────────
# 11. JobStatus  (produced_by/consumed_by: f4)  — 단일 작업 상태 (f5 미소비)
# ──────────────────────────────────────────────────────────────────────────
class JobStatus(BaseModel):
    model_config = ConfigDict(extra="allow")  # 런타임 추가 키 허용

    status: str
    active_step: int = 1
    total_steps: int = 0
    job_id: Optional[str] = None
    lang: str = "ko"
    message: str = ""
    healing_history: List[str] = Field(default_factory=list)
    updated_at: str = ""
    logs: List[str] = Field(default_factory=list)
    logs_pos: Optional[int] = None
    current_scf_step: Optional[int] = None
    energy_history: Optional[List[float]] = None
    scf_history: Optional[List[float]] = None
    macro_energy_history: Optional[List[float]] = None
    macro_conv_history: Optional[List[float]] = None
    scf_progress: Optional[float] = None
    macro_progress: Optional[float] = None
    tddft_progress: Optional[Dict[str, Any]] = None
    expert_tip: Optional[str] = None
    steps: List[PlanStep] = Field(default_factory=list)
    step_histories: Dict[str, StepHistory] = Field(default_factory=dict)
    suite_params: Optional[Dict[str, Any]] = None
    job_key: Optional[str] = None  # get_job_status 반환 시 주입


# ──────────────────────────────────────────────────────────────────────────
# 13. MultiMetadata  (produced_by: f4 / consumed_by: f4, f5[디스크 직접])
# ──────────────────────────────────────────────────────────────────────────
class MultiMetadata(BaseModel):
    is_multi: bool = True
    parent_job_key: str
    sub_jobs: List[SubJobRef] = Field(default_factory=list)
    property: str
    steps: List[PlanStep] = Field(default_factory=list)
    timestamp: str  # YYYYmmdd_HHMMSS


# ──────────────────────────────────────────────────────────────────────────
# 15. JobLiveStatusResponse  (produced_by/consumed_by: f4)
#     단일 = JobStatus 전체 키 포함 / 다중 = 하위작업 집계. extra="allow" 로 단일 키 흡수.
# ──────────────────────────────────────────────────────────────────────────
class SubJobStatus(BaseModel):
    filename: str
    job_key: str
    status: str  # Completed | Failed | Running


class JobLiveStatusResponse(BaseModel):
    model_config = ConfigDict(extra="allow")  # 단일 작업이면 JobStatus 키들을 그대로 흡수

    status: str
    is_multi: Optional[bool] = None
    sub_jobs: Optional[List[SubJobStatus]] = None
    message: Optional[str] = None
    step_histories: Optional[Dict[str, StepHistory]] = None
    job_key: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────
# 16. ReportRequest  (produced_by/consumed_by: f5)
# ──────────────────────────────────────────────────────────────────────────
class ReportRequest(BaseModel):
    job_dir: str  # SubmitJobResponse.directory
    property: str = "geo_opt"
    lang: str = "ko"


# ──────────────────────────────────────────────────────────────────────────
# 17. ReportData  (produced_by: f5 / 최종 소비: 프런트)
# ──────────────────────────────────────────────────────────────────────────
class Excitation(BaseModel):
    state: int
    energy_ev: float
    wavelength_nm: float
    osc_strength: float
    is_dark: bool
    region: str


class Spectrum(BaseModel):
    wavelengths: List[float] = Field(default_factory=list)
    intensities: List[float] = Field(default_factory=list)
    sigma_ev: float = 0.1


class ReportData(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: Optional[str] = None  # 에러 축약형에는 키 부재
    report: str
    summary: Dict[str, Any] = Field(default_factory=dict)
    is_multi: Optional[bool] = None
    excitations: Optional[List[Excitation]] = None  # absorption/emission 전용
    spectrum: Optional[Spectrum] = None  # absorption/emission 전용


# ──────────────────────────────────────────────────────────────────────────
# 18. BenchmarkRequest  (produced_by/consumed_by: f6)
#     특징: levels 필수, atom_info/steps/files 없음.
# ──────────────────────────────────────────────────────────────────────────
class BenchmarkRequest(_DFTParamsBase):
    levels: List[int] = Field(default_factory=list)  # 비면 1~12 전체
    session_id: Optional[str] = None
    basis_set: str
    cutoff: float
    rel_cutoff: float
    functional: str
    property: str = "energy"  # 레벨별 LEVEL_TO_PROPERTY 로 덮어씀


# ──────────────────────────────────────────────────────────────────────────
# 20. BenchmarkLevelReport  (produced_by: f6 / BenchmarkReport 중첩)
# ──────────────────────────────────────────────────────────────────────────
class BenchmarkLevelReport(BaseModel):
    model_config = ConfigDict(extra="allow")

    level: int
    status: str  # Pending | Running | Recovering... | SUCCESS | INCORRECT | FAILURE | Skipped
    agent_energy: Optional[float] = None
    official_energy: Optional[float] = None
    diff: Optional[float] = None
    message: str = ""
    healing_count: Optional[int] = None
    last_diag: Optional[str] = None  # 대문자 스네이크케이스 진단 id


# ──────────────────────────────────────────────────────────────────────────
# 19. BenchmarkReport  (produced_by: f6 / 최종 소비: 프런트 폴링)
# ──────────────────────────────────────────────────────────────────────────
class BenchmarkReport(BaseModel):
    status: str = "Idle"  # Idle | Running | Finished | Failure
    current_level: int = 0
    total_levels: int = 12
    reports: List[BenchmarkLevelReport] = Field(default_factory=list)
    logs: List[str] = Field(default_factory=list)
    logs_pos: Optional[int] = None
