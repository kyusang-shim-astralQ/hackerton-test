// features/f1-structure/api.ts — f1 도메인 fetch 래퍼 (소유: f1 담당)
// 단일 소스: docs/features/f1-structure/api.md (POST /analyze-cif, multipart 필드 file)
//            docs/contracts/data-models.md §1 AtomInfo / §2 AnalyzeCifResponse
// NEXT_PUBLIC_MOCK=1 이면 백엔드 없이 시드로 단독 동작 (idle 금지).
import { apiFetch, ApiError, MOCK } from "@/lib/api";
import type { AtomInfo } from "@/stores/types";

/** AnalyzeCifResponse (data-models §2) */
export interface AnalyzeCifResponse {
  status: string;
  filename: string;
  atom_info: AtomInfo;
  content_hash: string;
}

/**
 * 업로드된 한 파일을 분석한다. multipart/form-data, 필드명은 반드시 `file`.
 * 백엔드는 .cif가 아닌 파일에 400을 던지므로 호출 전 확장자를 한 번 거른다.
 */
export async function analyzeCif(file: File): Promise<AnalyzeCifResponse> {
  if (MOCK) return mockAnalyze(file);

  const form = new FormData();
  form.append("file", file);
  // body(form)가 있으므로 apiFetch가 자동 POST. (lib/api.ts 규칙)
  return apiFetch<AnalyzeCifResponse>("/analyze-cif", { form });
}

// ── 목 시드 (NEXT_PUBLIC_MOCK=1) ─────────────────────────────────────────
// 실제 /analyze-cif 응답 형태와 동일한 정상 경로 AtomInfo를 만들어 단독 시연.

function mockAnalyze(file: File): Promise<AnalyzeCifResponse> {
  // 비-cif는 백엔드와 동일하게 400 흉내
  if (!file.name.toLowerCase().endsWith(".cif")) {
    return Promise.reject(new ApiError("Only .cif files are allowed.", 400, null));
  }
  const seed = MOCK_SEEDS[file.name] ?? makeSeed(file.name);
  // 살짝 지연을 줘 로딩 상태가 보이게 한다.
  return new Promise((resolve) => {
    setTimeout(
      () =>
        resolve({
          status: "success",
          filename: file.name,
          atom_info: seed,
          content_hash: fakeHash(file.name),
        }),
      300,
    );
  });
}

// 64자 hex 모양의 결정적 가짜 해시 (본문 대신 파일명 기반 — 목 전용)
function fakeHash(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).padStart(8, "0");
  return hex.repeat(8).slice(0, 64);
}

function makeSeed(name: string): AtomInfo {
  // 임의 파일명에도 보여줄 게 있도록 Si 다이아몬드를 기본 시드로.
  return {
    filename: name,
    atom_count: 2,
    atoms: [
      { element: "Si", x: 0.0, y: 0.0, z: 0.0 },
      { element: "Si", x: 1.3575, y: 1.3575, z: 1.3575 },
    ],
    elements: ["Si"],
    element_counts: { Si: 2 },
    element_indices: { Si: [1, 2] },
    cell: [5.43, 5.43, 5.43],
    cell_angles: [90.0, 90.0, 90.0],
    volume: 160.103,
    full_coord_text: "",
    full_cell_text: "",
    use_scaled: false,
    smear_recommended: false,
    smear_reason_ko: "일반 비금속 구조로 판단되어 SMEAR 비활성화가 권장됩니다.",
    smear_reason_en: "Non-metal structure detected; SMEAR not recommended by default.",
  };
}

const MOCK_SEEDS: Record<string, AtomInfo> = {
  "TiO2_anatase.cif": {
    filename: "TiO2_anatase.cif",
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
    full_coord_text: "",
    full_cell_text: "",
    use_scaled: false,
    smear_recommended: true,
    smear_reason_ko:
      "전이금속(Ti)이 포함되어 d 오비탈 축퇴로 인한 수렴 저하를 막기 위해 SMEAR 활성화가 권장됩니다.",
    smear_reason_en:
      "Contains transition metal (Ti). Enabling SMEAR is recommended to aid SCF convergence.",
  },
  "Si.cif": {
    filename: "Si.cif",
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
    full_coord_text: "",
    full_cell_text: "",
    use_scaled: false,
    smear_recommended: false,
    smear_reason_ko: "일반 비금속(반도체) 구조로 SMEAR 비활성화가 권장됩니다.",
    smear_reason_en: "Semiconductor structure; SMEAR not recommended by default.",
  },
};
