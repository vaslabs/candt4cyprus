/** Number formatting (en-GB conventions, explicit units at call sites). */
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export const fmt = (x: number | null | undefined, digits = 3): string => (isNum(x) ? x.toFixed(digits) : '—');
export const pct = (x: number | null | undefined, digits = 1): string =>
  isNum(x) ? `${(x * 100).toFixed(digits)}%` : '—';
export const signedPct = (x: number | null | undefined, digits = 2): string =>
  isNum(x) ? `${x > 0 ? '+' : ''}${x.toFixed(digits)}%` : '—';
export const eur = (x: number | null | undefined, digits = 0): string =>
  isNum(x)
    ? `€${x.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`
    : '—';
export const eurM = (x: number | null | undefined, digits = 1): string =>
  isNum(x)
    ? `€${x.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })}m`
    : '—';
