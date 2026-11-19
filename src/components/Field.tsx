/**
 * Parameter control showing name, value, units, description, default, range and provenance
 * (design change §5).
 */
import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Slider } from './ui/core';
import { ProvenanceBadge, type Provenance } from './provenance/ProvenanceBadge';

export function SliderField(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  units: string;
  description: ReactNode;
  kind: Provenance;
  source?: string;
  defaultValue?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const show = props.format ?? ((v: number) => v.toFixed(3));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={props.id} className="text-sm font-medium">
          {props.label}
        </label>
        <div className="flex items-center gap-2">
          <output
            htmlFor={props.id}
            className="tabular text-sm font-semibold"
            data-testid={`${props.id}-value`}
          >
            {show(props.value)}
          </output>
          <ProvenanceBadge kind={props.kind} />
        </div>
      </div>
      <Slider
        id={props.id}
        label={props.label}
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={props.onChange}
      />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {props.description} <span className="whitespace-nowrap">Units: {props.units}.</span> Range{' '}
        {show(props.min)}–{show(props.max)}.
        {props.defaultValue !== undefined && (
          <>
            {' '}
            Default {show(props.defaultValue)}{' '}
            {props.value !== props.defaultValue && (
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-brand-700 underline dark:text-brand-500"
                onClick={() => props.defaultValue !== undefined && props.onChange(props.defaultValue)}
              >
                <RotateCcw className="h-3 w-3" aria-hidden /> reset
              </button>
            )}
          </>
        )}
        {props.source && <> Source: {props.source}.</>}
      </p>
    </div>
  );
}
