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

## Policy G: excess-economic-profit contribution

**Level 2.** Capital owners pay τ_G on returns above an allowance r_n per unit of capital, for each capital:

$$T_G=\tau_G\big[(R_k-\delta_k-r_n)^+K+(R_d-\delta_d-r_n)^+D\big].$$

It enters both Euler equations. If r_n equals the required pre-tax net return
ρ/(1−τ^k), with ρ = 1/β − 1, the policy is **exactly neutral and raises nothing**
(tested), because the competitive model has no economic rents.
- With r_n below the required return it taxes part of the normal return and behaves like a capital-income tax.
- With robot-specific taxes, a single allowance cannot be neutral for both capitals (tested).

The model therefore **cannot** represent market-power or AI rents. G's macro revenue is purely a
normal-return tax by design of the allowance. The default allowance is 50% of neutral, an assumption.

**Level 3.** Base = max(0, EBIT − r_n·capital − allowance share × AI investment − losses brought
forward). Profit shifting: shifted share = min(max mobility, η·τ_G).

---

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
