/**
 * Every number in the interface is labelled by its epistemic status (design change §14).
 */
import {
  Activity,
  BadgeCheck,
  Calculator,
  FlaskConical,
  Lightbulb,
  Sigma,
  SlidersHorizontal,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type Provenance =
  'observed' | 'derived' | 'calibrated' | 'assumed' | 'behavioural' | 'simulated' | 'hypothetical';

const META: Record<Provenance, { label: string; title: string; cls: string; Icon: typeof BadgeCheck }> = {
  observed: {
    label: 'Observed',
    title: 'Official statistic or statutory rule, with source and reference date.',
    cls: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100',
    Icon: BadgeCheck,
  },
  derived: {
    label: 'Derived',
    title:
      'Computed arithmetically from observed statistics (e.g. a ratio of two published totals); the method is stated.',
    cls: 'bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100',
    Icon: Sigma,
  },
  calibrated: {
    label: 'Calibrated',
    title:
      'Model coefficient chosen to reproduce observed Cyprus data. It is not itself an observed statistic.',
    cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
    Icon: SlidersHorizontal,
  },
  assumed: {
    label: 'Assumed',
    title: 'Value chosen because no reliable estimate exists; see its sensitivity range.',
    cls: 'bg-amber-100 text-amber-950 dark:bg-amber-900/50 dark:text-amber-100',
    Icon: Lightbulb,
  },
  behavioural: {
    label: 'Behavioural',
    title:
      'Assumed behavioural response (elasticity, avoidance, profit shifting) with no Cyprus estimate; vary it in sensitivity analysis.',
    cls: 'bg-orange-100 text-orange-950 dark:bg-orange-900/50 dark:text-orange-100',
    Icon: Activity,
  },
  simulated: {
    label: 'Simulated',
    title: 'Output of the economic model under the stated assumptions. Not a forecast.',
    cls: 'bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100',
    Icon: Calculator,
  },
  hypothetical: {
    label: 'Hypothetical policy',
    title: 'A policy instrument not implemented in Cyprus (exploratory research hypothesis).',
    cls: 'bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100',
    Icon: FlaskConical,
  },
};

export function ProvenanceBadge({ kind, className }: { kind: Provenance; className?: string }) {
  const m = META[kind];
  return (
    <span
      title={m.title}
      data-provenance={kind}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        m.cls,
        className,
      )}
    >
      <m.Icon className="h-3 w-3" aria-hidden />
      {m.label}
      <span className="sr-only">: {m.title}</span>
    </span>
  );
}

export function ProvenanceLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Legend of data provenance labels">
      {(Object.keys(META) as Provenance[]).map((k) => (
        <li key={k} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ProvenanceBadge kind={k} />
          <span className="hidden sm:inline">{META[k].title}</span>
        </li>
      ))}
    </ul>
  );
}
