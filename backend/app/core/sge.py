"""app/core/sge.py — SSH/SGE 클라이언트 (paramiko).

f4-jobs(`app/features/jobs/service.py`)가 실제 클러스터 제출에 사용하는 인프라 레이어.
- `CLUSTER_*` env(config)로 SSH 접속, SFTP 업로드/회수.
- `run.sh` 생성(CP2K_VENV source + mpiexec CP2K), `qsub`/`qstat`/`qdel` 래퍼.
- **자격증명(특히 CLUSTER_PASSWORD)은 config 에서만 읽고, 로그·응답·예외 메시지에 절대 노출하지 않는다.**

be/01 은 스캐폴드(접속/SFTP/run.sh/qsub·qstat·qdel)까지 제공한다. SGE_TEMPLATE 의 정확한
스케줄러 지시문·체이닝·자가치유 연동은 be/05(f4) 가 명세대로 채운다.
"""

from __future__ import annotations

import re
from typing import Optional

from app.core.config import settings

try:
    import paramiko  # type: ignore
except ImportError:  # paramiko 미설치 시에도 import 만으로 앱이 죽지 않게.
    paramiko = None  # type: ignore


# run.sh 템플릿. CP2K_VENV 를 source 하지 않으면 qsub 잡이 즉시 죽는다(be/05 필수).
# 실제 스케줄러 지시문(#$ -pe 등)·좌표 체이닝은 be/05 가 명세대로 확장한다.
RUN_SH_TEMPLATE = """#!/bin/bash
#$ -cwd
#$ -j y
#$ -S /bin/bash
{queue_line}{pe_line}
# --- CP2K 실행 환경 ---
{venv_line}{setvars_line}
{mpiexec} -n {ranks} {cp2k_bin} -i {inp_file} -o {out_file}
"""


def is_enabled() -> bool:
    """USE_SGE=1 이고 최소 자격증명이 있으면 실제 제출 경로. 아니면 f4 가 목 폴백."""
    return settings.USE_SGE and settings.has_cluster_credentials() and paramiko is not None


def build_run_sh(
    inp_file: str,
    out_file: str = "calculation.out",
    *,
    cp2k_bin: str = "cp2k.psmp",
) -> str:
    """SGE 제출용 run.sh 텍스트 생성. 자격증명은 포함하지 않는다(경로/실행환경만)."""
    queue_line = f"#$ -q {settings.CLUSTER_QUEUE}\n" if settings.CLUSTER_QUEUE else ""
    pe_line = f"#$ -pe {settings.CLUSTER_PE}\n" if settings.CLUSTER_PE else ""
    venv_line = f"source {settings.CP2K_VENV}\n" if settings.CP2K_VENV else ""
    setvars_line = f"source {settings.CP2K_SETVARS}\n" if settings.CP2K_SETVARS else ""
    mpiexec = settings.CP2K_MPIEXEC or "mpiexec"
    ranks = settings.CLUSTER_MPI_RANKS or 8
    return RUN_SH_TEMPLATE.format(
        queue_line=queue_line,
        pe_line=pe_line,
        venv_line=venv_line,
        setvars_line=setvars_line,
        mpiexec=mpiexec,
        ranks=ranks,
        cp2k_bin=cp2k_bin,
        inp_file=inp_file,
        out_file=out_file,
    )


