# Cyprus AI, Automation & Social Insurance Simulator — Open-Source Web Application

## Updated technical requirements

We are changing the implementation architecture of the previously specified project.

**Do not build a Python application.**

Build a modern, fully static, open-source Single Page Application (SPA) using Node.js, TypeScript, React, Tailwind CSS, and browser-native numerical computation.

The application must be deployable directly to **GitHub Pages** and function without any backend.

Preserve all previously specified economic, statistical, academic, and policy requirements, including:

- Replicating the Casas and Torres (2026) paper.
- Implementing both production technologies.
- Comparing the three original automation tax models.
- Calibrating the model to Cyprus statistics and tax rules.
- Supporting the additional value-added, labour-share and excess-profit contribution models.
- Providing adjustable assumptions, sensitivity analysis, interactive visualisations, and downloadable reports.
- Distinguishing verified statistics from assumptions.
- Validating the economic equations and published results.

The scientific integrity requirements are unchanged. Only the software architecture and delivery mechanism have changed.

---

# 1. Technology stack

Use:

- **Node.js 24 LTS** for development, builds, scripts and tooling.
- **TypeScript** with strict type checking.
- **React** with functional components and hooks.
- **Vite** for development and static production builds.
- **Tailwind CSS v4** for styling.
- **shadcn/ui** for accessible interface components.
- **Lucide React** for icons.
- **Plotly.js** for interactive scientific and economic charts.
- **Zustand** for shared scenario and parameter state.
- **Zod** for configuration and runtime input validation.
- **Vitest** for unit, numerical and regression testing.
- **Playwright** for end-to-end browser tests.
- **GitHub Actions** for automated testing, building and deployment.

Use current stable compatible releases and commit a lockfile.

Prefer lightweight dependencies where practical.

Do not introduce a framework requiring server-side rendering or a Node.js runtime in production.

## Non-negotiable runtime requirements

The published application must:

1. Run entirely in the browser.
2. Require no server-side rendering.
3. Require no backend API.
4. Require no database.
5. Require no authentication.
6. Require no paid infrastructure.
7. Require no API keys.
8. Perform all numerical calculations locally.
9. Work when served from a GitHub Pages project subpath.
10. Support a configurable GitHub Pages base URL.
11. Store user-created scenarios locally in the browser.
12. Allow export and import of scenario configurations.
13. Function without an external network connection after its static assets have loaded, except for explicitly identified optional external resources.

External fonts, remote chart APIs and runtime CDN dependencies should not be required.

Node.js must only be used for development, testing, data preparation and static build generation.

---

# 2. Scientific computation in TypeScript

Implement the Casas–Torres economic model using TypeScript.

Do not simplify the research equations merely to make the application easier to build.

The model must support:

- CES production functions.
- Both technological specifications.
- Household utility maximisation.
- Capital accumulation and depreciation.
- Firm equilibrium conditions.
- Wage and capital-return determination.
- Government budget accounting.
- Labour and capital income shares.
- Equilibrium calculations.
- Endogenous tax-rate calculations.
- Policy comparisons.
- Sensitivity analysis.

## Numerical methods

Use a well-tested numerical library compatible with browser execution, or implement and thoroughly test suitable numerical routines.

Possible techniques include:

- Newton–Raphson methods.
- Damped Newton methods.
- Broyden methods.
- Numerical Jacobians.
- Bracketed root finding.
- Constrained optimisation.
- Continuation methods for tracing equilibrium paths.

Choose methods appropriate to the economic system.

Use convergence tolerance controls, iteration limits and explicit error diagnostics.

Do not silently clamp invalid economic values or manufacture convergence.

Maintain dimensional consistency.

Where numerical stability permits, use transformed variables for economically positive quantities.

Implement automated tests for known analytical results and the paper's published simulation benchmarks.

## Web Workers

Run computationally expensive tasks using Web Workers.

The interface must remain responsive during:

- Equilibrium solving.
- Automation-adoption sweeps.
- Sensitivity analysis.
- Multi-policy comparisons.
- Monte Carlo experiments.

Implement a typed message protocol between the main application and workers.

Support:

- Progress reporting.
- Cancellation.
- Error handling.
- Parameter validation.
- Reproducible random seeds.
- Solver diagnostics.

Use debouncing or explicit Run Simulation controls to avoid recomputing expensive results on every slider movement.

Never block the UI thread with large equilibrium calculations.

## Optional WebAssembly

If a reliable JavaScript numerical solver is insufficient, WebAssembly may be used for performance or numerical stability.

