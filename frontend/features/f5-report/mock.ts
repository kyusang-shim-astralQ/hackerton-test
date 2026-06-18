// features/f5-report/mock.ts — NEXT_PUBLIC_MOCK 시드 (완료 결과 없이 단독 시연)
// 7섹션 마크다운(요약·구조·방법·물성데이터·해석·품질·후속) + summary + per-step 수렴 이력.
// absorption/emission이면 excitations(20개) + Gaussian spectrum 포함.
import type { Excitation, ReportResponse, Spectrum } from "./types";
import { isTddftProperty } from "./types";

const EV_TO_NM = 1239.84;

/** 스텝별 SCF 수렴 이력 (차트용) — step_histories 형태(스텝별 분리). */
export interface MockStepHistory {
  run_type: string;
  label: string;
  scf: number[]; // SCF step 번호
  delta: number[]; // |ΔE| (Ha)
}

export interface MockReport extends ReportResponse {
  /** 차트용 스텝 이력 (계약 외 — 프런트 로컬 시연용. 실 응답엔 없을 수 있어 옵셔널) */
  step_histories?: Record<string, MockStepHistory>;
}

/** 한 스텝의 |ΔE| 수렴 시퀀스 생성 (1e-1 → ~1e-7 로 로그 감쇠) */
function makeDelta(n: number, start = 0.1, seedFactor = 1): number[] {
  const out: number[] = [];
  let v = start * seedFactor;
  for (let i = 0; i < n; i++) {
    out.push(Number(v.toExponential(3)));
    v *= 0.32 + 0.05 * Math.sin(i * 1.3);
  }
  return out;
}

function stepHistory(run_type: string, label: string, n: number, seed = 1): MockStepHistory {
  const delta = makeDelta(n, 0.12, seed);
  return { run_type, label, scf: delta.map((_, i) => i + 1), delta };
}

const PROP_LABEL_KO: Record<string, string> = {
  geo_opt: "구조 최적화 (GeomOpt)",
  single_point: "단일점 에너지 (Single Point)",
  dos: "상태밀도 (DOS)",
  band: "밴드 구조 (Band Structure)",
  aimd: "ab-initio MD",
  vibrational: "진동 분석 (Vibrational)",
  neb: "전이상태 탐색 (NEB)",
  adsorption: "흡착 에너지 (Adsorption)",
  work_function: "일함수 (Work Function)",
  hirshfeld: "Hirshfeld 전하 분석",
  absorption: "흡수 스펙트럼 (TDDFPT)",
  emission: "방출 스펙트럼 (TDDFPT)",
};

