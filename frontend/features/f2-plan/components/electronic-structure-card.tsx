// features/f2-plan/components/electronic-structure-card.tsx — 3단계 전자 구조 설정 카드.
"use client";

import { Atom } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import {
  FormField,
  TextInput,
  SelectInput,
  Grid2,
} from "@/components/ui/form-field";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/use-t";
import { useInpOptions } from "../hooks/use-inp-options";

const FUNCTIONALS = ["PBE", "PBE0", "B3LYP", "BLYP", "SCAN", "HSE06"];
const BASIS_SETS = [
  "DZVP-MOLOPT-GTH",
  "DZVP-MOLOPT-SR-GTH",
  "TZVP-MOLOPT-GTH",
  "TZV2P-MOLOPT-GTH",
  "SZV-MOLOPT-GTH",
];
const POTENTIALS = ["GTH-PBE", "GTH-PBE0", "GTH-BLYP", "ALL"];

export function ElectronicStructureCard() {
  const { t } = useT();
  const { opts, patch } = useInpOptions();

  const numOr = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <Card>
      <CardHead icon={<Atom />} title={t("f2.elec.title")} />

      <FormField label={t("f2.elec.functional")} htmlFor="f2-functional">
        <SelectInput
          id="f2-functional"
          value={opts.functional}
          onChange={(e) => patch({ functional: e.target.value })}
        >
          {FUNCTIONALS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label={t("f2.elec.basis")} htmlFor="f2-basis">
        <SelectInput
          id="f2-basis"
          mono
          value={opts.basis_set}
          onChange={(e) => patch({ basis_set: e.target.value })}
        >
          {BASIS_SETS.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label={t("f2.elec.pot")} htmlFor="f2-pot">
        <SelectInput
          id="f2-pot"
          mono
          value={(opts.custom_options?.potential as string) ?? "GTH-PBE"}
          onChange={(e) =>
            patch({
              custom_options: {
                ...(opts.custom_options ?? {}),
                potential: e.target.value,
              },
            })
          }
        >
          {POTENTIALS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <Grid2>
        <FormField label={t("f2.elec.cutoff")} htmlFor="f2-cutoff">
          <TextInput
            id="f2-cutoff"
            type="number"
            mono
            value={opts.cutoff}
            onChange={(e) => patch({ cutoff: numOr(e.target.value, 400) })}
          />
        </FormField>
        <FormField label={t("f2.elec.relcutoff")} htmlFor="f2-relcutoff">
          <TextInput
            id="f2-relcutoff"
            type="number"
            mono
            value={opts.rel_cutoff}
            onChange={(e) => patch({ rel_cutoff: numOr(e.target.value, 50) })}
          />
        </FormField>
      </Grid2>

      <FormField label={t("f2.elec.spin")} htmlFor="f2-spin">
        <Segmented
          aria-label={t("f2.elec.spin")}
          value={opts.lsd ? "uks" : "rks"}
          onValueChange={(v) => patch({ lsd: v === "uks" })}
          items={[
            { value: "rks", label: t("f2.elec.spin.rks") },
            { value: "uks", label: t("f2.elec.spin.uks") },
          ]}
        />
      </FormField>
    </Card>
  );
}