Any WebAssembly implementation must:

- Be included in the static build.
- Run locally in the browser.
- Require no remote service.
- Include reproducible build instructions.
- Be compatible with GitHub Pages.
- Be covered by numerical tests.

Do not use WebAssembly unnecessarily if TypeScript is sufficient.

---

# 3. Scientific model architecture

Separate the economic model completely from React UI components.

Use a structure similar to:

```text
src/
  app/
    App.tsx
    routes.tsx

  components/
    layout/
    controls/
    charts/
    tables/
    explanations/

  pages/
    Overview.tsx
    Automation.tsx
    ResearchReplication.tsx
    PolicyComparison.tsx
    BusinessComparison.tsx
    SensitivityAnalysis.tsx
    PolicyReport.tsx

  economics/
    core/
      ces.ts
      equilibrium.ts
      numericalSolver.ts
      types.ts

    paper/
      technologyA.ts
      technologyB.ts
      households.ts
      firms.ts
      government.ts
      calibration.ts
      replication.ts

    cyprus/
      contributionRules.ts
      incomeTax.ts
      employerCosts.ts
      calibration.ts
      nationalAccounts.ts

    policies/
      robotIncomeTax.ts
      robotInvestmentTax.ts
      robotSocialInsurance.ts
      valueAddedContribution.ts
      labourShareContribution.ts
      excessProfitContribution.ts

    simulation/
      scenarioRunner.ts
      sensitivity.ts
      monteCarlo.ts
      comparisons.ts

  workers/
    simulation.worker.ts
    workerProtocol.ts

  state/
    scenarioStore.ts
    settingsStore.ts

  data/
    paperDefaults.json
    cyprus2026.json
    sources.json
    sectorData.json

  lib/
    validation.ts
    formatting.ts
    export.ts
    persistence.ts

  styles/
    globals.css

tests/
  unit/
  economics/
  regression/
  e2e/

public/
  favicon.svg
  robots.txt

.github/
  workflows/
    deploy.yml

vite.config.ts
package.json
tsconfig.json
README.md
LICENSE
```

You may improve the architecture while preserving separation of responsibilities.

The economic computation layer must not import React, Plotly, Tailwind, or browser DOM APIs.

It should be possible to run the numerical model independently using Node.js in automated tests.

---

# 4. Interface and visual design

Create a polished, modern research dashboard.

The application should feel like a contemporary economic-policy research tool, not a generic administrative dashboard.

Use:

- Clean typography.
- Restrained colours.
- Generous spacing.
- Responsive layouts.
- Excellent chart readability.
- Accessible controls.
- Light and dark themes.
- Clear numerical formatting.
- Compact parameter panels.
- Contextual methodological explanations.

## Suggested layout

Desktop:

- Persistent sidebar navigation.
- Main research workspace.
- Collapsible parameter panel.
- Large interactive charts.
- Clearly labelled summary indicators.

Mobile:

- Responsive navigation.
- Stacked charts.
- Accessible parameter controls.
- No horizontal overflow.
- Tables that adapt to narrow displays.

## Main application sections

### Overview

Explain the Cyprus Social Insurance system and the economic challenge of automation.

Show the latest verified statistical indicators and their reference dates.

### Original Research

Allow users to reproduce the Casas–Torres model.

Display the paper's original assumptions and replication diagnostics.

### Automation Simulator

Let users change adoption, substitution elasticities, depreciation and economic assumptions.

Calculate the resulting equilibrium.

### Policy Comparison

Compare the three paper policies and the three new exploratory policies against the no-tax baseline.

### Business Simulator

Allow users to enter company financial data and salary distributions.

Calculate Cyprus payroll contributions and hypothetical alternative contributions.

### Sensitivity Analysis

Explore uncertain parameters through scenario sweeps, heatmaps and Monte Carlo methods.

### Policy Report

Generate a transparent, readable report explaining results, limitations and assumptions.

---

# 5. Interaction and adjustable parameters

Every important model parameter must be editable through the interface.

Use appropriate controls:

- Sliders for bounded parameters.
- Numeric inputs for exact values.
- Select menus for scenarios.
- Toggle switches for optional taxes.
- Tables for company financial information.
- Presets for different automation environments.

Each parameter should provide:

- Name.
- Current value.
- Units.
- Description.
- Source.
- Reference year.
- Default value.
- Allowed range.
- Whether it is observed, calibrated or assumed.

Provide:

- Reset to original paper values.
- Reset to Cyprus defaults.
- Duplicate scenario.
- Compare scenarios.
- Import scenario.
- Export scenario.