/** 단일 구조 7섹션 마크다운 */
function singleMarkdown(property: string, lang: string): string {
  const ko = lang !== "en";
  const propLabel = PROP_LABEL_KO[property] ?? property;
  if (ko) {
    return `# 양자화학 시뮬레이션 최종 연구 리포트

## 1. 요약

본 계산은 **${propLabel}** 물성을 대상으로 CP2K(QuickStep, GPW)로 수행되었으며, 정상적으로 수렴하여 \`PROGRAM ENDED\` 게이트를 통과했다.

* **최종 기저상태 에너지**: \`-1234.567890 a.u.\`
* **타겟 물성치**: 아래 §4 참조

## 2. 구조

- 화학식: TiO₂ (rutile)
- 공간군: \`P4₂/mnm\`
- 격자상수: $a = b = 4.594\\ \\text{Å},\\ c = 2.959\\ \\text{Å}$
- 원자 수: 6

## 3. 방법

| 항목 | 값 |
|---|---|
| 범함수 | PBE |
| 기저 | DZVP-MOLOPT-SR-GTH |
| 유사퍼텐셜 | GTH-PBE |
| 컷오프 | 400 Ry |
| SCF 수렴 | $\\mathrm{EPS\\_SCF} = 10^{-6}$ |

전체에너지는 다음 자유에너지 변분 원리로 수렴한다:

$$E_{\\text{tot}} = \\min_{\\{\\psi_i\\}} \\left[ T_s + E_{\\text{ext}} + E_H + E_{xc} + E_{II} \\right]$$

## 4. 물성 데이터

- **최종 전체에너지**: $E_{\\text{tot}} = -1234.567890\\ \\text{a.u.}$
- **최대 기울기(OPT)**: \`0.000412\` (수렴 임계 \`4.5e-4\` 이하)

## 5. 해석

SCF |ΔE|가 목표 $10^{-6}$ Ha 이하로 단조 감소하여 신뢰할 수 있는 결과다. 최대 기울기가 임계값 미만으로, 구조가 국소 최소점에 안정적으로 도달했다.

## 6. 품질

> [!NOTE]
> 모든 스텝이 \`PROGRAM ENDED\` 게이트를 통과했고, 추출값은 원본 \`.out\` 본문에 존재하여 Zero-Hallucination 크로스체크를 통과했다.

## 7. 후속

- 더 큰 컷오프(500 Ry)로 수렴 테스트 권장
- ${propLabel === "흡수 스펙트럼 (TDDFPT)" ? "여기상태 수 증가로 스펙트럼 정밀도 향상" : "포논/밴드 계산으로 물성 확장 가능"}
`;
  }
  return `# Final Research Report — Quantum Chemistry Simulation

## 1. Summary

This calculation targets the **${property}** property, run with CP2K (QuickStep, GPW). It converged normally and passed the \`PROGRAM ENDED\` gate.

* **Final ground-state energy**: \`-1234.567890 a.u.\`
* **Target property**: see §4

## 2. Structure

- Formula: TiO₂ (rutile)
- Space group: \`P4₂/mnm\`
- Lattice: $a = b = 4.594\\ \\text{Å},\\ c = 2.959\\ \\text{Å}$
- Atoms: 6

## 3. Method

| Item | Value |
|---|---|
| Functional | PBE |
| Basis | DZVP-MOLOPT-SR-GTH |
| Pseudopotential | GTH-PBE |
| Cutoff | 400 Ry |
| SCF | $\\mathrm{EPS\\_SCF} = 10^{-6}$ |

$$E_{\\text{tot}} = \\min_{\\{\\psi_i\\}} \\left[ T_s + E_{\\text{ext}} + E_H + E_{xc} + E_{II} \\right]$$

## 4. Property Data

- **Final total energy**: $E_{\\text{tot}} = -1234.567890\\ \\text{a.u.}$
- **Max gradient (OPT)**: \`0.000412\` (below threshold \`4.5e-4\`)

## 5. Interpretation

SCF |ΔE| decreased monotonically below the $10^{-6}$ Ha target, indicating a reliable result.

## 6. Quality

> [!NOTE]
> All steps passed the \`PROGRAM ENDED\` gate; extracted values exist in the raw \`.out\`, passing the Zero-Hallucination cross-check.

## 7. Next steps

- Recommend convergence test at a larger cutoff (500 Ry).
`;
}

