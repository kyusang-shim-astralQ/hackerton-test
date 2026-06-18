"use client";
// features/f2-plan/components/dft-option-cards.tsx — 3단계 DFT 옵션 두 카드. 소유: f2 담당.
// 두 카드를 동일 높이로 나란히(.grid-2.cards — design-system §4.5: height 금지·stretch만, margin-top:0).
// 폼 값은 PlanRequest/InpOptions 필드와 1:1 → store.inpOptions 에 동기화.
import React, { useEffect } from "react";
import { Atom, Gauge } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormField, SelectInput, TextInput } from "@/components/ui/form-field";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/provider";
import { useWizardStore } from "@/stores/wizard-store";
import type { InpOptions } from "@/stores/types";
import {
  BASIS_SETS,
  DEFAULT_OPTIONS,
  EPS_SCF_CHOICES,
  FUNCTIONALS,
  MIXING_METHODS,
  OPTIMIZERS,
  PSEUDOPOTENTIALS,
  SCF_ALGOS,
  isOptical,
} from "../constants";
import { selectedPropertyKey } from "./property-select";

/** pot_file 은 PlanRequest 정규 필드지만 공유 InpOptions 타입엔 없어 로컬로 확장(스키마 무수정). */
type InpOptionsExt = InpOptions & { pot_file?: string | null };

/** custom_options 에서 mixing/optimizer 를 읽어 폼 기본값으로 환원. */
function readCustom(opts: InpOptions | undefined, key: string, fallback: string): string {
  const v = opts?.custom_options?.[key];
  return typeof v === "string" ? v : fallback;
}