Never overwrite the research-paper preset when the user edits Cyprus values.

---

# 6. Browser persistence and privacy

Use localStorage for small settings and scenario configurations.

Use IndexedDB if larger scenario results require persistence.

Do not collect user data.

Do not add analytics or telemetry by default.

The application should operate without cookies or third-party tracking.

Offer scenario export as JSON.

Support importing previously exported scenarios with schema validation.

Include schema versioning for future migrations.

All calculations should be deterministic for identical parameters and random seeds.

---

# 7. Charts and reporting

Use Plotly.js for interactive visualisations.

Include:

1. Social insurance contributions/GDP versus automation.
2. Required robot tax rate versus adoption.
3. GDP under different taxation mechanisms.
4. Investment and consumption effects.
5. Labour and capital income shares.
6. Labour versus autonomous-capital contribution shares.
7. Cyprus Social Insurance financing waterfall.
8. Firm-level contribution comparison.
9. Sensitivity heatmaps.
10. Uncertainty interval visualisations.

Users should be able to:

- Hover to inspect values.
- Show and hide policies.
- Change chart ranges.
- Compare multiple scenarios.
- Download chart PNGs.
- Download underlying data as CSV.
- Export a policy report.

All charts must use proper economic units and state whether values are observed, simulated or hypothetical.

For PDF export, use browser-compatible client-side libraries or print-optimised HTML.

No server-generated reporting.

Keep report generation entirely client-side.

---

# 8. Cyprus statistical configuration

Preserve the Cyprus 2026 defaults and official source references from the previous project specification.

Implement accurate statutory contribution calculations, including:

- Employee Social Insurance: 8.8%.
- Employer Social Insurance: 8.8%.
- State Social Insurance contribution: 5.2%.
- Maximum insurable annual earnings: €68,904.
- Employee GHS: 2.65%.
- Employer GHS: 2.90%.
- GHS annual ceiling: €180,000.
- Social Cohesion Fund: 2.0%.
- Redundancy Fund: 1.2%.
- Human Resource Development Fund: 0.5%.
- Corporate tax: 15%.
- VAT: 19%.

Preserve the previously supplied 2026 income tax brackets, macroeconomic data, sector figures and citations.

Do not confuse statutory contribution rules with the effective tax rates in the paper.

Ensure that the Cyprus national-accounting calibration is compatible with the research equations.

If an official parameter is not available, represent it explicitly as an assumption.

Do not introduce fake precision.

## Offline data

Store the source data within the repository as JSON or CSV.

The application must not fetch economic statistics from external APIs at runtime.

Create a documented update process:

```bash
npm run data:validate
npm run data:check
npm run build
```

Data updates should be reviewed and committed through Git.

Each dataset should include source attribution and publication date.

Users should be able to inspect the provenance of every published number.

---

# 9. GitHub Pages deployment

This requirement is mandatory.

The application will be hosted at a URL similar to:

https://USERNAME.github.io/REPOSITORY/

Configure Vite's `base` path correctly.

Allow the repository name to be configured without manually editing multiple files.

Use HashRouter for SPA navigation, or another GitHub Pages-safe solution that does not depend on server-side route fallback.

Direct navigation and page refresh must work for all application sections.

Create a GitHub Actions workflow that:

1. Checks out the repository.
2. Sets up Node.js.
3. Runs npm ci.
4. Runs TypeScript type checking.
5. Runs linting.
6. Runs unit and economic regression tests.
7. Builds the static application.
8. Uploads the Vite dist directory.
9. Deploys to GitHub Pages.

Use official GitHub Actions.

Deployment should trigger on a push to the main branch, subject to successful tests.

Use the least necessary GitHub Actions permissions.

Do not store secrets or credentials in the frontend bundle.

Ensure all generated asset paths work from a repository subdirectory.

The final production output must consist only of static files.

---

# 10. Open-source requirements

Prepare the project for publication as a public GitHub repository.

Include:

- README.md
- LICENSE
- CONTRIBUTING.md
- CODE_OF_CONDUCT.md
- SECURITY.md
- CHANGELOG.md
- .gitignore
- GitHub issue templates
- Pull request template

Use MIT licensing for the application code unless there is a documented licensing conflict.

The original academic paper and third-party datasets retain their own licensing terms. Do not imply that MIT licensing transfers copyright ownership or redistribution rights over them.

Do not bundle copyrighted third-party research materials without checking their licences.

Provide citations and links to original research.

Document how external contributors can:

- Improve the economic model.
- Add datasets.
- Submit policy scenarios.
- Report numerical issues.
- Review scientific assumptions.
- Suggest additional tax mechanisms.

---

# 11. Testing and reproducibility

Implement rigorous automated testing.

### Mathematical tests

- CES function validation.
- Equilibrium residual tests.
- Capital accumulation consistency.
- Government budget identities.
- Non-negative economic quantities.
- Tax revenue consistency.
- Solver convergence diagnostics.

### Research replication tests

- Published tax-rate convergence results.
- Labour-share patterns.
- Contribution-share crossover.
- No-tax baseline.
- Technology A versus Technology B.
- Sensitivity to elasticities.

Use numerical tolerances rather than exact floating-point equality.

### Cyprus statutory tests

- Insurable earnings ceilings.
- Employer and employee contributions.
- Progressive income tax brackets.
- Zero-income cases.
- High-salary cases.
- Multiple employees with different salaries.
- Correct separation of Social Insurance and GHS contributions.

### Browser tests

- Navigation.
- Slider updates.
- Scenario comparisons.
- Import/export.
- Responsive layouts.
- Chart rendering.
- Worker cancellation.
- GitHub Pages base-path compatibility.

Do not claim the paper has been replicated until relevant tests pass.

---

# 12. Build and developer experience

Provide these commands:

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:e2e
npm run build
npm run preview
```

The project should work on Windows, Linux and macOS.

Use ESLint and Prettier.

Enable TypeScript strict mode.

Avoid `any` in the scientific computation layer.

Use typed domain models and documented units.

Include clear error states for numerical failures.

Do not display incorrect or stale simulation results after a failed computation.

---

# 13. Performance

The static application must remain responsive on ordinary laptops.

Implement:

- Lazy-loaded application sections.
- Code splitting for chart libraries.
- Web Worker-based calculations.
- Memoised derived state.
- Cached scenario results where appropriate.
- Cancellation of obsolete simulations.
- Reproducible parameter sweeps.
- Efficient chart updates.

Avoid loading the entire scientific computation and visualisation stack on the first page unnecessarily.

Ensure that parameter changes do not trigger uncontrolled worker computation.

Include benchmarks for representative numerical workloads.

If a calculation exceeds practical browser limits, warn the user and offer a smaller simulation configuration.

---

# 14. Transparency and economic interpretation

Every result should distinguish:

**Observed data**
Official Cyprus statistics and statutory contribution rates.

**Calibrated values**
Parameters estimated to match Cyprus economic characteristics.

**Assumptions**
Values selected because reliable estimates are unavailable.

**Simulated results**
Outputs produced by the economic model.

**Hypothetical policies**
New policy instruments not currently implemented in Cyprus.

Display methodological warnings where necessary.

Include an accessible methodology section explaining:

- The equations.
- The calibration process.
- The numerical solver.
- Tax bases.
- Economic assumptions.
- Model limitations.
- Uncertainty.
- Source references.

Never present simulated future outcomes as official government forecasts.

---

# 15. Final deliverables

Produce a fully working, open-source-ready GitHub repository containing:

1. The React and TypeScript application.
2. The complete economic model.
3. Cyprus datasets and metadata.
4. The interactive policy dashboard.
5. The scenario configuration system.
6. Automated numerical and browser tests.
7. GitHub Pages deployment workflow.
8. Documentation and contributor guidance.
9. Open-source licensing.
10. A reproducible research replication report.

## Implementation order

Work in the following sequence:

**Phase 1 — Scientific model**

Implement and validate the Casas–Torres equations in TypeScript.

**Phase 2 — Research replication**

Reproduce the published scenarios and test the numerical results.

**Phase 3 — Cyprus calibration**

Integrate Cyprus statutory rules and economic data.

**Phase 4 — Additional policy models**

Implement value-added, labour-share and excess-profit contribution scenarios.

**Phase 5 — Interface**

Develop the dashboard, charts and interactive controls.

**Phase 6 — Deployment**

Configure GitHub Pages and verify production routing, assets, performance and security.

**Phase 7 — Documentation**

Prepare the project for public release and independent scientific review.

Do not sacrifice numerical correctness for a visually impressive interface.

## Final objective

Create an openly accessible research tool allowing citizens, researchers and policymakers to explore:

**How should Cyprus finance social insurance in an increasingly automated economy, and how do alternative taxation mechanisms affect public revenue, employment, investment, productivity and income distribution?**

The application should be scientifically transparent, interactive, reproducible, and deployable at zero hosting cost through GitHub Pages.