/** 다중 구조 비교 마크다운 (§4 = 구조별 물성 종합 비교 표) */
function multiMarkdown(lang: string): string {
  const ko = lang !== "en";
  if (ko) {
    return `# 다중구조 비교 분석 리포트

## 1. 요약

페로브스카이트 후보 **2종**을 동일 조건으로 구조 최적화(GeomOpt)하여 전체에너지와 안정성을 비교했다.

## 2. 구조

- MAPbI₃, MAPbBr₃ (모두 입방 페로브스카이트 모티프)

## 3. 방법

| 항목 | 값 |
|---|---|
| 범함수 | PBE |
| 기저 | DZVP-MOLOPT-SR-GTH |
| 컷오프 | 400 Ry |

## 4. 구조별 주요 물성 종합 비교

| 구조 | 전체에너지 (a.u.) | 타겟 물성 | 분류 |
|---|---|---|---|
| MAPbI₃ | -2456.112233 | Max Force Grad: 0.000412 | 안정 |
| MAPbBr₃ | -2401.998877 | Max Force Grad: 0.000389 | 안정 |

> 두 구조의 전체에너지가 다르므로 isostructural이 아니다. MAPbI₃가 더 낮은 에너지(더 안정).

## 5. 해석

전체에너지 차 $\\Delta E \\approx 54.11\\ \\text{a.u.}$ 로 MAPbI₃가 열역학적으로 우세하다.

## 6. 품질

> [!NOTE]
> 두 하위작업 모두 \`PROGRAM ENDED\` 게이트 통과.

## 7. 후속

- 밴드갭/흡수 스펙트럼 비교로 광전 특성 스크리닝 확장 권장
`;
  }
  return `# Multi-Structure Comparative Analysis Report

## 1. Summary

Two perovskite candidates were geometry-optimized under identical settings to compare total energy and stability.

## 2. Structure

- MAPbI₃, MAPbBr₃ (cubic perovskite motif)

## 3. Method

| Item | Value |
|---|---|
| Functional | PBE |
| Basis | DZVP-MOLOPT-SR-GTH |
| Cutoff | 400 Ry |

## 4. Comparative Summary of Key Properties by Structure

| Structure | Total energy (a.u.) | Target property | Class |
|---|---|---|---|
| MAPbI₃ | -2456.112233 | Max Force Grad: 0.000412 | stable |
| MAPbBr₃ | -2401.998877 | Max Force Grad: 0.000389 | stable |

> Total energies differ, so the pair is not isostructural; MAPbI₃ is lower (more stable).

## 5. Interpretation

$\\Delta E \\approx 54.11\\ \\text{a.u.}$ favors MAPbI₃ thermodynamically.

## 6. Quality

> [!NOTE]
> Both sub-jobs passed the \`PROGRAM ENDED\` gate.

## 7. Next steps

- Extend screening with band gap / absorption spectra.
`;
}

/** 가시광 영역 라벨 (파장 nm → 영역) */
function regionOf(nm: number, lang: string): string {
  const ko = lang !== "en";
  if (nm < 380) return ko ? "자외" : "UV";
  if (nm < 450) return ko ? "보라" : "violet";
  if (nm < 495) return ko ? "파랑" : "blue";
  if (nm < 570) return ko ? "초록" : "green";
  if (nm < 590) return ko ? "노랑" : "yellow";
  if (nm < 620) return ko ? "주황" : "orange";
  if (nm < 750) return ko ? "빨강" : "red";
  return ko ? "근적외" : "near-IR";
}

/** 20개 들뜸 상태 + Gaussian σ=0.1 eV 스펙트럼(300–950 nm step 2) 생성 */
function makeTddft(lang: string): { excitations: Excitation[]; spectrum: Spectrum } {
  // 에너지(eV) 오름차순. 일부는 암상태(f≈0).
  const seeds: { ev: number; f: number }[] = [
    { ev: 1.45, f: 0.0001 }, // dark
    { ev: 1.78, f: 0.0203 },
    { ev: 2.01, f: 0.0008 }, // dark-ish
    { ev: 2.22, f: 0.1512 },
    { ev: 2.41, f: 0.0421 },
    { ev: 2.63, f: 0.842 }, // λ_max
    { ev: 2.79, f: 0.0009 }, // dark
    { ev: 2.95, f: 0.2331 },
    { ev: 3.08, f: 0.0552 },
    { ev: 3.21, f: 0.4017 },
    { ev: 3.35, f: 0.00005 }, // dark
    { ev: 3.49, f: 0.1188 },
    { ev: 3.61, f: 0.0731 },
    { ev: 3.77, f: 0.3105 },
    { ev: 3.88, f: 0.0014 },
    { ev: 3.99, f: 0.0902 },
    { ev: 4.12, f: 0.1677 },
    { ev: 4.25, f: 0.00008 }, // dark
    { ev: 4.38, f: 0.0488 },
    { ev: 4.51, f: 0.2044 },
  ];

  const excitations: Excitation[] = seeds.map((s, i) => {
    const wavelength_nm = Number((EV_TO_NM / s.ev).toFixed(2));
    const is_dark = s.f < 1e-4;
    return {
      state: i + 1,
      energy_ev: s.ev,
      wavelength_nm,
      osc_strength: s.f,
      is_dark,
      region: regionOf(wavelength_nm, lang),
    };
  });

  // Gaussian σ=0.1 eV 를 300–950 nm / 2 nm 그리드에 합산
  const sigma_ev = 0.1;
  const wavelengths: number[] = [];
  const intensities: number[] = [];
  for (let nm = 300; nm <= 950; nm += 2) {
    const e_grid = EV_TO_NM / nm; // 해당 파장의 eV
    let acc = 0;
    for (const ex of excitations) {
      if (ex.osc_strength <= 0) continue;
      const d = e_grid - ex.energy_ev;
      acc += ex.osc_strength * Math.exp(-(d * d) / (2 * sigma_ev * sigma_ev));
    }
    wavelengths.push(nm);
    intensities.push(Number(acc.toFixed(5)));
  }
  return { excitations, spectrum: { wavelengths, intensities, sigma_ev } };
}

