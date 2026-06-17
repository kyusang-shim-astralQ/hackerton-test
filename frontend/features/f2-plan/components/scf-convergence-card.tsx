// features/f2-plan/components/scf-convergence-card.tsx — 3단계 SCF 수렴 설정 카드.
"use client";

import { Waypoints } from "lucide-react";
import { Card, CardHead } from "@/components/ui/card";
import {
  FormField,
  TextInput,
  SelectInput,
  Grid2,
} from "@/components/ui/form-field";
import { Segmented } from "@/components/ui/segmented";
import { useT } from "@/lib/i18n/use-t";
import { useWizardStore } from "@/stores/wizard-store";
import { useInpOptions } from "../hooks/use-inp-options";

const EPS_OPTIONS = ["1.0E-5", "1.0E-6", "1.0E-7", "1.0E-8"];
const MIXING = ["DIRECT_P_MIXING", "BROYDEN_MIXING", "PULAY_MIXING"];
const OPTIMIZERS = [
  { value: "BFGS", label: "BFGS" },
  { value: "CG", label: "CG" },
  { value: "LBFGS", label: "L-BFGS" },
];

export function ScfConvergenceCard() {
  const { t } = useT();
  const { opts, patch } = useInpOptions();
  const structureInfo = useWizardStore((s) => s.structureInfo);

  const numOr = (v: string, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  return (
    <Card>
      <CardHead icon={<Waypoints />} title={t("f2.scf.title")} />

      <Grid2>
        <FormField label={t("f2.scf.epsscf")} htmlFor="f2-epsscf">
          <SelectInput
            id="f2-epsscf"
            mono
            value={opts.eps_scf ?? "1.0E-6"}
            onChange={(e) => patch({ eps_scf: e.target.value })}
          >
            {EPS_OPTIONS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </SelectInput>
        </FormField>
        <FormField label={t("f2.scf.maxscf")} htmlFor="f2-maxscf">
          <TextInput
            id="f2-maxscf"
            type="number"
            mono
            value={opts.max_scf ?? 50}
            onChange={(e) => patch({ max_scf: numOr(e.target.value, 50) })}
          />
        </FormField>
      </Grid2>

      <FormField label={t("f2.scf.mixing")} htmlFor="f2-mixing">
        <SelectInput
          id="f2-mixing"
          mono
          value={(opts.custom_options?.mixing as string) ?? "BROYDEN_MIXING"}
          onChange={(e) =>
            patch({
              custom_options: {
                ...(opts.custom_options ?? {}),
                mixing: e.target.value,
              },
            })
          }
        >
          {MIXING.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </SelectInput>
      </FormField>

      <FormField label={t("f2.scf.smear")} htmlFor="f2-smear">
        <Segmented
          aria-label={t("f2.scf.smear")}
          value={opts.use_smear ? "on" : "off"}
          onValueChange={(v) => patch({ use_smear: v === "on" })}
          items={[
            { value: "off", label: t("f2.scf.smear.off") },
            { value: "on", label: t("f2.scf.smear.on") },
          ]}
        />
        {structureInfo?.smear_recommended && (
          <p className="mt-s1 text-sm text-accent-ink">{t("f2.scf.smear.rec")}</p>
        )}
      </FormField>

      {opts.use_smear && (
        <FormField label={t("f2.scf.smeartemp")} htmlFor="f2-smeartemp">
          <TextInput
            id="f2-smeartemp"
            type="number"
            mono
            value={opts.smear_temp ?? 300}
            onChange={(e) => patch({ smear_temp: numOr(e.target.value, 300) })}
          />
        </FormField>
      )}

      <FormField label={t("f2.scf.optimizer")} htmlFor="f2-optimizer">
        <Segmented
          aria-label={t("f2.scf.optimizer")}
          value={opts.optimizer ?? "BFGS"}
          onValueChange={(v) => patch({ optimizer: v })}
          items={OPTIMIZERS}
        />
      </FormField>
    </Card>
  );
}
