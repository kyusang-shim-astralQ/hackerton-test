// features/f5-report/api.ts — f5-report fetch 래퍼 + MOCK MODE 시드.
// 단일 소스: docs/features/f5-report/api.md (POST /generate-report, GET /download-job/{job_name})
//            docs/contracts/data-models.md §16 ReportRequest · §17 ReportData
// ★ 상위 결과(완료된 job_dir)가 없으면 NEXT_PUBLIC_MOCK 시드로 단독 동작(idle 금지).
"use client";

import { apiFetch, IS_MOCK } from "@/lib/api";
import type { Lang } from "@/lib/i18n";
import type { ReportData } from "@/stores/types";

/** data-models.md §16 ReportRequest */
export interface ReportRequest {
  job_dir: string;
  property?: string;
  lang?: Lang;
}

/** E(eV) → λ(nm) = 1239.84 / E (api.md 외부 의존성 상수) */
export const EV_TO_NM = 1239.84;

/* ──────────────────────────────────────────────────────────────────────────
 * 실제 호출
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * POST /generate-report — 완료된 작업 디렉토리를 분석해 마크다운 리포트를 받는다.
 * MOCK MODE: NEXT_PUBLIC_MOCK==="1" 이거나 job_dir 가 비면 시드 데이터로 대체.
 */
export async function generateReport(
  req: ReportRequest
): Promise<ReportData> {
  const property = (req.property ?? "geo_opt").toLowerCase();
  const lang: Lang = req.lang ?? "ko";

  if (IS_MOCK || !req.job_dir) {
    return mockReport(property, lang);
  }

  // api.md: body = { job_dir, property, lang }. 본문이 있으므로 apiFetch 가 자동 POST.
  const data = await apiFetch<ReportData>("/generate-report", {
    json: { job_dir: req.job_dir, property, lang },
  });
  return data;
}

