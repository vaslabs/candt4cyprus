# Exploratory policies E, F, G: definitions, assumptions and limitations

**Status:** new research hypotheses. These policies are **not** part of Casas & Torres (2026), and
nothing here is empirically validated as an optimal tax. Policies A–D are the paper's
instruments (A = no specific robot tax; B = robot income tax; C = robot investment tax;
D = employer SS on robots).

Two analytical levels are kept separate:

| Level | What | Code | Can it estimate Cyprus revenue? |
|---|---|---|---|
| 2 (macro) | Representative-firm steady state, Cyprus-calibrated | `src/economics/paper/*` (extensions), `policies/registry.ts`, `simulation/comparisons.ts` | Only as a ratio to model output under stated assumptions. Not a forecast. |
| 3 (firm) | Statutory-rule simulator for individual, **hypothetical** firms | `src/economics/firm/*` | **No.** No firm-level data bridge exists; results must not be aggregated to national revenue. |

---

## Policy E: contribution on corporate gross value added

**Level 2.** The firm pays τ_E on covered GVA (in the model, GVA = Y at factor cost):

$$\Pi=(1-\tau_Ec_E)\,Y-(1+\tau^{sse})WL-R_kK-(1+\tau^{ssz})R_dD .$$

Under constant returns this is a lower net output price p = 1 − τ_E c_E. The dual solver uses
c(R_k/p, p_D/p, (1+τ^sse)W/p) = 1. Revenue is τ_E c_E Y.
- **Coverage c_E** stands in for size thresholds, minimum taxable value added and sector
  exemptions: it is the share of GVA produced by liable firms. `coverageAfterExemptions` computes
  it from sector GVA (CYSTAT 2025).
- **Representative-firm approximation:** exempt and liable firms are not modelled separately.
  The rate is applied uniformly at τ_E·c_E. Tested: (τ, c) ≡ (τc, 1).
- **Replace or supplement:** `payrollReplacement` ψ lowers the effective employer SS rate to
  (1−ψ)τ^sse, and the required τ_E is re-solved.
- **Business response:** general equilibrium. The taxable base (Y) falls endogenously as
  factor demands adjust. It is not held fixed.

**Level 3.** Contribution = τ_E × B, with B = GVA·(1−τ_E)^ε_E (a constant-elasticity behavioural
assumption). Firms are exempt by sector, by employees < threshold, or by GVA < minimum.
- **Value added ≠ turnover.** GVA = revenue − intermediate consumption. Turnover is never the base.

## Policy F: labour-share-adjusted contribution

**Definition.** Labour share = employee compensation / GVA, where employee compensation =
gross pay + employer statutory contributions (the national-accounts D1 concept).

**Level 2.**

$$T_F=\tau_F\,c_F\max\big(0,\ \bar s\,Y-(1+\tau^{sse})WL\big).$$

When it binds, this is **exactly** a VA levy at τ_F c_F s̄ combined with a labour-cost credit of
τ_F c_F (tested). That gives net price p = 1 − τ_F c_F s̄ and labour cost (1−τ_F c_F)(1+τ^sse)W.

There are three regimes:
- binding (s_L < s̄);
- non-binding (s_L ≥ s̄): zero revenue, no effect;
- kink: firms bunch exactly at s̄ and the contribution raises zero. Solver 1 finds it by Brent's method on the fraction of the incentive that is active.

If both corner regimes are self-consistent, the solver reports multiple equilibria and does not pick one.

**Important property (found by simulation):** F encourages firms to raise their labour share,
which shrinks its own base. Near the benchmark it may be **unable** to finance the SS gap at any
rate. This is reported as "unattainable".

**Level 3.** Contribution = min(τ_F × B, cap × EBIT), with
B = max(0, s̄_sector·GVA − (comp + ω·outsourced labour))·(1−τ_F)^ε_F. Configurable:
- sector benchmarks;
- the share ω of outsourced labour counted as labour (anti-avoidance);
- a **profitability condition:** only firms with EBIT/GVA ≥ m pay, so a high-sales, low-profit firm is not treated like a profitable automated firm;
- a cap as a share of profit;
- company size.

**A low labour share is not evidence that a firm replaced workers with AI.** It can reflect
capital intensity, outsourcing, the sector, intangible assets or profit shifting. Policy F is a
stylised formula, not an empirically validated optimal tax.

## Policy G: excess-economic-profit contribution (and G′, a different instrument)

**Level 2, primary design: neutral allowances.** Capital owners pay τ_G on returns above an
allowance, separately for each capital, plus τ_G on pure rents Π when the rents extension is on:

$$T_G=\tau_G\big[(R_k-\delta_k-r_K)^+K+(R_d-\delta_d-r_D)^+D+\Pi\big].$$

- The allowances r_K and r_D are **each capital's own required pre-tax net return** in the
  absence of G (`neutralAllowances`). That includes the effect of robot taxes, which raise D's required return.
- In the competitive model (zero rents) G then raises **nothing** and changes nothing. That is the
  correct result, and it is tested, including with robot taxes present.
- In the comparisons, G is reported as "unattainable": it cannot finance an SS gap without rents.

**G′, the reduced-allowance capital-return levy.** The allowance is a fraction f < 1 of each neutral return
(default 0.5). G′ taxes part of the **ordinary** return to capital and behaves like a capital-income
tax. It is **not** a neutral tax on excess economic profits, and it is labelled and reported separately.

