/**
 * Client-side report generation (Markdown and standalone HTML) from a scenario and its results.
 * The text is built from computed numbers; it never presents results as forecasts.
 */
import type { Scenario } from '../economics/simulation/scenario';
import type { AutomationResult, ComparisonResult } from '../workers/workerProtocol';
import { POLICY_INFO } from '../economics/policies/registry';

const p = (x: number | null | undefined, d = 2) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(d)}%`;
const n = (x: number | null | undefined, d = 3) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : x.toFixed(d);

export function buildReportMarkdown(
  s: Scenario,
  auto: AutomationResult,
  cmp: ComparisonResult,
  generatedAt: string,
): string {
  const solved = cmp.rows
    .filter((r) => r.status === 'solved' && r.costPerRevenue !== null)
    .sort((a, b) => (a.costPerRevenue ?? 0) - (b.costPerRevenue ?? 0));
  const failed = cmp.rows.filter((r) => r.status === 'unattainable' || r.status === 'no-steady-state');
  const L: string[] = [];
  L.push(`# Policy report: ${s.name}`, '');
  L.push(
    `*Generated in the browser on ${generatedAt}. Model results under stated assumptions; not an official forecast.*`,
    '',
  );
  L.push('## Scenario', '');
  L.push(
    `- Preset: ${s.preset === 'cyprus' ? 'Cyprus 2026 (Level 2 calibration)' : 'Casas & Torres (2026) Table 1 (Level 1)'}`,
  );
  L.push(
    `- Technology ${s.technology}; adoption parameter ${s.adoption.toFixed(2)} (a CES weight, not the share of firms using AI)`,
  );
  if (s.preset === 'cyprus')
    L.push(
      `- β: ${s.betaMode === 'primary' ? '0.975 (primary assumption)' : '0.922 (K/Y-matching alternative)'}; SI ceiling ${s.policy.ceiling}`,
    );
  else L.push(`- Equation variants: Tech A weight ${s.techAWeight}; labour supply ${s.labourSupply}`);
  L.push(
    `- Objective: ${s.policy.objective.kind === 'restoreTarget' ? 'restore the SS financing target (additional revenue)' : `revenue-neutral swap of ${p(s.policy.objective.replacement, 0)} of employer SS`}`,
  );
  L.push(
    `- Overrides: ${
      Object.entries(s.overrides)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ') || 'none'
    }`,
    '',
  );
  L.push('## What the simulations indicate', '');
  L.push(
    `- Without new instruments, SS contributions fall from ${p(auto.target)} of output at zero adoption to ${p(auto.current.ssToY)} at adoption ${s.adoption.toFixed(2)}.${auto.boundary ? ` No finite steady state exists beyond adoption ${n(auto.boundary)}.` : ''}`,
  );
  L.push(
    `- Lowest steady-state welfare cost per € raised: ${
      solved
        .slice(0, 3)
        .map((r) => `${r.code} (${n(r.costPerRevenue)})`)
        .join(', ') || 'none solvable'
    }. This ranking is conditional on the model's long-run, representative-firm assumptions.`,
  );
  if (failed.length)
    L.push(
      `- Instruments that cannot reach the objective here: ${failed.map((r) => `${r.code} (${r.status})`).join(', ')}.`,
    );
  L.push('', '## Results by instrument', '');
  L.push(
    '| Code | Instrument | Status | Rate | SS/Y | ΔGDP | ΔInvestment | ΔWorking time | Gross labour share | Welfare cost per € |',
  );
  L.push('|---|---|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const r of cmp.rows) {
    L.push(
      `| ${r.code} | ${r.scheme === 'none' ? 'none' : POLICY_INFO[r.scheme].label} | ${r.status} | ${n(r.rate, 4)} | ${p(r.ssToY)} | ${n(r.dY, 2)}% | ${n(r.dI, 2)}% | ${n(r.dL, 2)}% | ${p(r.grossLabourShare, 1)} | ${n(r.costPerRevenue)} |`,
    );
  }
  L.push('', '## Assumptions that drive the results', '');
  L.push(
    '- **Capital mobility:** in the long run capital is supplied elastically, so taxes on capital distort accumulation. With capital fixed (short run), capital taxes barely distort and the ranking changes.',
  );
  L.push(
    '- **Elasticities** of substitution (no Cyprus estimates), the discount factor β, and the technology (A or B).',
  );
  L.push(
    '- **Effective SI rate:** a calibrated coefficient reproducing the 2023 Fund accounts, with statutory rates unchanged.',
  );
  L.push('', '## Trade-offs and distribution', '');
  L.push(
    '- Instruments differ in who bears the burden: employer burden versus capital owners, labour share, and working time. No single efficiency indicator settles social desirability.',
  );
  L.push('', '## Major uncertainties and data needs', '');
  L.push(
    '- No Cyprus estimate of the automation adoption parameter, AI-generated profits or rents, or firm-level distributions of value added, labour shares and profits.',
  );
  L.push(
    "- The state's accumulated obligation to the Fund is reported inconsistently. Prorated 13th-salary and post-termination payment rules are provisional.",
  );
  L.push(
    '- A more reliable estimate would need: firm-level micro-data (VA, compensation, profits, capital); estimated elasticities of substitution for Cyprus; Fund projections by benefit type.',
  );
  L.push('', '## Limitations', '');
  L.push(
    '- Long-run steady states of a closed, representative-agent model with no growth or unemployment. E, F, G and G′ are exploratory hypotheses. Company-level results are not aggregated to national revenue.',
  );
  return L.join('\n') + '\n';
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Minimal Markdown → HTML for the report subset (headings, lists, tables, emphasis). */
export function markdownToHtml(md: string, title: string): string {
  const out: string[] = [];
  const lines = md.split('\n');
  let i = 0;
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  const at = (k: number) => lines[k] ?? '';
  while (i < lines.length) {
    const l = at(i);
    if (l.startsWith('# ')) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (l.startsWith('## ')) out.push(`<h2>${inline(l.slice(3))}</h2>`);
    else if (l.startsWith('- ')) {
      out.push('<ul>');
      while (i < lines.length && at(i).startsWith('- ')) out.push(`<li>${inline(at(i++).slice(2))}</li>`);
      out.push('</ul>');
      continue;
    } else if (l.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && at(i).startsWith('|'))
        rows.push(
          at(i++)
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim()),
        );
      const [head, , ...body] = rows;
      out.push(
        '<table><thead><tr>' +
          (head ?? []).map((c) => `<th>${inline(c)}</th>`).join('') +
          '</tr></thead><tbody>',
      );
      for (const r of body) out.push('<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
      out.push('</tbody></table>');
      continue;
    } else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    i++;
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>body{font-family:system-ui,sans-serif;max-width:60rem;margin:2rem auto;padding:0 1rem;line-height:1.5;color:#0f172a}table{border-collapse:collapse;width:100%;font-size:.85rem}th,td{border:1px solid #cbd5e1;padding:.3rem .5rem;text-align:left}h1,h2{line-height:1.2}</style></head><body>${out.join('\n')}</body></html>`;
}
