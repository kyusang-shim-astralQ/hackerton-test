// lib/i18n/f1-structure.ts — f1-structure 사전 (이 기능 담당이 채운다). prefix: f1.*
import type { Dict } from "./index";

export const f1Dict: Dict = {
  ko: {
    "f1.placeholder": "구조 입력 화면(1단계) — f1-structure 가 채웁니다.",

    // 구조 입력 카드
    "f1.input.title": "구조 입력",
    "f1.input.sub": ".cif / .xyz / POSCAR",
    "f1.drop.idle": "결정구조 파일을 끌어다 놓거나 클릭해 선택",
    "f1.drop.hint": ".cif · .xyz · POSCAR (다중 업로드 가능)",
    "f1.drop.active": "여기에 놓으면 분석을 시작합니다",
    "f1.drop.button": "파일 선택",
    "f1.analyzing": "구조 분석 중…",
    "f1.fileError": "분석 실패",
    "f1.valid": "유효",
    "f1.removeFile": "제거",
    "f1.clearAll": "모두 지우기",
    "f1.atomsUnit": "원자",

    // 3D 뷰어 카드
    "f1.viewer.title": "3D 구조 뷰어",
    "f1.viewer.sub": "3Dmol · 자동 회전",
    "f1.viewer.empty": "구조 파일을 업로드하면 3D 뷰어가 채워집니다.",

    // 구조 메타데이터 카드
    "f1.meta.title": "구조 메타데이터",
    "f1.meta.formula": "화학식",
    "f1.meta.phase": "상 (Phase)",
    "f1.meta.spacegroup": "공간군",
    "f1.meta.atomCount": "원자 수",
    "f1.meta.elements": "원소",
    "f1.meta.cell": "격자상수 (a·b·c)",
    "f1.meta.angles": "격자각 (α·β·γ)",
    "f1.meta.volume": "셀 부피",
    "f1.meta.smear": "SMEAR 권장",
    "f1.meta.smearOn": "권장",
    "f1.meta.smearOff": "비권장",
    "f1.meta.empty": "선택된 활성 구조가 없습니다.",
    "f1.meta.na": "—",

    // 다중-CIF 구조 전환
    "f1.structures.title": "구조 목록",
    "f1.structures.count": "{n}개 구조",
    "f1.active": "활성",

    // 빈/에러 상태
    "f1.empty.title": "아직 업로드된 구조가 없습니다",
    "f1.empty.desc": "결정구조 파일을 업로드하면 ASE가 원자·격자·원소를 분석합니다.",
    "f1.parseFailed": "이 파일은 원자를 추출하지 못했습니다(파싱 실패 또는 빈 CIF). 다른 파일을 시도하세요.",
  },
  en: {
    "f1.placeholder": "Structure input (Step 1) — owned by f1-structure.",

    "f1.input.title": "Structure Input",
    "f1.input.sub": ".cif / .xyz / POSCAR",
    "f1.drop.idle": "Drag & drop a crystal structure file, or click to select",
    "f1.drop.hint": ".cif · .xyz · POSCAR (multiple files allowed)",
    "f1.drop.active": "Drop to start analysis",
    "f1.drop.button": "Select files",
    "f1.analyzing": "Analyzing structure…",
    "f1.fileError": "Analysis failed",
    "f1.valid": "Valid",
    "f1.removeFile": "Remove",
    "f1.clearAll": "Clear all",
    "f1.atomsUnit": "atoms",

    "f1.viewer.title": "3D Structure Viewer",
    "f1.viewer.sub": "3Dmol · auto-rotate",
    "f1.viewer.empty": "Upload a structure file to populate the 3D viewer.",

    "f1.meta.title": "Structure Metadata",
    "f1.meta.formula": "Formula",
    "f1.meta.phase": "Phase",
    "f1.meta.spacegroup": "Space group",
    "f1.meta.atomCount": "Atom count",
    "f1.meta.elements": "Elements",
    "f1.meta.cell": "Lattice (a·b·c)",
    "f1.meta.angles": "Angles (α·β·γ)",
    "f1.meta.volume": "Cell volume",
    "f1.meta.smear": "SMEAR recommended",
    "f1.meta.smearOn": "Yes",
    "f1.meta.smearOff": "No",
    "f1.meta.empty": "No active structure selected.",
    "f1.meta.na": "—",

    "f1.structures.title": "Structures",
    "f1.structures.count": "{n} structures",
    "f1.active": "Active",

    "f1.empty.title": "No structures uploaded yet",
    "f1.empty.desc": "Upload a crystal structure file and ASE will analyze atoms, lattice, and elements.",
    "f1.parseFailed": "This file produced no atoms (parse failure or empty CIF). Try another file.",
  },
};