**Exploratory rents extension (`extensions.rents.markup`, not in the paper).** Firms price at a markup m
over marginal cost, so the unit-cost condition becomes c(·) = (1 − τ_E c_E)/(1+m). Pure profit
Π = m/(1+m)·(1 − τ_E c_E)·Y accrues to households lump-sum. Neutral G then taxes **genuine rents**
and leaves the allocation unchanged (tested). The two solvers agree.
- The markup itself is a distortion relative to the competitive economy. Comparisons are made against
  the same markup economy without a new instrument.
- Combining it with policy F is rejected, because profit attribution at F's kink is undefined.

Every G result reports revenue **on rents** separately from revenue **on capital returns above the allowance**.

**Level 3.** Base = max(0, EBIT − r_n·capital − allowance share × AI investment − losses brought
forward). Profit shifting: shifted share = min(max mobility, η·τ_G).

---

## Policy E: model dependence (step 6 review)

E ranks first on welfare cost per € in every long-run Cyprus configuration tested. **This is a conditional
model result, not a policy ranking for Cyprus.** It depends on:
- **Elastic capital supply (long run).** In the short-run scenario with capital fixed (`shortRun.ts`),
  instruments on capital income or robot use fall on a fixed factor and cost almost nothing, while E
  still distorts hours. **E then ranks last.** This is the main region where E's relative performance changes.
- **One representative firm.** Coverage factors only rescale the rate, so the welfare cost per € is
  invariant to coverage (§3.1 of the comparison report). Coverage is not a behavioural model.
- **No avoidance or shifting costs** in the macro model. Firm heterogeneity, SME versus large-firm treatment, low-margin and
  loss-making firms, and behavioural elasticities are therefore covered by separate scenario
  calculations: SBS sector × size-class cells (business economy only) and Level 3 firms. They are not
  aggregated to national revenue.
- **With genuine rents** (the rents extension), neutral G raises revenue at zero welfare cost and outranks E.

**Objectives.** "Restore the Fund financing target" (additional revenue; default) or "revenue-neutral
swap" (replace a share ψ of employer SS and keep SS/Y unchanged), selectable in `comparePolicies`.

## Policy F: SBS sector benchmarks

Sector labour shares come from Eurostat SBS (sbs_sc_ovw, Cyprus, latest year 2024):
employee benefits expense / value added at factor cost (`src/economics/data/sbs.ts`). They are
**descriptive defaults, not optimal thresholds**.
- The generic 50% remains the illustrative default, and user thresholds are allowed.
- Wages-only shares are reported separately, because they omit employer social charges.
- Confidential or missing cells are never imputed: the benchmark becomes unavailable, with a reason.
- Coverage note: SBS covers the business economy only, with enterprises as statistical units, and excludes the self-employed from employee benefits.

## Business archetypes

The three archetypes are **constructed** from SBS cells: I55, M69 and J62, size class 50–249, 2024.
Every field is tagged **observed**, **derived**, **assumed** or **behavioural**, with its source
(`ARCHETYPE_MODELS[*].provenance`).
- SBS does not publish employees or employee benefits by size class for these cells, so division-wide ratios are applied to the size-class enterprise.
- Capital stock, depreciation, pay dispersion, AI investment and outsourcing are assumptions.
- Profit-shifting mobility is a behavioural assumption with a stated sensitivity range.

## Comparison methodology (Level 2)

For each instrument, the rate is solved so that SS/Y returns to the **target**: the model's
zero-adoption SS/Y. That equals the Social Insurance Fund's actual 2023 contributions excluding the state
share (6.45% of factor-cost output), because of the top-down calibration (MODEL_DEVIATIONS C4).
Revenue from every instrument is earmarked for SS by construction, as for the paper's robot taxes (D5).

Indicators are measured against the economy **without any new instrument** at the same adoption level:
- SS/Y;
- changes in Y, C, I, L;
- gross and net labour shares; capital share;
- employer burden: employer SS + robot SS + E + F, divided by Y;
- **steady-state consumption-equivalent welfare** λ, with γ ln(1+λ) = U_policy − U_ref;
- **welfare cost per € raised**: −λ·C_ref / instrument revenue.

These are comparisons between steady states. They are not transition welfare, and they include
no growth effects.

## Departures from the paper (summary)

| Item | Paper | This project |
|---|---|---|
| Instruments | B, C, D | plus E, F, G (new) |
| Firm problem | zero-profit CRS with SS wedges | plus net-price and labour-credit wedges (E, F) |
| Household | Euler equations (25)–(26) | plus G's excess-return term |
| Efficiency measure | qualitative (output paths) | plus steady-state CE welfare and cost per € |
| Calibration | OECD-average artificial economy | plus the Cyprus Level 2 preset; the replication preset is unchanged |

## Limitations

1. Long-run steady states of a closed, representative-agent economy with no growth and no
   unemployment. The adoption parameter is a CES weight, **not** a share of firms using AI.
2. Near the existence boundary (Tech B φ* = 0.483; **Tech A φ* = 0.283 under the Cyprus
   calibration**) the untaxed economy approaches AK growth. Percentage changes against that
   reference are very large and reflect proximity to the boundary, not realistic magnitudes.
3. E, F and G use representative-firm coverage factors. Heterogeneous exemptions,
   bunching at size thresholds, and sector reallocation are not modelled at Level 2.
4. The Level 3 behavioural elasticities are assumptions, not estimates. The archetypes are invented.
5. **Company-level results cannot be aggregated to national revenue.** No micro-data bridge
   (firm distribution of GVA, labour shares and profits) has been built or validated.
6. The effective SI rate is a calibrated coefficient. With a euro ceiling held fixed in nominal
   terms and wages that rise, results are an approximation unless the `fixedNominal` feedback is used.
7. No pension-liability or demographic projection: SS/Y is the paper's financing ratio, not a
   solvency test of the Fund.