export function DftOptionCards() {
  const { t } = useT();
  const inpOptions = useWizardStore((s) => s.inpOptions);
  const setInpOptions = useWizardStore((s) => s.setInpOptions);
  const selectedProperties = useWizardStore((s) => s.selectedProperties);
  const structureInfo = useWizardStore((s) => s.structureInfo);

  const property = selectedPropertyKey(selectedProperties);
  const optical = isOptical(property);
  const smearRecommended = structureInfo?.smear_recommended === true;

  // 옵션 미설정 상태로 3단계에 진입하면 기본값을 store 에 시드 →
  // 우측 요약 "핵심 옵션" 블록이 즉시 채워지고, 폼/플랜이 동일 SSOT 를 공유한다.
  useEffect(() => {
    if (inpOptions) return;
    const seed: InpOptionsExt = {
      functional: DEFAULT_OPTIONS.functional,
      basis_set: DEFAULT_OPTIONS.basis_set,
      pot_file: DEFAULT_OPTIONS.pseudo,
      cutoff: DEFAULT_OPTIONS.cutoff,
      rel_cutoff: DEFAULT_OPTIONS.rel_cutoff,
      lsd: DEFAULT_OPTIONS.lsd,
      eps_scf: DEFAULT_OPTIONS.eps_scf,
      max_scf: DEFAULT_OPTIONS.max_scf,
      scf_algo: optical ? "DIAGONALIZATION" : DEFAULT_OPTIONS.scf_algo,
      use_smear: DEFAULT_OPTIONS.use_smear || smearRecommended,
      smear_temp: DEFAULT_OPTIONS.smear_temp,
      custom_options: {
        mixing_method: DEFAULT_OPTIONS.mixing,
        optimizer: DEFAULT_OPTIONS.optimizer,
      },
    };
    setInpOptions(seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inpOptions]);

  // 현재 폼 값(store 우선, 없으면 기본값)
  const o: InpOptionsExt = inpOptions ?? {};
  const functional = o.functional ?? DEFAULT_OPTIONS.functional;
  const basis_set = o.basis_set ?? DEFAULT_OPTIONS.basis_set;
  const pseudo = o.pot_file ?? DEFAULT_OPTIONS.pseudo;
  const cutoff = o.cutoff ?? DEFAULT_OPTIONS.cutoff;
  const rel_cutoff = o.rel_cutoff ?? DEFAULT_OPTIONS.rel_cutoff;
  const spin = o.lsd ? "uks" : "rks";

  const eps_scf = o.eps_scf ?? DEFAULT_OPTIONS.eps_scf;
  const max_scf = o.max_scf ?? DEFAULT_OPTIONS.max_scf;
  // 광학은 SCF 알고리즘이 DIAGONALIZATION 으로 고정됨(§만들것1)
  const scf_algo = optical ? "DIAGONALIZATION" : o.scf_algo ?? DEFAULT_OPTIONS.scf_algo;
  const mixing = readCustom(o, "mixing_method", DEFAULT_OPTIONS.mixing);
  const optimizer = readCustom(o, "optimizer", DEFAULT_OPTIONS.optimizer);
  const use_smear = o.use_smear ?? DEFAULT_OPTIONS.use_smear;
  const smear_temp = o.smear_temp ?? DEFAULT_OPTIONS.smear_temp;

  /** 부분 갱신 — store.inpOptions 병합. custom_options 는 별도 머지. */
  function patch(next: Partial<InpOptionsExt>) {
    setInpOptions({ ...o, ...next });
  }
  function patchCustom(key: string, value: string) {
    setInpOptions({ ...o, custom_options: { ...(o.custom_options ?? {}), [key]: value } });
  }

  return (
    <div className="grid-2 cards">
      {/* 전자 구조 설정 */}
      <Card>
        <CardHead
          icon={<Atom size={18} strokeWidth={1.8} />}
          title={t("f2.opt.electronic.title")}
        />
        <FormField label={t("f2.opt.functional")} htmlFor="f2-functional">
          <SelectInput
            id="f2-functional"
            value={functional}
            onChange={(e) => patch({ functional: e.target.value })}
          >
            {FUNCTIONALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label={t("f2.opt.basis_set")} htmlFor="f2-basis">
          <SelectInput
            id="f2-basis"
            mono
            value={basis_set}
            onChange={(e) => patch({ basis_set: e.target.value })}
          >
            {BASIS_SETS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label={t("f2.opt.pseudo")} htmlFor="f2-pseudo">
          <SelectInput
            id="f2-pseudo"
            mono
            value={pseudo}
            onChange={(e) => patch({ pot_file: e.target.value })}
          >
            {PSEUDOPOTENTIALS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <div className="grid grid-cols-2 gap-s4">
          <FormField label={t("f2.opt.cutoff")} htmlFor="f2-cutoff">
            <TextInput
              id="f2-cutoff"
              mono
              type="number"
              inputMode="decimal"
              value={cutoff}
              onChange={(e) => patch({ cutoff: Number(e.target.value) })}
            />
          </FormField>
          <FormField label={t("f2.opt.rel_cutoff")} htmlFor="f2-relcutoff">
            <TextInput
              id="f2-relcutoff"
              mono
              type="number"
              inputMode="decimal"
              value={rel_cutoff}
              onChange={(e) => patch({ rel_cutoff: Number(e.target.value) })}
            />
          </FormField>
        </div>

        <FormField label={t("f2.opt.spin")} htmlFor="f2-spin">
          <Segmented
            aria-label={t("f2.opt.spin")}
            value={spin}
            onValueChange={(v) => patch({ lsd: v === "uks" })}
            items={[
              { value: "rks", label: t("f2.opt.spin.rks") },
              { value: "uks", label: t("f2.opt.spin.uks") },
            ]}
          />
        </FormField>
      </Card>

      {/* SCF 수렴 설정 */}
      <Card>
        <CardHead icon={<Gauge size={18} strokeWidth={1.8} />} title={t("f2.opt.scf.title")} />

        <FormField label={t("f2.opt.eps_scf")} htmlFor="f2-eps">
          <SelectInput
            id="f2-eps"
            mono
            value={eps_scf}
            onChange={(e) => patch({ eps_scf: e.target.value })}
          >
            {EPS_SCF_CHOICES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <div className="grid grid-cols-2 gap-s4">
          <FormField label={t("f2.opt.max_scf")} htmlFor="f2-maxscf">
            <TextInput
              id="f2-maxscf"
              mono
              type="number"
              inputMode="numeric"
              value={max_scf ?? ""}
              onChange={(e) =>
                patch({ max_scf: e.target.value === "" ? null : Number(e.target.value) })
              }
            />
          </FormField>
          <FormField label={t("f2.opt.scf_algo")} htmlFor="f2-scfalgo">
            <SelectInput
              id="f2-scfalgo"
              mono
              value={scf_algo}
              disabled={optical}
              onChange={(e) => patch({ scf_algo: e.target.value })}
            >
              {SCF_ALGOS.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </SelectInput>
          </FormField>
        </div>

        <FormField label={t("f2.opt.mixing")} htmlFor="f2-mixing">
          <SelectInput
            id="f2-mixing"
            mono
            value={mixing}
            onChange={(e) => patchCustom("mixing_method", e.target.value)}
          >
            {MIXING_METHODS.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label={t("f2.opt.smear")} htmlFor="f2-smear">
          <div className="flex items-center gap-s4">
            <Segmented
              aria-label={t("f2.opt.smear")}
              value={use_smear ? "on" : "off"}
              onValueChange={(v) => patch({ use_smear: v === "on" })}
              items={[
                { value: "off", label: t("f2.opt.smear.off") },
                { value: "on", label: t("f2.opt.smear.on") },
              ]}
            />
            {use_smear ? (
              <TextInput
                aria-label={t("f2.opt.smear_temp")}
                mono
                type="number"
                inputMode="decimal"
                className="w-[110px]"
                value={smear_temp}
                onChange={(e) => patch({ smear_temp: Number(e.target.value) })}
              />
            ) : null}
            {smearRecommended ? (
              <Badge variant="green">{t("f2.opt.smear.recommended")}</Badge>
            ) : null}
          </div>
        </FormField>

        <FormField label={t("f2.opt.optimizer")} htmlFor="f2-optimizer">
          <Segmented
            aria-label={t("f2.opt.optimizer")}
            value={optimizer}
            onValueChange={(v) => patchCustom("optimizer", v)}
            items={OPTIMIZERS.map((v) => ({ value: v, label: v }))}
          />
        </FormField>
      </Card>
    </div>
  );
}
