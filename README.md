# Cyprus AI, Automation and Social Insurance simulator

A static, browser-only research simulator. It asks how Cyprus could finance its Social Insurance Fund if AI and automation reduce labour's share of income.

It replicates Casas & Torres (2026), *Automation, Taxation, and Social Security Sustainability*, Hacienda Pública Española 256(1):69–104 ([DOI 10.7866/HPE-RPE.26.1.3](https://doi.org/10.7866/HPE-RPE.26.1.3)). It then applies the model to a documented Cyprus calibration and compares the paper's robot taxes (B–D) with exploratory instruments E, F, G and G′.

Results are long-run model simulations under stated assumptions. They are not forecasts or official estimates. Every number in the interface is labelled observed, derived, calibrated, assumed, behavioural, simulated, or hypothetical policy.

## Privacy

All computation runs in your browser, in a Web Worker. There is no backend, analytics, telemetry or cookies. Saved scenarios are kept only in your browser's `localStorage`.

## Development

Requires Node 24 (see `.nvmrc`).

```sh
npm ci
npm run dev          # local development server
npm test             # unit, property, differential and regression tests (Vitest + fast-check)
npm run test:e2e     # Playwright against the production build under /candt4cyprus/
npm run build        # static build in dist/
```

Correctness checks:

- `npm run oracle`: an independent Python/SciPy implementation, used only in development and CI.
- `npm run test:mutation`: Stryker mutation testing.
- `npm run data:validate`: checks provenance and schemas for every Cyprus parameter.

## Documentation

- `docs/MODEL_SPEC.md`: the model equations and Propositions 1–3.
- `docs/MODEL_DEVIATIONS.md`: every deviation from the printed paper and every documented discrepancy.
- `docs/replication/REPLICATION_REPORT.md`: replication benchmarks.
- `docs/cyprus/CALIBRATION_REPORT.md` and `docs/cyprus/DATA_GAPS.md`: Cyprus data, sources and gaps.
- `docs/policies/POLICIES.md` and `docs/policies/POLICY_COMPARISON.md`: instruments E, F, G and G′ and their comparison.

## Data and licensing notes

- Cyprus data come from official public sources: CYSTAT, Social Insurance Services, Eurostat, and Cyprus legislation. Full provenance and hashes are in `src/data/sources.json`.
- The original SIS Word bulletins are not redistributed. Only the extracted figures, the extraction script and file hashes are committed.
- The paper's PDF (CC BY-NC) is not part of this repository.