/** 단일 리포트 시드 */
export function mockSingleReport(property: string, lang: string): MockReport {
  const tddft = isTddftProperty(property);
  const base: MockReport = {
    status: "success",
    report: singleMarkdown(property, lang),
    summary: {
      final_energy: "-1234.567890",
      target_property: tddft
        ? "λ_max: 471.4 nm (2.63 eV, f=0.842)"
        : "Max gradient: 0.000412",
    },
    step_histories: {
      "1": stepHistory("GEO_OPT", lang !== "en" ? "① 구조 최적화" : "① GeomOpt", 11, 1),
      "2": stepHistory("ENERGY", lang !== "en" ? "② 단일점 SCF" : "② SCF", 8, 0.7),
    },
  };
  if (tddft) {
    const t = makeTddft(lang);
    base.excitations = t.excitations;
    base.spectrum = t.spectrum;
    base.step_histories = {
      "1": stepHistory("ENERGY", lang !== "en" ? "① 기저상태 SCF" : "① Ground SCF", 9, 1),
      "2": stepHistory("TDDFPT", lang !== "en" ? "② 들뜸상태 (TDDFPT)" : "② TDDFPT", 7, 0.8),
    };
  }
  return base;
}

/** 다중 리포트 시드 (is_multi) */
export function mockMultiReport(lang: string): MockReport {
  return {
    status: "success",
    is_multi: true,
    report: multiMarkdown(lang),
    summary: {
      "MAPbI3.cif": { energy: "-2456.112233", target_property: "Max Force Grad: 0.000412" },
      "MAPbBr3.cif": { energy: "-2401.998877", target_property: "Max Force Grad: 0.000389" },
    },
    step_histories: {
      "MAPbI3.cif::1": stepHistory("GEO_OPT", "MAPbI₃ · ① GeomOpt", 10, 1),
      "MAPbBr3.cif::1": stepHistory("GEO_OPT", "MAPbBr₃ · ① GeomOpt", 10, 0.85),
    },
  };
}

/**
 * MOCK 라우터: property/job_dir 에 따라 단일/다중/흡수 시드 선택.
 * - job_dir 에 "screen"/"multi"/"perovskite" 포함 → 다중
 * - property 가 absorption/emission → 단일 + TDDFPT 블록
 */
export function mockReport(job_dir: string, property: string, lang: string): MockReport {
  const dir = (job_dir ?? "").toLowerCase();
  if (dir.includes("screen") || dir.includes("multi") || dir.includes("perovskite")) {
    return mockMultiReport(lang);
  }
  return mockSingleReport(property || "geo_opt", lang);
}