class SGEClient:
    """클러스터 SSH/SGE 세션. with 문으로 쓰면 연결을 자동 정리한다.

    예)
        with SGEClient() as sge:
            sge.mkdirs(remote_dir)
            sge.upload_text(f"{remote_dir}/step1.inp", inp_text)
            job_id = sge.qsub(remote_dir, "run.sh")
            state = sge.qstat(job_id)
    """

    def __init__(self) -> None:
        if paramiko is None:
            raise RuntimeError("paramiko 가 설치되지 않았습니다. requirements.txt 의 paramiko 를 설치하세요.")
        self._client: Optional["paramiko.SSHClient"] = None
        self._sftp = None

    # --- 연결 라이프사이클 ---

    def connect(self) -> "SGEClient":
        if not settings.has_cluster_credentials():
            # 어떤 자격이 비었는지 boolean 으로만 알려주고 값은 절대 노출하지 않는다.
            raise RuntimeError(
                "클러스터 자격증명이 부족합니다 (CLUSTER_HOST/CLUSTER_USER/CLUSTER_PASSWORD 확인)."
            )
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(
            hostname=settings.CLUSTER_HOST,
            port=settings.CLUSTER_PORT,
            username=settings.CLUSTER_USER,
            password=settings.CLUSTER_PASSWORD,  # config 에서만 읽음. 어디에도 로깅 금지.
            look_for_keys=False,
            allow_agent=False,
            timeout=30,
        )
        self._client = client
        self._sftp = client.open_sftp()
        return self

    def close(self) -> None:
        if self._sftp is not None:
            try:
                self._sftp.close()
            finally:
                self._sftp = None
        if self._client is not None:
            try:
                self._client.close()
            finally:
                self._client = None

    def __enter__(self) -> "SGEClient":
        return self.connect()

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    # --- 명령 실행 ---

    def run(self, command: str) -> tuple[int, str, str]:
        """원격 명령 실행. (exit_status, stdout, stderr) 반환."""
        if self._client is None:
            raise RuntimeError("SSH 연결이 없습니다. connect() 를 먼저 호출하세요.")
        stdin, stdout, stderr = self._client.exec_command(command)
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        status = stdout.channel.recv_exit_status()
        return status, out, err

    # --- SFTP (업로드 / 회수) ---

    def mkdirs(self, remote_dir: str) -> None:
        """원격 디렉터리를 (중첩 포함) 생성. 이미 있으면 무시."""
        self.run(f"mkdir -p {remote_dir}")

    def upload_text(self, remote_path: str, text: str) -> None:
        """문자열을 원격 파일로 업로드(.inp, run.sh 등)."""
        if self._sftp is None:
            raise RuntimeError("SFTP 세션이 없습니다.")
        with self._sftp.open(remote_path, "w") as f:
            f.write(text)

    def upload_file(self, local_path: str, remote_path: str) -> None:
        if self._sftp is None:
            raise RuntimeError("SFTP 세션이 없습니다.")
        self._sftp.put(local_path, remote_path)

    def download_file(self, remote_path: str, local_path: str) -> None:
        """결과 파일 회수(calculation.out 등)."""
        if self._sftp is None:
            raise RuntimeError("SFTP 세션이 없습니다.")
        self._sftp.get(remote_path, local_path)

    def read_text(self, remote_path: str) -> str:
        """원격 텍스트 파일을 읽어 문자열로 반환(로그 펌프용)."""
        if self._sftp is None:
            raise RuntimeError("SFTP 세션이 없습니다.")
        with self._sftp.open(remote_path, "r") as f:
            return f.read().decode("utf-8", errors="replace")

    # --- SGE 래퍼 ---

    def qsub(self, remote_dir: str, script: str = "run.sh") -> Optional[str]:
        """remote_dir 에서 `qsub script` 실행. stdout 에서 job id 를 정규식(\\d+)으로 추출."""
        status, out, err = self.run(f"cd {remote_dir} && qsub {script}")
        if status != 0:
            raise RuntimeError(f"qsub 실패: {err.strip() or out.strip()}")
        m = re.search(r"(\d+)", out)
        return m.group(1) if m else None

    def qstat(self, job_id: Optional[str] = None) -> str:
        """`qstat` 또는 `qstat -j <id>` 실행. raw stdout 반환(상태 파싱은 f4)."""
        cmd = f"qstat -j {job_id}" if job_id else "qstat"
        _status, out, _err = self.run(cmd)
        return out

    def qdel(self, job_id: str) -> str:
        """`qdel <id>` 로 작업 취소."""
        _status, out, err = self.run(f"qdel {job_id}")
        return out or err
