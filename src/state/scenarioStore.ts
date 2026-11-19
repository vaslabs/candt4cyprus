/**
 * Scenario state (zustand). Saved scenarios persist in localStorage only (no telemetry, no server).
 * The paper and Cyprus presets are immutable factories: editing the working scenario never changes them.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { defaultScenario, parseScenario, type Scenario } from '../economics/simulation/scenario';
import { safeStorage } from '../lib/storage';

export interface ScenarioState {
  readonly current: Scenario;
  readonly saved: readonly Scenario[];
  update: (patch: Partial<Scenario>) => void;
  updatePolicy: (patch: Partial<Scenario['policy']>) => void;
  updateConfig: (patch: Partial<Scenario['policy']['config']>) => void;
  setOverride: (key: keyof Scenario['overrides'], value: number | undefined) => void;
  resetTo: (preset: 'paper' | 'cyprus') => void;
  save: () => void;
  duplicate: () => void;
  load: (id: string) => void;
  remove: (id: string) => void;
  importJson: (text: string) => { ok: true } | { ok: false; error: string };
  exportJson: () => string;
}

const newId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const useScenario = create<ScenarioState>()(
  persist(
    (set, get) => ({
      current: defaultScenario('cyprus'),
      saved: [],
      update: (patch) => set((s) => ({ current: { ...s.current, ...patch } })),
      updatePolicy: (patch) =>
        set((s) => ({ current: { ...s.current, policy: { ...s.current.policy, ...patch } } })),
      updateConfig: (patch) =>
        set((s) => ({
          current: {
            ...s.current,
            policy: { ...s.current.policy, config: { ...s.current.policy.config, ...patch } },
          },
        })),
      setOverride: (key, value) =>
        set((s) => {
          // Rebuild without the key instead of deleting a dynamic property.
          const o = Object.fromEntries(
            Object.entries(s.current.overrides).filter(([k]) => k !== key),
          ) as Scenario['overrides'];
          return { current: { ...s.current, overrides: value === undefined ? o : { ...o, [key]: value } } };
        }),
      resetTo: (preset) => set(() => ({ current: { ...defaultScenario(preset), id: newId() } })),
      save: () =>
        set((s) => {
          const others = s.saved.filter((x) => x.id !== s.current.id);
          return { saved: [...others, s.current] };
        }),
      duplicate: () =>
        set((s) => ({ current: { ...s.current, id: newId(), name: `${s.current.name} (copy)` } })),
      load: (id) => {
        const sc = get().saved.find((x) => x.id === id);
        if (sc) set({ current: sc });
      },
      remove: (id) => set((s) => ({ saved: s.saved.filter((x) => x.id !== id) })),
      importJson: (text) => {
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return { ok: false, error: 'File is not valid JSON.' };
        }
        const r = parseScenario(json);
        if (!r.ok) return r;
        const sc = { ...r.scenario, id: newId() };
        set((s) => ({ current: sc, saved: [...s.saved, sc] }));
        return { ok: true };
      },
      exportJson: () => JSON.stringify(get().current, null, 2),
    }),
    {
      name: 'cy-ai-si-scenarios',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ current: s.current, saved: s.saved }),
      // Drop anything persisted that no longer validates instead of crashing on load.
      merge: (persisted, current) => {
        const p = persisted as { current?: unknown; saved?: unknown[] } | undefined;
        const cur = p?.current ? parseScenario(p.current) : null;
        const saved = (p?.saved ?? [])
          .map((x) => parseScenario(x))
          .flatMap((r) => (r.ok ? [r.scenario] : []));
        return { ...current, ...(cur?.ok ? { current: cur.scenario } : {}), saved };
      },
    },
  ),
);