/** GET /download-job/{job_name} — 전체 결과 tar.gz blob 다운로드. */
export async function downloadJob(jobName: string): Promise<void> {
  const res = await apiFetch<Response>(
    `/download-job/${encodeURIComponent(jobName)}`,
    { raw: true }
  );
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${jobName}.tar.gz`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ──────────────────────────────────────────────────────────────────────────
 * 에러 축약형 방어 (api.md "status 덧씌움 주의")
 *   디렉토리 없음/데이터 없음 → { report:<에러문구>, summary:{} } 축약형.
 *   summary == {} 이고 is_multi/excitations 부재이면 에러로 간주.
 * ──────────────────────────────────────────────────────────────────────── */
export function isErrorReport(data: ReportData | undefined): boolean {
  if (!data) return true;
  const summaryEmpty =
    !data.summary || Object.keys(data.summary).length === 0;
  return summaryEmpty && !data.is_multi && !data.excitations;
}

/* ──────────────────────────────────────────────────────────────────────────
 * MOCK MODE 시드 — ReportData 형태(마크다운 7섹션 + summary + per-step).
 *   property 로 단일 / 다중-CIF / absorption 분기.
 * ──────────────────────────────────────────────────────────────────────── */

export function mockReport(property: string, lang: Lang): ReportData {
  if (property === "absorption" || property === "emission") {
    return mockAbsorptionReport(lang);
  }
  if (property === "__multi__") {
    return mockMultiReport(lang);
  }
  return mockSingleReport(lang);
}

/* ── 단일 구조 (geo_opt) ── */
function mockSingleReport(lang: Lang): ReportData {
  const report =
    lang === "en"
      ? SINGLE_MD_EN
      : SINGLE_MD_KO;
  return {
    status: "success",
    report,
    summary: {
      final_energy: "-245.339712 au",
      target_property: "Max Force Grad: 0.00041200",
    },
  };
}

/* ── 다중 구조 비교 (geo_opt) ── */
function mockMultiReport(lang: Lang): ReportData {
  return {
    status: "success",
    is_multi: true,
    report: lang === "en" ? MULTI_MD_EN : MULTI_MD_KO,
    summary: {
      "MAPbI3.cif": {
        energy: "-2456.112233 au",
        target_property: "Max Force Grad: 0.00041200",
      },
      "MAPbBr3.cif": {
        energy: "-2401.998877 au",
        target_property: "Max Force Grad: 0.00038900",
      },
      "MAPbCl3.cif": {
        energy: "-2356.554411 au",
        target_property: "Max Force Grad: 0.00035100",
      },
    },
  };
}

/* ── 흡수 (TDDFPT) — 20 상태 excitations + Gaussian spectrum ── */
function mockAbsorptionReport(lang: Lang): ReportData {
  const excitations = buildMockExcitations();
  const spectrum = buildMockSpectrum(excitations, 0.1);
  // 최강 피크 = summary.target_property (api.md: 최강 피크 한 줄)
  const strongest = [...excitations].sort(
    (a, b) => b.osc_strength - a.osc_strength
  )[0];
  const target = `λ_max: ${strongest.wavelength_nm.toFixed(1)} nm (${strongest.energy_ev.toFixed(
    3
  )} eV, f=${strongest.osc_strength.toFixed(3)})`;

  return {
    status: "success",
    report: lang === "en" ? ABS_MD_EN(target) : ABS_MD_KO(target),
    summary: {
      final_energy: "-1234.567890 au",
      target_property: target,
    },
    excitations,
    spectrum,
  };
}

/** 가시광 영역 라벨(파장 nm → 한국어/영문 무관 영역 키 — 표시 시 그대로 노출). */
function regionLabel(nm: number): string {
  if (nm < 380) return "UV";
  if (nm < 450) return "Violet";
  if (nm < 495) return "Blue";
  if (nm < 570) return "Green";
  if (nm < 590) return "Yellow";
  if (nm < 620) return "Orange";
  if (nm < 750) return "Red";
  return "NIR";
}

/** 20개 들뜸 상태(에너지 오름차순). is_dark = osc < 1e-4. */
function buildMockExcitations(): NonNullable<ReportData["excitations"]> {
  // (energy_ev, osc_strength) 쌍 — 가시영역에 강한 피크 + 일부 암상태 포함
  const raw: [number, number][] = [
    [1.62, 0.0],
    [1.88, 0.0123],
    [2.11, 0.0008],
    [2.34, 0.2451],
    [2.57, 0.0],
    [2.78, 0.0421],
    [2.91, 0.0],
    [3.01, 0.8423],
    [3.18, 0.0034],
    [3.29, 0.1567],
    [3.41, 0.0],
    [3.55, 0.3122],
    [3.67, 0.0019],
    [3.79, 0.0],
    [3.92, 0.4876],
    [4.08, 0.0,],
    [4.21, 0.0723],
    [4.35, 0.0],
    [4.52, 0.2011],
    [4.71, 0.0091],
  ];
  return raw.map(([energy_ev, osc_strength], i) => {
    const wavelength_nm = EV_TO_NM / energy_ev;
    return {
      state: i + 1,
      energy_ev,
      wavelength_nm,
      osc_strength,
      is_dark: osc_strength < 1e-4,
      region: regionLabel(wavelength_nm),
    };
  });
}

/** Gaussian σ(eV) 브로드닝을 300–950 nm / 2 nm 그리드에 합산(intensities). */
function buildMockSpectrum(
  excitations: NonNullable<ReportData["excitations"]>,
  sigmaEv: number
): NonNullable<ReportData["spectrum"]> {
  const wavelengths: number[] = [];
  for (let nm = 300; nm <= 950; nm += 2) wavelengths.push(nm);
  const intensities = wavelengths.map((nm) => {
    const eAtNm = EV_TO_NM / nm; // 이 파장의 에너지(eV)
    let sum = 0;
    for (const ex of excitations) {
      if (ex.osc_strength <= 0) continue;
      const d = eAtNm - ex.energy_ev;
      sum += ex.osc_strength * Math.exp(-(d * d) / (2 * sigmaEv * sigmaEv));
    }
    return sum;
  });
  return { wavelengths, intensities, sigma_ev: sigmaEv };
}

/* ──────────────────────────────────────────────────────────────────────────
 * 마크다운 본문(7섹션, report_absorption.html 형식 미러)
 * ──────────────────────────────────────────────────────────────────────── */

const SINGLE_MD_KO = `# 양자화학 시뮬레이션 최종 연구 리포트

## 1. 요약
본 계산은 정방정계 아나타제 \`TiO₂\` 단위격자에 대한 기하학적 최적화(GEO_OPT)를 PBE 범함수 수준에서 수행한 결과입니다. 최종 기저상태 에너지는 \`-245.339712 a.u.\`로 수렴하였으며, 최대 힘 기울기는 \`4.12 × 10⁻⁴ a.u./Bohr\`까지 완화되어 BFGS 수렴 기준을 충족하였습니다. 초기 실험 좌표 대비 결합 길이가 미세하게 이완되어 물리적으로 타당한 평형 구조를 확보하였습니다.

## 2. 계산 대상 구조

| 항목 | 값 |
|---|---|
| 화학식 | TiO₂ (anatase) |
| 원자 수 | 6 |
| 공간군 | I4₁/amd |
| 격자 a, b, c (Å) | 3.793, 3.793, 9.559 |

## 3. 계산 방법
계산은 CP2K(QUICKSTEP, GPW)로 수행하였으며, 교환-상관 범함수는 PBE, 기저세트는 \`DZVP-MOLOPT-GTH\`, 평면파 컷오프 \`600 Ry\`(REL_CUTOFF \`60 Ry\`)를 사용하였습니다. RUN_TYPE은 \`GEO_OPT\`(BFGS)이며 SCF 수렴 기준은 \`EPS_SCF = 1.0 × 10⁻⁶\` 입니다.

> PBE는 d-오비탈을 가진 전이금속 산화물의 밴드갭을 과소평가하는 경향이 있으므로, 전자구조 정량 분석에는 하이브리드(HSE06) 또는 DFT+U 보정을 권장합니다.

## 4. 주요 물성 데이터
구조 최적화로 얻은 핵심 수치는 아래와 같습니다.

| 물성 | 값 | 단위 |
|---|---|---|
| 최종 전체 에너지 | -245.339712 | a.u. |
| 최대 힘 기울기 | 4.12 × 10⁻⁴ | a.u./Bohr |
| SCF 수렴 사이클(최종 스텝) | 14 | — |

수렴 거동은 에너지 변화량 $|\\Delta E|$가 사이클마다 약 한 자릿수씩 감소하여 목표 $\\varepsilon_{\\mathrm{SCF}} = 10^{-6}$ 에 안정적으로 도달함을 보였습니다.

## 5. 결과 해석
최종 구조의 잔류 힘이 임계값 이하로 수렴하였다는 것은 원자들이 퍼텐셜 에너지 표면의 국소 최소점에 위치함을 의미합니다. 전체 에너지의 단조 감소와 $|\\Delta E|$의 지수적 수렴은 SCF 절차가 수치적으로 안정적이었음을 시사합니다.

## 6. 계산 품질 평가
SCF 및 기하 최적화가 모두 수렴 기준을 충족하였고, 자가치유 개입 없이 완주하였습니다. 결과의 신뢰도는 높습니다.

> 정량적 밴드갭·광학 물성이 목적이라면 컷오프 수렴 테스트와 범함수 상향이 선행되어야 합니다.

## 7. 권장 후속 계산
1. 최적화된 구조에 대한 단일점(ENERGY) 계산으로 전체 에너지를 재확인합니다.
2. HSE06 하이브리드 범함수로 밴드갭을 재평가합니다.
3. DOS/PDOS 계산으로 가전자대-전도대 특성을 분석합니다.
`;

const SINGLE_MD_EN = `# Final Research Report — Quantum Chemistry Simulation

## 1. Summary
This calculation performed a geometry optimization (GEO_OPT) of the tetragonal anatase \`TiO₂\` unit cell at the PBE level. The final ground-state energy converged to \`-245.339712 a.u.\`, with the maximum force gradient relaxed to \`4.12 × 10⁻⁴ a.u./Bohr\`, satisfying the BFGS convergence criterion. A physically reasonable equilibrium structure was obtained.

## 2. Target Structure

| Item | Value |
|---|---|
| Formula | TiO₂ (anatase) |
| Atoms | 6 |
| Space group | I4₁/amd |
| Lattice a, b, c (Å) | 3.793, 3.793, 9.559 |

## 3. Method
CP2K (QUICKSTEP, GPW); XC functional PBE; basis \`DZVP-MOLOPT-GTH\`; plane-wave cutoff \`600 Ry\` (REL_CUTOFF \`60 Ry\`). RUN_TYPE \`GEO_OPT\` (BFGS); SCF criterion \`EPS_SCF = 1.0 × 10⁻⁶\`.

> PBE tends to underestimate the band gap of transition-metal oxides with d-orbitals; hybrid (HSE06) or DFT+U corrections are recommended for quantitative electronic-structure analysis.

## 4. Key Property Data

| Property | Value | Unit |
|---|---|---|
| Final total energy | -245.339712 | a.u. |
| Max force gradient | 4.12 × 10⁻⁴ | a.u./Bohr |
| SCF cycles (last step) | 14 | — |

The energy change $|\\Delta E|$ decreased by roughly one order of magnitude per cycle, reaching the target $\\varepsilon_{\\mathrm{SCF}} = 10^{-6}$ stably.

## 5. Interpretation
Residual forces below threshold indicate the atoms sit at a local minimum of the potential energy surface. The monotonic energy decrease and exponential $|\\Delta E|$ convergence suggest a numerically stable SCF procedure.

## 6. Quality Assessment
Both SCF and geometry optimization met convergence criteria and finished without self-healing intervention. Reliability is high.

> For quantitative band gaps / optical properties, run cutoff convergence tests and use a higher-level functional first.

## 7. Recommended Follow-up
1. Single-point (ENERGY) on the optimized structure to reconfirm the total energy.
2. Re-evaluate the band gap with the HSE06 hybrid functional.
3. DOS/PDOS analysis of valence/conduction band character.
`;

const MULTI_MD_KO = `# 다중 구조 비교 분석 리포트

## 1. 요약
세 가지 할라이드 페로브스카이트 \`MAPbX₃\` (X = I, Br, Cl)에 대해 동일한 PBE/\`DZVP-MOLOPT-GTH\` 수준에서 기하 최적화를 수행하고 전체 에너지를 비교하였습니다. 세 구조 모두 BFGS 기준으로 수렴하였으며, 할로겐 원자번호가 작아질수록 전체 에너지가 체계적으로 상승합니다.

## 2. 계산 대상 구조
세 구조 모두 \`Pm-3m\` 입방 페로브스카이트 골격을 공유하며, 할로겐 음이온만 다릅니다(isostructural).

## 3. 계산 방법
CP2K(QUICKSTEP, GPW), PBE, \`DZVP-MOLOPT-GTH\`, 컷오프 \`400 Ry\`, RUN_TYPE \`GEO_OPT\`(BFGS), \`EPS_SCF = 1.0 × 10⁻⁶\`. 세 구조에 동일 파라미터를 적용해 직접 비교가 가능합니다.

## 4. 구조별 주요 물성 종합 비교
아래 표는 구조별 전체 에너지와 타겟 물성(최대 힘 기울기), 상대 안정성을 종합한 것입니다. 세 구조는 동일 골격(isostructural)이므로 에너지 차이는 주로 할로겐 치환 효과에서 기인합니다.

| 구조 | 전체 에너지 (a.u.) | 최대 힘 기울기 | 상대 안정성 |
|---|---|---|---|
| MAPbI3.cif | -2456.112233 | 4.12 × 10⁻⁴ | 가장 안정 |
| MAPbBr3.cif | -2401.998877 | 3.89 × 10⁻⁴ | 중간 |
| MAPbCl3.cif | -2356.554411 | 3.51 × 10⁻⁴ | 가장 불안정 |

## 5. 결과 해석
전체 에너지는 $\\mathrm{I} < \\mathrm{Br} < \\mathrm{Cl}$ 순으로 낮아, 무거운 할로겐일수록 격자가 안정함을 보입니다. 이는 할로겐의 분극률과 Pb–X 결합 공유성 증가로 해석할 수 있습니다.

## 6. 계산 품질 평가
세 계산 모두 동일 프로토콜로 수렴하여 상호 비교의 타당성이 확보되었습니다.

> 절대 에너지의 직접 비교는 동일 기저·컷오프에서만 유효합니다.

## 7. 권장 후속 계산
1. 각 조성에 대한 밴드갭(HSE06) 비교로 광흡수 한계를 평가합니다.
2. 혼합 할라이드(예: \`MAPbI₂Br\`) 조성의 보간 거동을 조사합니다.
`;

const MULTI_MD_EN = `# Multi-Structure Comparative Analysis Report

## 1. Summary
Three halide perovskites \`MAPbX₃\` (X = I, Br, Cl) were geometry-optimized at the same PBE/\`DZVP-MOLOPT-GTH\` level and their total energies compared. All three converged under BFGS, and the total energy rises systematically as the halogen atomic number decreases.

## 2. Target Structures
All three share the cubic \`Pm-3m\` perovskite framework, differing only in the halide anion (isostructural).

## 3. Method
CP2K (QUICKSTEP, GPW), PBE, \`DZVP-MOLOPT-GTH\`, cutoff \`400 Ry\`, RUN_TYPE \`GEO_OPT\` (BFGS), \`EPS_SCF = 1.0 × 10⁻⁶\`. Identical parameters enable direct comparison.

## 4. Comparative Summary of Key Properties by Structure
Energy differences arise mainly from halide substitution since the structures are isostructural.

| Structure | Total Energy (a.u.) | Max Force Gradient | Relative Stability |
|---|---|---|---|
| MAPbI3.cif | -2456.112233 | 4.12 × 10⁻⁴ | Most stable |
| MAPbBr3.cif | -2401.998877 | 3.89 × 10⁻⁴ | Intermediate |
| MAPbCl3.cif | -2356.554411 | 3.51 × 10⁻⁴ | Least stable |

## 5. Interpretation
Total energies follow $\\mathrm{I} < \\mathrm{Br} < \\mathrm{Cl}$, indicating heavier halides stabilize the lattice — consistent with increased halide polarizability and Pb–X covalency.

## 6. Quality Assessment
All three calculations converged under an identical protocol, validating the comparison.

> Direct comparison of absolute energies is valid only at the same basis/cutoff.

## 7. Recommended Follow-up
1. Compare band gaps (HSE06) across compositions to assess optical limits.
2. Study interpolation behavior of mixed-halide compositions (e.g. \`MAPbI₂Br\`).
`;

const ABS_MD_KO = (target: string): string => `# 흡수 스펙트럼 시뮬레이션 연구 리포트

## 1. 요약
본 계산은 유기 발색단에 대한 TDDFPT(시간의존 밀도범함수 섭동론) 흡수 스펙트럼 계산입니다. 기저상태 에너지는 \`-1234.567890 a.u.\`이며, 가장 강한 흡수는 \`${target}\` 으로 가시광 영역에 위치합니다. 총 20개의 들뜸 상태를 산출하였고, 일부는 진동자 세기가 0에 가까운 암상태(dark state)입니다.

## 2. 계산 대상 구조

| 항목 | 값 |
|---|---|
| 계 | 유기 발색단 (closed-shell) |
| 들뜸 상태 수 | 20 |
| 다중도 | 1 (singlet) |

## 3. 계산 방법
CP2K(QUICKSTEP, GPW) + TDDFPT(Davidson). 범함수 PBE, 기저 \`DZVP-MOLOPT-GTH\`. 흡수 파장은 $\\lambda(\\text{nm}) = 1239.84 / E(\\text{eV})$ 로 환산하였습니다.

> PBE 기반 TD-DFT는 들뜸 에너지를 과소평가하고 전하이동(CT) 상태를 부정확하게 기술하는 경향이 있습니다.

## 4. 주요 물성 데이터
아래는 산출된 들뜸 상태와 진동자 세기 $f$ 입니다. 강한 흡수 피크(밝은 상태)와 대칭 금지 전이로 보이는 암상태($f \\approx 0$)가 함께 나타납니다. 전체 표·피크 표는 본 리포트 하단의 구조화 데이터(차트·테이블)로 함께 제시됩니다.

가장 강한 흡수: ${target}.

## 5. 결과 해석
최강 피크의 보색이 화합물의 외관 색을 결정합니다. 진동자 세기가 거의 0인 암상태는 대칭 금지(symmetry-forbidden) 전이로, 실제 흡수 스펙트럼에는 거의 기여하지 않습니다. PBE TD-DFT의 흡수 에너지 과소평가를 고려하면 실제 $\\lambda_{\\max}$ 는 다소 단파장(blue-shift) 쪽일 수 있습니다.

## 6. 계산 품질 평가
Davidson 반복이 모든 목표 상태에 대해 수렴하였습니다. 정성적 스펙트럼 형상은 신뢰할 수 있으나, 절대 에너지는 범함수 한계를 감안해야 합니다.

> 정량적 흡수 에너지에는 range-separated 범함수(CAM-B3LYP 등)를 권장합니다.

## 7. 권장 후속 계산
1. range-separated 범함수로 $\\lambda_{\\max}$ 재평가.
2. 용매 효과(implicit solvation) 포함 재계산.
3. 자연전이궤도(NTO) 분석으로 전이 성격 규명.
`;

const ABS_MD_EN = (target: string): string => `# Absorption Spectrum Simulation Report

## 1. Summary
This is a TDDFPT absorption-spectrum calculation of an organic chromophore. The ground-state energy is \`-1234.567890 a.u.\`, and the strongest absorption is \`${target}\`, lying in the visible region. Twenty excited states were obtained, some of which are near-zero oscillator-strength dark states.

## 2. Target Structure

| Item | Value |
|---|---|
| System | Organic chromophore (closed-shell) |
| Excited states | 20 |
| Multiplicity | 1 (singlet) |

## 3. Method
CP2K (QUICKSTEP, GPW) + TDDFPT (Davidson). Functional PBE, basis \`DZVP-MOLOPT-GTH\`. Wavelengths via $\\lambda(\\text{nm}) = 1239.84 / E(\\text{eV})$.

> PBE-based TD-DFT tends to underestimate excitation energies and poorly describes charge-transfer (CT) states.

## 4. Key Property Data
Excited states and oscillator strengths $f$ below. Bright peaks coexist with near-zero dark states ($f \\approx 0$). The full state and peak tables are presented as structured data (chart + tables) at the bottom of this report.

Strongest absorption: ${target}.

## 5. Interpretation
The complementary color of the strongest peak determines the compound's apparent color. Near-zero dark states are symmetry-forbidden transitions and contribute little to the observed spectrum. Given PBE's underestimation, the true $\\lambda_{\\max}$ may be somewhat blue-shifted.

## 6. Quality Assessment
The Davidson iterations converged for all target states. The qualitative spectral shape is reliable, but absolute energies should account for functional limitations.

> Range-separated functionals (e.g. CAM-B3LYP) are recommended for quantitative excitation energies.

## 7. Recommended Follow-up
1. Re-evaluate $\\lambda_{\\max}$ with a range-separated functional.
2. Recompute with implicit solvation.
3. Natural transition orbital (NTO) analysis of transition character.
`;
