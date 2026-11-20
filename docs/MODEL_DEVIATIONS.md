# Model deviations register

Every deliberate departure from the printed text of Casas & Torres (2026), and every
interpretation of something the paper leaves unspecified. Each entry records the evidence, the
selectable variants, the default, and where it applies.

**Scope rule:** these choices apply to **Level 1 (paper replication)**. None of them carries over to
the Cyprus model (Level 2) automatically. If a Cyprus preset reuses one, it gets its own entry in
the Cyprus section below, with a justification.

Every simulation output records its `equationVariant`, `calibrationPreset`, `solver` and
`convergence` status (`RunMetadata` in `src/economics/paper/types.ts`).

The numerical comparison table (printed equations vs default vs figure replication vs published
figure values) is generated from the code: `docs/replication/variant-comparison.md`
(`npm run replication:variants`).

| ID | Topic | Type | Default (replication) | Alternative | Status |
|---|---|---|---|---|---|
| D1 | Tech A CES weight θ | Printed-text conflict | `capitalWeight` = 0.35 on K | `asPrinted`: θ = 0.35 on X | Implemented + tested |
| D2 | Tax wedges in labour supply (24) | Figures ≠ printed eq. | `asPrinted`: wedges included | `figureReplication`: wedges removed | Implemented + tested |
| D3 | Net income shares | Undefined in paper | Standard net definition | none; the gap is reported | Implemented; gap reported |
| D4 | Elasticity = 1 | Formula undefined | Cobb–Douglas limit | none | Implemented (core) |
| D5 | Robot revenue counted as SS financing | Interpretation | Counted (Fig. 5) | none | Implemented (accounts) |
| D6 | Choice among multiple tax roots | Unspecified | Smallest τ ≥ 0; others reported | none | Planned (step 4) |

---

## D1. Technology A: weight on traditional capital

- **Printed:** eq. (1) $Y=[\theta X^{(\rho-1)/\rho}+(1-\theta)K^{(\rho-1)/\rho}]^{\rho/(\rho-1)}$,
  with FOC (6) $R_k=(1-\theta)Y^{1/\rho}K^{-1/\rho}$. Table 1 says θ = 0.35 is the *traditional
  capital share*.
- **Conflict:** with θ = 0.35 as printed, capital gets weight 0.65.
- **Evidence** (φ = 0, no robot tax; computed in step 1, to be confirmed by the tests in step 3):

  | | gross labour share | trad. capital share | SS/Y |
  |---|---|---|---|
  | 0.35 on K | 0.598 | 0.307 | 0.1516 |
  | 0.35 on X (as printed) | 0.401 | 0.536 | 0.1015 |
  | Figs 1, 8 | ≈ 0.59 | ≈ 0.31 | ≈ 0.151 |

- **Source check:** re-read from a 170-dpi render of p. 76 (2026-11-20). Eq. (1) and FOC (6) are
  printed as quoted above, so this is a conflict in the printed paper, not a transcription error.
- **Decision:** default `capitalWeight` = 0.35, i.e. θ_X = 0.65. Variant `asPrinted` is available
  and labelled.
