import { useScenario } from '../state/scenarioStore';
import { SliderField } from './Field';
import { Select } from './ui/core';
import { ProvenanceBadge } from './provenance/ProvenanceBadge';

/** Model controls shared by the simulator, policy and sensitivity pages. */
export function ScenarioControls({ showAdoption = true }: { showAdoption?: boolean }) {
  const { current: s, update, setOverride } = useScenario();
  const cy = s.preset === 'cyprus';
  const defaults = cy
    ? { eKL: 0.9, eA: 2, dD: 0.2, beta: s.betaMode === 'primary' ? 0.975 : 0.9223 }
    : { eKL: 0.9, eA: 2, dD: 0.2, beta: 0.975 };
  return (
    <div className="@container space-y-5">
      <div className="grid gap-3 @lg:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="preset" className="text-sm font-medium">
            Calibration preset
          </label>
          <Select
            id="preset"
            label="Calibration preset"
            value={s.preset}
            onChange={(v) =>
              update({
                preset: v,
                name: v === 'cyprus' ? 'Cyprus 2026 scenario' : 'Casas–Torres (2026) scenario',
              })
            }
            options={[
              { value: 'cyprus', label: 'Cyprus 2026 (Level 2)' },
              { value: 'paper', label: 'Original paper (Level 1)' },
            ]}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="tech" className="text-sm font-medium">
            Technology
          </label>
          <Select
            id="tech"
            label="Technology"
            value={s.technology}
            onChange={(v) => update({ technology: v })}
            options={[
              { value: 'B', label: 'B: robots substitute capital and labour' },
              { value: 'A', label: 'A: robots substitute labour only' },
            ]}
          />
        </div>
        {cy ? (
          <div className="space-y-1 @lg:col-span-2">
            <label htmlFor="beta-mode" className="text-sm font-medium">
              Discount factor β <ProvenanceBadge kind="assumed" />
            </label>
            <Select
              id="beta-mode"
              label="Discount factor"
              value={s.betaMode}
              onChange={(v) => update({ betaMode: v })}
              options={[
                { value: 'primary', label: 'β = 0.975 (primary assumption; does not match K/Y)' },
                { value: 'capitalOutput', label: 'β = 0.922 (alternative; matches 2023 K/Y)' },
              ]}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label htmlFor="d1" className="text-sm font-medium">
                Tech A weight (D1)
              </label>
              <Select
                id="d1"
                label="Technology A weight variant"
                value={s.techAWeight}
                onChange={(v) => update({ techAWeight: v })}
                options={[
                  { value: 'capitalWeight', label: '0.35 on capital (matches figures)' },
                  { value: 'asPrinted', label: 'As printed in eq. (1)' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="d2" className="text-sm font-medium">
                Labour supply eq. (24) (D2)
              </label>
              <Select
                id="d2"
                label="Labour-supply variant"
                value={s.labourSupply}
                onChange={(v) => update({ labourSupply: v })}
                options={[
                  { value: 'asPrinted', label: 'As printed (tax wedges)' },
                  { value: 'figureReplication', label: 'Figure replication (no wedges)' },
                ]}
              />
            </div>
          </>
        )}
      </div>
      {showAdoption && (
        <SliderField
          id="adoption"
          label="Autonomous-capital adoption parameter"
          value={s.adoption}
          min={0}
          max={0.49}
          step={0.01}
          units="CES weight (0–1)"
          kind="assumed"
          format={(v) => v.toFixed(2)}
          description="A model weight on autonomous capital, NOT the share of firms using AI. No Cyprus estimate exists."
          onChange={(v) => update({ adoption: v })}
        />
      )}
      <SliderField
        id="eKL"
        label="Capital–labour elasticity (ρ / ε)"
        value={s.overrides.elasticityKL ?? defaults.eKL}
        min={0.5}
        max={1.2}
        step={0.05}
        units="dimensionless"
        kind="assumed"
        defaultValue={defaults.eKL}
        format={(v) => v.toFixed(2)}
        description="Below 1: capital and labour are complements."
        onChange={(v) => setOverride('elasticityKL', v)}
      />
      <SliderField
        id="eA"
        label="Autonomous-capital elasticity (υ / σ)"
        value={s.overrides.elasticityAuto ?? defaults.eA}
        min={1}
        max={3}
        step={0.1}
        units="dimensionless"
        kind="assumed"
        defaultValue={defaults.eA}
        format={(v) => v.toFixed(1)}
        description="How easily robots and AI substitute for other inputs."
        onChange={(v) => setOverride('elasticityAuto', v)}
      />
      <SliderField
        id="dD"
        label="Autonomous-capital depreciation δ_d"
        value={s.overrides.deltaD ?? defaults.dD}
        min={0.1}
        max={0.33}
        step={0.01}
        units="per year"
        kind="assumed"
        defaultValue={defaults.dD}
        format={(v) => v.toFixed(2)}
        description="Paper value (R&D depreciation)."
        onChange={(v) => setOverride('deltaD', v)}
      />
    </div>
  );
}
