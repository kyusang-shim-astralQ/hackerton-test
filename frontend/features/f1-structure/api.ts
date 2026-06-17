// features/f1-structure/api.ts — f1-structure fetch 래퍼 + 목(seed)
// 단일 소스: docs/features/f1-structure/api.md (POST /analyze-cif), docs/contracts/data-models.md (AnalyzeCifResponse)
// 실제 백엔드(:8000)로 동작하며 클러스터 불필요. NEXT_PUBLIC_MOCK=1 이면 시드 응답으로 단독 동작.

import { apiFetch, IS_MOCK } from "@/lib/api";
import type { AnalyzeCifResponse, AtomInfo } from "@/stores/types";

/** content_hash 형태(64자 hex)의 결정적 시드 해시. 본문 길이/파일명 기반 가짜 값(목 전용). */
function seedHash(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const base = h.toString(16).padStart(8, "0");
  return base.repeat(8).slice(0, 64);
}

/**
 * 목 atom_info — 파일명에서 화학식을 추정하기 어려우므로,
 * 데모용으로 잘 수렴하는 가벼운 계(TiO2 anatase / Si / HCN)를 파일명 힌트로 골라 시드.
 * 계약(AtomInfo) 키 집합을 정상 경로 형태로 모두 채운다.
 */
function seedAtomInfo(filename: string): AtomInfo {
  const lower = filename.toLowerCase();

  // 데모 시드 1: TiO2 anatase (전이금속 → SMEAR 권장 경로 시연)
  if (lower.includes("tio2") || lower.includes("anatase") || lower.includes("rutile")) {
    return {
      filename,
      atom_count: 6,
      atoms: [
        { element: "Ti", x: 0.0, y: 0.0, z: 0.0 },
        { element: "Ti", x: 1.8965, y: 1.8965, z: 4.7795 },
        { element: "O", x: 0.0, y: 0.0, z: 2.0762 },
        { element: "O", x: 0.0, y: 0.0, z: -2.0762 },
        { element: "O", x: 1.8965, y: 1.8965, z: 2.7033 },
        { element: "O", x: 1.8965, y: 1.8965, z: 6.8557 },
      ],
      elements: ["Ti", "O"],
      element_counts: { Ti: 2, O: 4 },
      element_indices: { Ti: [1, 2], O: [3, 4, 5, 6] },
      cell: [3.793, 3.793, 9.559],
      cell_angles: [90.0, 90.0, 90.0],
      volume: 137.52,
      full_coord_text:
        "      Ti   0.00000000   0.00000000   0.00000000\n      Ti   1.89650000   1.89650000   4.77950000\n      O    0.00000000   0.00000000   2.07620000",
      full_cell_text:
        "      ABC   3.79300000   3.79300000   9.55900000\n      ALPHA_BETA_GAMMA  90.00000000  90.00000000  90.00000000",
      use_scaled: false,
      smear_recommended: true,
      smear_reason_ko:
        "전이금속 또는 희토류 원소가 포함되어 있어 d/f 오비탈의 축퇴로 인한 수렴 저하를 방지하기 위해 SMEAR 활성화가 권장됩니다.",
      smear_reason_en:
        "Contains transition metal or lanthanide elements. Enabling SMEAR is recommended to prevent SCF convergence issues due to d/f orbital degeneracy.",
      spacegroup: "I 41/a m d",
      phase: "anatase",
    };
  }

  // 데모 시드 2: HCN (분자, 비금속 → SMEAR 비권장 경로)
  if (lower.includes("hcn") || lower.includes("compound")) {
    return {
      filename,
      atom_count: 3,
      atoms: [
        { element: "N", x: -0.0005, y: 0.0003, z: 0.0 },
        { element: "C", x: 1.22, y: -0.0003, z: 0.0 },
        { element: "H", x: 0.8654, y: 1.1478, z: 0.0 },
      ],
      elements: ["N", "C", "H"],
      element_counts: { N: 1, C: 1, H: 1 },
      element_indices: { N: [1], C: [2], H: [3] },
      cell: [10.0, 10.0, 10.0],
      cell_angles: [90.0, 90.0, 90.0],
      volume: 1000.0,
      full_coord_text:
        "      N   -0.00050000   0.00030000   0.00000000\n      C    1.22000000  -0.00030000   0.00000000\n      H    0.86540000   1.14780000   0.00000000",
      full_cell_text:
        "      ABC  10.00000000  10.00000000  10.00000000\n      ALPHA_BETA_GAMMA  90.00000000  90.00000000  90.00000000",
      use_scaled: false,
      smear_recommended: false,
      smear_reason_ko:
        "유기 분자 또는 일반 비금속 구조로 판단되어 SMEAR 비활성화가 권장됩니다. (수렴 실패 시에만 활성화 권장)",
      smear_reason_en:
        "Organic or non-metal structure detected. Smearing is not recommended by default (enable only if SCF convergence fails).",
      spacegroup: "P 1",
      phase: "molecular",
    };
  }

  // 데모 시드 3 (기본): Si 다이아몬드 (가볍고 빠르게 수렴)
  return {
    filename,
    atom_count: 8,
    atoms: [
      { element: "Si", x: 0.0, y: 0.0, z: 0.0 },
      { element: "Si", x: 1.3575, y: 1.3575, z: 1.3575 },
      { element: "Si", x: 2.715, y: 2.715, z: 0.0 },
      { element: "Si", x: 4.0725, y: 4.0725, z: 1.3575 },
      { element: "Si", x: 2.715, y: 0.0, z: 2.715 },
      { element: "Si", x: 4.0725, y: 1.3575, z: 4.0725 },
      { element: "Si", x: 0.0, y: 2.715, z: 2.715 },
      { element: "Si", x: 1.3575, y: 4.0725, z: 4.0725 },
    ],
    elements: ["Si"],
    element_counts: { Si: 8 },
    element_indices: { Si: [1, 2, 3, 4, 5, 6, 7, 8] },
    cell: [5.43, 5.43, 5.43],
    cell_angles: [90.0, 90.0, 90.0],
    volume: 160.103,
    full_coord_text:
      "      Si    0.00000000    0.00000000    0.00000000\n      Si    1.35750000    1.35750000    1.35750000",
    full_cell_text:
      "      ABC   5.43000000   5.43000000   5.43000000\n      ALPHA_BETA_GAMMA  90.00000000  90.00000000  90.00000000",
    use_scaled: false,
    smear_recommended: false,
    smear_reason_ko:
      "일반 반도체/비금속 구조로 판단되어 SMEAR 비활성화가 권장됩니다. (수렴 실패 시에만 활성화 권장)",
    smear_reason_en:
      "Semiconductor/non-metal structure detected. Smearing is not recommended by default (enable only if SCF convergence fails).",
    spacegroup: "F d -3 m",
    phase: "diamond cubic",
  };
}

/**
 * POST /analyze-cif — 업로드한 단일 CIF 파일을 분석해 AnalyzeCifResponse 반환.
 * multipart 필드명은 계약대로 `file`. 메서드는 본문(form)이 있으므로 apiFetch 가 자동 POST.
 * 목 모드: 백엔드 없이 시드 응답(파일명 힌트로 결정).
 */
export async function analyzeCif(file: File): Promise<AnalyzeCifResponse> {
  if (IS_MOCK) {
    const atom_info = seedAtomInfo(file.name);
    // 목 지연(로딩 상태 시연)
    await new Promise((r) => setTimeout(r, 350));
    return {
      status: "success",
      filename: file.name,
      atom_info,
      content_hash: seedHash(`${file.name}:${file.size}`),
    };
  }

  const form = new FormData();
  form.append("file", file);
  return apiFetch<AnalyzeCifResponse>("/analyze-cif", { form });
}