- **Note:** Tech B (eq. 11) puts α = 0.35 on K as printed. The default makes Tech A and Tech B
  identical at zero adoption, which is what the paper says it intends ("to make the two
  technological specifications comparable", §4).

## D2. Labour-supply condition (24): tax wedges

- **Printed:** $(1+\tau^c)C=\frac{\gamma}{1-\gamma}(1-L)W(1-\tau^l-\tau^{ssw})$.
- **Evidence:** the baseline levels in Fig. 6 (L ≈ 0.33, Y ≈ 0.6, K ≈ 2.0, C ≈ 0.48) are
  reproduced only when the wedges $(1+\tau^c)$ and $(1-\tau^l-\tau^{ssw})$ are dropped. As
  printed, L = 0.237 and Y = 0.423.
- **Source check:** re-read from a 170-dpi render of p. 79 (2026-11-20). The wedges are printed as
  quoted. Euler equation (26) and its steady-state form (29) also match `capitalReturns`.
- **Decision:** default `asPrinted`. Variant `figureReplication` is never applied silently. It is
  shown in every output, export and scenario file.
- **Reach:** this affects **levels only**. Ratios (SS/Y, shares, required tax rates) do not depend
  on (24). The proof and its conditions are in MODEL_SPEC §5 and will be tested in step 3.

## D3. Net income shares (Figs 10–11)

- Not defined in the paper. We use the standard definition: net factor share = (gross factor
  income − depreciation of that factor) / (Y − total depreciation).
- Labour income is measured as total labour cost (1+τ^sse)WL, and robot income as
  (1+τ^ssz)R_dD. Net shares therefore sum to exactly 1, which is tested.
- At baseline this gives net labour 0.862 and net traditional capital 0.138, against ≈ 0.84 and
  ≈ 0.16 read off Figs 10–11. **The discrepancy is preserved and reported. The definition is not
  tuned to match.**

## D4. Unit elasticity

- CES with elasticity 1 is undefined as written. Figs 2–4 use υ = 1 and σ = 1. We use the
  Cobb–Douglas limit. `src/economics/core/ces.ts` evaluates the power mean with
  `expm1`/`log1p`, so the result is continuous through s = 1. This is property-tested.

## D5. Robot-tax revenue as social-security financing

- Fig. 5 shows a "robot source" share for all three schemes, so all three robot taxes are treated
  as earmarked for social security: SS = (τ^sse + τ^ssw)WL + robot revenue. The bases follow eq. (33):
  τ^d(R_d − δ_d)D, τ^id·I_d, τ^ssz·R_d·D.

## D6. Multiple solutions for the required tax rate

- The paper does not say which root to take if SS/Y(τ) = target has several solutions (a Laffer
  shape). We take the smallest τ ≥ 0, and the output lists any additional roots found.
- **Prohibitive limit.** As τ^k + τ^d → 1, robots are taxed out of existence (R_d → ∞, D → 0),
  the economy reverts to the no-automation baseline, and SS/Y → target asymptotically. Roots
  within 1e-4 of that cap are artefacts of the limit, so the band is excluded (`PROHIBITIVE_BAND`).
- **Tax-dependent existence.** Robot taxes raise the cost of robots and move the existence
  boundary outward. Above the untaxed boundary, a steady state may exist only for rates above
  some minimum. Results flag this (`untaxedSteadyStateExists: false`).

---

## Cyprus model (Level 2)

The Cyprus preset (`cyprus-2026`) is a separate configuration. The paper-replication preset
and its variants are unchanged and are tested independently.

| ID | Topic | Choice | Justification |
|---|---|---|---|
| C1 | D1 (Tech A weight) | **Not carried over.** The weight on K is calibrated directly from Cyprus data (`capitalShareParam` = calibrated w_K, variant `capitalWeight`). | The θ ambiguity is about the paper's printed notation. The Cyprus calibration defines the weight explicitly from the measured capital share. |
| C2 | D2 (eq. 24 wedges) | **Not carried over.** Eq. (24) is used as printed (wedges included). | The figure-replication variant exists only to compare with the paper's plotted levels. |
| C3 | Meaning of "SS" (treatment of each component) | Model SS = Fund contributions excluding the state share, i.e. employed persons (employee + employer, private and public), self-employed and voluntary contributors, reproduced through one effective rate per side on the model wage bill.
- **Self-employed contributions:** included in the target (the model has one labour type).
- **State contribution (5.2%):** excluded from model SS; it is a budget transfer, reported from the accounts.
- **Imputed self-employed labour income:** part of the model's labour cost share, but not a contribution base.
- **Other employer schemes** (GHS, provident funds, Social Cohesion, Redundancy, HRD, Holiday): part of labour cost, not SS. | Prevents double-counting. Matches the policy question (Fund financing). |
| C4 | Effective SI rates | **Default (top-down):** τ^sse = τ^ssw chosen so model SS/Y equals the Fund's actual contributions excluding the state share (SIS final accounts 2023: 6.45% of factor output), giving 0.0610. **Alternative (bottom-up):** statutory rate × insurable share of the wage bill: **tail-free band estimate** from CYSTAT 2025 monthly earnings bands and the published mean, against the 2026 monthly ceiling (share 0.8995). Alternative: lognormal (log-sd 0.752 from mean/median; share 0.920), also used for wage-change scenarios. | The representative-agent model cannot apply a per-person ceiling. Ceiling and earnings use the same (monthly, nearest-year) basis. An earlier draft compared the 2026 ceiling with 2023 national-accounts wages; that was caught by the cross-checks and corrected. Bottom-up overstates Fund revenue by ≈27% because the model's wage bill (built from the labour cost share) also contains non-Fund employer contributions and imputed self-employed income. The statutory arithmetic itself reconciles with the data (17.6% × 0.8995 × D11 ≈ €1.81bn vs €1.86bn actual). |
| C5 | Other employer levies | GHS (2.9%), Social Cohesion (2%), Redundancy (1.2%), HRD (0.5%) and Holiday Fund are folded into the gross wage W. They are not SS in the model. | The paper's model has a single employer wedge. Statutory amounts are computed exactly in the firm/payroll module. |
| C6 | Effective τ^k, τ^l, τ^c | From national accounts: τ^k = D51B / net capital income; τ^l = D51A / (D11 + B3G); τ^c = D21 / (C + G − D21). | Statutory rates (15% CIT, progressive PIT, 19% VAT) are **not** the paper's effective rates. Incidence assumptions are documented in the data file. |
| C11 | Discount factor β | **Primary: β = 0.975** (structural assumption, paper value; does NOT reproduce the observed K/Y, which is 5.70 in the model vs 2.89 in the data). **Alternative: β = 0.922**, chosen to reproduce the 2023 capital/output ratio (implies an 8.4% net after-tax return). | Neither is an established estimate of Cyprus preferences. Both are reported, with sensitivity. |
| C12 | Technology | **Default: Technology B**; Technology A is a mandatory comparison in every Cyprus result. | Neither is empirically established for Cyprus. |
| C13 | SI ceiling and wage changes | `indexed` (ceiling moves with wages; the fixed effective rate is exact), `fixedNominal` (2026 euro ceiling; τ_eff solved as a fixed point using the CYSTAT bands scaled by W/W₀), or `fixed-effective-rate (approximation)` when neither is applied. | Responds to the reviewer's requirement that wage-driven changes above the ceiling be modelled when data permit. |
| C7 | Base year | 2023, the latest year with a net capital stock, so K matches the flows. 2025 figures are used for headline indicators. | Consistency of stocks and flows. |
| C8 | Baseline adoption | 0 (scenario variable). | No Cyprus estimate of the CES adoption parameter exists. It is not the share of firms using AI. |
| C9 | Government consumption | Not modelled. Revenue is rebated lump-sum, as in the paper. Model C/Y therefore covers private + government consumption. | Paper's structure. The calibration diagnostics flag the untargeted C/Y and I/Y moments. |
| C10 | Propositions 1 and 3 | **Not assumed.** They hold inside the Level 2 model only while effective rates are held fixed (condition C4 of Prop. 1). With a fixed euro ceiling and wages that change, the effective SI rate varies, which breaks both propositions. Tests demonstrate this explicitly. | User requirement; MODEL_SPEC §5a conditions. |
