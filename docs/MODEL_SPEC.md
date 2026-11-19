# Model specification — Casas & Torres (2026) replication

**Reference:** Casas, P. & Torres, J. L. (2026). *Automation, Taxation, and Social Security
Sustainability.* Hacienda Pública Española / Review of Public Economics, 256(1), 69–104.
DOI [10.7866/HPE-RPE.26.1.3](https://doi.org/10.7866/HPE-RPE.26.1.3). Licensed CC BY-NC 4.0 by
the publisher; the PDF is **not** redistributed in this repository.

This document is the contract between the paper and the code. Every equation carries its paper
number. Every place where the code departs from the printed text is listed in §6 with the reason.

Status: **Level 1 (paper replication) — specification only.** No result here is a Cyprus estimate.

---

## 1. Notation and units

All variables are steady-state, per-period (annual), in model units (output price = 1, total time = 1).

| Symbol | Meaning | Paper |
|---|---|---|
| Y | final output | (1), (10) |
| X | Tech A: effective labour tasks (robots + humans). Tech B: traditional technology (K + L) | (2), (11) |
| K, D | traditional capital, autonomous capital (robots + AI) | |
| L | human labour hours, 0 < L < 1 | (19) |
| C, I = I_k + I_d | consumption, total investment | (20) |
| W | wage received by worker before employee taxes | (5), (14) |
| R_k, R_d | rental rates *received by households* | (6), (15) |
| τ^c, τ^l, τ^sse, τ^ssw, τ^k | consumption, labour income, employer SS, employee SS, capital income taxes | Table 1 |
| τ^d | robot income tax (on top of τ^k) | (20) |
| τ^id | ad-valorem tax on robot investment | (20) |
| τ^ssz | employer SS contribution on robots, base = R_d·D | (3) |
| φ (A), μ (B) | autonomous-capital **adoption parameter** (a CES distribution parameter, *not* a share of firms using AI) | (2), (10) |

## 2. Technology

### Technology A — robots substitute labour, complement traditional capital (§3.1)

$$Y=\Big[\theta_X X^{\frac{\rho-1}{\rho}}+(1-\theta_X)K^{\frac{\rho-1}{\rho}}\Big]^{\frac{\rho}{\rho-1}}\qquad(1)$$
$$X=\Big[\phi D^{\frac{\upsilon-1}{\upsilon}}+(1-\phi)L^{\frac{\upsilon-1}{\upsilon}}\Big]^{\frac{\upsilon}{\upsilon-1}}\qquad(2)$$

Firm problem (3): $\max\; Y-(1+\tau^{sse})WL-R_kK-(1+\tau^{ssz})R_dD$. FOCs (4)–(6):

$$(1+\tau^{ssz})R_d=\phi\,\theta_X\,Y^{1/\rho}X^{\frac{1}{\upsilon}-\frac{1}{\rho}}D^{-1/\upsilon}\quad(4)$$
$$(1+\tau^{sse})W=(1-\phi)\,\theta_X\,Y^{1/\rho}X^{\frac{1}{\upsilon}-\frac{1}{\rho}}L^{-1/\upsilon}\quad(5)$$
$$R_k=(1-\theta_X)\,Y^{1/\rho}K^{-1/\rho}\quad(6)$$

Gross factor shares (7)–(9): $S_l=WL/Y$, $S_k=R_kK/Y$, $S_d=R_dD/Y$, with
$(1+\tau^{sse})S_l+S_k+(1+\tau^{ssz})S_d=1$ (Euler / zero profit).

> **Notation discrepancy (see §6.1).** As printed, θ multiplies X, but Table 1 calls θ = 0.35 the
> *traditional capital share*. The published figures are only reproducible with weight 0.35 on K,
> i.e. θ_X = 0.65. The code uses an explicit `capitalWeight` = 1 − θ_X = 0.35.

### Technology B — robots substitute both traditional capital and labour (§3.1)

$$Y=\Big[\mu D^{\frac{\sigma-1}{\sigma}}+(1-\mu)X^{\frac{\sigma-1}{\sigma}}\Big]^{\frac{\sigma}{\sigma-1}}\qquad(10)$$
$$X=\Big[\alpha K^{\frac{\varepsilon-1}{\varepsilon}}+(1-\alpha)L^{\frac{\varepsilon-1}{\varepsilon}}\Big]^{\frac{\varepsilon}{\varepsilon-1}}\qquad(11)$$

FOCs (13)–(15):
$$R_k=\alpha(1-\mu)Y^{1/\sigma}X^{\frac{1}{\varepsilon}-\frac{1}{\sigma}}K^{-1/\varepsilon}\quad(13)$$
$$(1+\tau^{sse})W=(1-\alpha)(1-\mu)Y^{1/\sigma}X^{\frac{1}{\varepsilon}-\frac{1}{\sigma}}L^{-1/\varepsilon}\quad(14)$$
$$(1+\tau^{ssz})R_d=\mu\,Y^{1/\sigma}D^{-1/\sigma}\quad(15)$$
Shares (16)–(18) as in Tech A.

### Elasticity = 1

Figures 2–4 use υ = 1 and σ = 1. The CES forms above are undefined there; the code uses the
Cobb–Douglas limit (e.g. $X=D^{\phi}L^{1-\phi}$) and its dual, and tests continuity as the
elasticity → 1.

## 3. Households (§3.2)

Utility (19)/(23): $\sum_t\beta^t[\gamma\ln C_t+(1-\gamma)\ln(1-L_t)]$.

Budget (20):
$$(1+\tau^c)C+I_k+(1+\tau^{id})I_d=(1-\tau^l-\tau^{ssw})WL+(1-\tau^k)R_kK+(1-\tau^k-\tau^d)R_dD+\tau^k\delta_kK+(\tau^k+\tau^d)\delta_dD+T$$

Accumulation (21)–(22): $D'=(1-\delta_d)D+I_d$, $K'=(1-\delta_k)K+I_k$.

Euler/optimality (24)–(26), steady state (Appendix):

$$(1+\tau^c)C=\tfrac{\gamma}{1-\gamma}(1-L)W(1-\tau^l-\tau^{ssw})\quad(24)$$
$$R_k=\frac{1/\beta-1+(1-\tau^k)\delta_k}{1-\tau^k}\quad(25,\ \text{App.})$$
$$R_d=\frac{(1+\tau^{id})/\beta-1-\tau^{id}(1-\delta_d)+(1-\tau^k-\tau^d)\delta_d}{1-\tau^k-\tau^d}\quad(26,\ \text{App.})$$

I re-derived (26) from (20)–(21) and it matches the Appendix form. Depreciation is deductible
from both capital-income tax bases (footnote 6).

## 4. Government (§3.3)

Revenue (33):
$$T=\tau^cC+(\tau^l+\tau^{ssw}+\tau^{sse})WL+\tau^k(R_k-\delta_k)K+(\tau^k+\tau^d+\tau^{ssz})R_dD-(\tau^k+\tau^d)\delta_dD+\tau^{id}I_d$$

Balanced budget each period, everything rebated lump-sum (T). Only one robot tax is active per
simulation. Resource constraint: $C+I=Y$, steady state $I=\delta_kK+\delta_dD$.

### Social-security contributions and the policy target (§5)

$$SS=\underbrace{(\tau^{sse}+\tau^{ssw})WL}_{\text{labour source}}+\underbrace{\text{RobotRev}}_{\text{robot source}}$$

| Scheme | Robot revenue (tax base per (33)) |
|---|---|
| 1. Robot income tax τ^d | τ^d (R_d − δ_d) D |
| 2. Investment tax τ^id | τ^id I_d = τ^id δ_d D |
| 3. Robot SS contribution τ^ssz | τ^ssz R_d D |

The paper counts robot-tax revenue as social-security financing (Fig. 5 shows a "robot source"
for all three schemes). The target is $SS/Y=\overline{s}$, with $\overline{s}$ = the no-automation
ratio (Fig. 1 intercept ≈ 0.151); in the app $\overline{s}$ is adjustable. For each adoption level
the required robot tax is the **smallest** τ ≥ 0 with $SS(\tau)/Y(\tau)=\overline{s}$ (bracketed
root search; a Laffer-type second root is reported, not silently chosen).

The paper's system (§4): 10 unknowns (Y, C, K, D, L, X, W, I, R_k, R_d), 10 equations.

## 5. Solution method

Two **independent** implementations are built and tested against each other.

**Solver 1 — dual / cost-function reduction (semi-analytic).**
Taxes fix R_k and R_d (§3). Under constant returns and price-taking, input prices fix all ratios
per unit of output. With unit cost $c(\cdot)=1$:

- Tech A: $1=[(1-\theta_X)^\rho R_k^{1-\rho}+\theta_X^\rho c_X^{1-\rho}]^{1/(1-\rho)}$ gives c_X;
  $c_X^{1-\upsilon}=\phi^\upsilon p_D^{1-\upsilon}+(1-\phi)^\upsilon p_L^{1-\upsilon}$ gives
  $p_L=(1+\tau^{sse})W$, where $p_D=(1+\tau^{ssz})R_d$.
- Tech B: analogous with the nesting reversed.
- Shephard's lemma gives K/Y, D/Y, X/Y, L/Y; then C/Y = 1 − δ_k K/Y − δ_d D/Y.
- (24) is linear in L given those ratios: $L=A/(A+B)$, $A=\frac{\gamma}{1-\gamma}W(1-\tau^l-\tau^{ssw})$,
  $B=(1+\tau^c)(C/Y)/(L/Y)$.

**Existence condition.** A steady state exists only if p_L comes out positive and finite, e.g.
Tech A with υ > 1 requires $c_X^{1-\upsilon}>\phi^\upsilon p_D^{1-\upsilon}$. Past that point
robots alone are cheap enough that the economy becomes AK-like (Y, D → ∞, L → 0). That is the
explosion visible in Figs 6–7 near φ ≈ 0.43–0.45. The code reports **"no steady state"** there
and never extrapolates. This matches the paper's "considering only feasible scenarios".

**Solver 2 — full 10-equation system (as in the paper).** Damped Newton on log-transformed
positive unknowns with a numerical Jacobian, line search, and continuation in φ/μ (each solution
seeds the next). It also reports convergence diagnostics: residual norm, iteration count, and
Jacobian condition estimate.

**Key structural fact (tested).** All per-unit-of-output quantities (SS/Y, factor shares,
**required tax rates**) depend only on prices, so on (β, δ, taxes, technology) and **not** on the
labour-supply equation (24) or γ. Equation (24) only scales levels (Y, C, K, D, L). This
becomes a metamorphic test: changing γ must leave every ratio and required tax rate unchanged.

## 5a. Propositions used as tests

### Proposition 1 (ratio invariance)
**Claim.** In the steady state, every quantity per unit of output (K/Y, D/Y, L/Y, C/Y, I/Y,
SS/Y, gross and net factor shares, W, R_k, R_d, and therefore the required robot-tax rate that
holds SS/Y at a target) is independent of γ and of which eq. (24) variant is used. Only the scale
of the economy (Y, C, K, D, L) depends on them.

**Conditions.**
- (C1) Constant returns to scale in production.
- (C2) Price-taking firms with zero profit, so the output price = unit cost = 1.
- (C3) A steady state where the Euler equations (25)–(26) do not involve the level of C. This
  holds for any time-separable utility, because C_t/C_{t+1} = 1 in steady state.
- (C4) All taxes proportional to their bases (linear).
- (C5) The policy target is stated as a ratio (SS/Y).

**Proof.** By (C3), (25)–(26) fix R_k, R_d from (β, δ, taxes) alone. By (C1)–(C2), the
zero-profit condition $c(R_k,(1+\tau^{ssz})R_d,(1+\tau^{sse})W)=1$ fixes W. Shephard's lemma
then gives every input per unit of output as a function of those prices. By (C4), every tax
revenue is a linear function of these ratios times Y. γ and the eq. (24) wedges appear only in
(24), which pins down L, and hence Y = L/(L/Y). So ratios are independent of them. The
required tax solves a ratio equation (C5), so it inherits the invariance. ∎

**Where it fails, and why this matters for Cyprus.** (C4) is violated by Cyprus's capped Social
Insurance contributions (€68,904 ceiling) and its progressive income tax. There, contributions
per unit of output depend on the earnings distribution and on levels, so **Proposition 1 must
not be assumed for the Level 2 model.** Each Cyprus extension has to re-establish or drop it.
(C3) fails off the steady state (transition paths).

**Tests:** `tests/economics/paperModel.test.ts`, block "γ-invariance". It is a property test
over random parameters and both eq. (24) variants, with a control test showing that levels
*do* change.

### Proposition 2 (existence boundary)
**Claim.** A finite steady state exists iff every CES stage of the dual reduction has positive
slack (and C/Y > 0; under (C1)–(C2) with R_i > δ_i, C/Y is always positive, so that check is
defensive). For the paper's autonomous nests with elasticity > 1:

- **Tech B** (with ε ≤ 1): $\mu^*$ solves $\mu^{\sigma}\,[(1+\tau^{ssz})R_d]^{1-\sigma}=1$.
  For σ = 2 this gives $\mu^*=\sqrt{(1+\tau^{ssz})R_d}$. With ε > 1 the inner K–L stage can
  bind first.
- **Tech A**: $\phi^*$ solves $\phi^{\upsilon}\,c_X^{\upsilon-1}[(1+\tau^{ssz})R_d]^{1-\upsilon}=1$,
  where $c_X$ is fixed by the outer stage and R_k. For υ = 2, $\phi^*=\sqrt{(1+\tau^{ssz})R_d/c_X}$.
- With elasticity exactly 1 (Cobb–Douglas) labour is essential and **no** boundary exists.

**Interpretation.** At the boundary, autonomous capital alone can produce at unit cost equal to
the zero-profit price. As adoption approaches the boundary from below, labour's cost share → 0,
p_L → ∞, L → 0 and Y, D → ∞ (an AK economy). Beyond it, no finite steady state exists. The
paper's calibration gives **φ\* = 0.43484** (Tech A) and **μ\* = 0.48355** (Tech B). The
independent Python oracle reproduces both to 1e-13.

**Genuine non-existence vs numerical failure.** Results are classified as follows.

| Outcome | Established by | Reported as |
|---|---|---|
| No finite steady state | analytic slack ≤ 0 (Solver 1) | `robots-dominate` / `stage-infeasible` / `invalid-capital-returns` |
| Exists, but a price is outside double range | slack > 0, price overflows | `numerical-range` |
| Newton did not converge | Solver 2 only | `solver-failed`. Never interpreted as non-existence. |
| Exists, ill-conditioned | small `labourCostShare`, large `jacobianCondition` | `ok`, with diagnostics |

Recovering a factor price from unit cost has condition number 1/(that factor's cost share).
Near the boundary this is intrinsic to the model, not a solver defect. Below a cost share of
about 1e-12, double precision cannot distinguish the point from the boundary.

**Tests:** the closed form for Tech B (property test), the paper-calibration values, continuity
of the margin across the boundary, Newton never converging beyond the boundary, conditioning
worsening near it, and agreement with the oracle.

## 6. Discrepancies between the printed paper and its figures

### 6.1 Tech A weight θ (affects everything in Tech A)
Baseline check (φ = 0, no robot tax):

| Reading | gross labour share | traditional capital share | SS/Y |
|---|---|---|---|
| weight 0.35 on **K** | 0.598 | 0.307 | **0.1516** |
| weight 0.35 on X (as typeset) | 0.401 | 0.536 | 0.1015 |
| Paper, Figs 1 & 8 | ≈ 0.59 | ≈ 0.31 | ≈ 0.151 |

**Decision:** weight 0.35 on K, matching Table 1's wording and the figures. Recorded as a
documented deviation from the typeset eq. (1).

### 6.2 Level of labour hours (affects only levels in Figs 6–7)
Baseline levels computed from eq. (24) as printed, compared with Figure 6:

| Variant of (24) | L | Y | K | C |
|---|---|---|---|---|
| as printed (with τ^c, τ^l, τ^ssw wedges) | 0.237 | 0.423 | 1.383 | 0.340 |
| without tax wedges | **0.332** | **0.592** | **1.935** | **0.475** |
| Figure 6 (read off chart) | ≈ 0.33 | ≈ 0.6 | ≈ 2.0 | ≈ 0.48 |

The figure levels match (24) **without** the tax wedges. The required tax rates, SS/Y and factor
shares are unaffected (§5). **Proposal:** implement (24) as printed by default, and add a clearly
labelled diagnostic switch `labourSupplyWedges: false` used only to compare levels with
Figs 6–7. The replication report will show both.

### 6.3 Net income shares (Figs 10–11)
The paper does not define net shares. The standard definition (income − depreciation)/(Y −
depreciation) gives a net traditional-capital share at baseline of ≈ 0.14. Fig. 10 shows ≈ 0.16.
I will test candidate definitions in the replication step and report the gap rather than tune
until it matches.

### 6.4 Minor typos
Eq. (32) has a stray subscript (τ^d_T); eq. (26) dates τ^id at both t and t+1. Neither matters
in steady state.

## 7. Replication benchmarks (to be reported, never hard-coded)

| # | Benchmark | Published |
|---|---|---|
| B1 | SS/Y at zero adoption, both technologies | ≈ 0.151 |
| B2 | τ^d at high adoption, Tech A (all υ ∈ {1,2,3}) | ≈ 0.56 |
| B3 | τ^d at φ = 0.45, Tech B | ≈ 0.48 |
| B4 | τ^id converged, Tech A / Tech B | ≈ 0.38 / 0.23 |
| B5 | τ^ssz converged, Tech A / Tech B | ≈ 0.28 / 0.18 |
| B6 | labour vs robot SS share crossover (Fig. 5) | adoption ≈ 0.33–0.38 |
| B7 | τ^ssz gives the highest Y and C among the three taxes (Figs 6–7) | qualitative |
| B8 | none of the taxes reverses the decline in gross labour share (Figs 8–9) | qualitative |
| B9 | gross traditional-capital share constant in Tech A | ≈ 0.31, flat |

For each one the report gives the computed value, the absolute and relative error, and
PASS/FAIL against a tolerance stated in advance (±0.01 on tax rates unless justified otherwise).

## 8. Verification strategy

1. **Differential testing.** Solver 1 (dual) and Solver 2 (full Newton system) must agree to
   1e-8 relative on every variable, over randomly generated parameter sets.
2. **Property-based tests** (`fast-check`, random but reproducible seeds) over the valid parameter
   domain:
   - CES is homogeneous of degree 1; the dual unit cost equals the primal cost at optimum.
   - Euler's theorem / zero profit: $(1+\tau^{sse})S_l+S_k+(1+\tau^{ssz})S_d=1$.
   - All residuals of (1)–(26) are below tolerance at the returned solution.
   - Resource constraint C + I = Y; government budget (33) equals the sum of its components.
   - Household budget (20) then holds automatically (Walras' law), checked independently.
   - Positivity: Y, C, K, L, 1 − L > 0 and D ≥ 0 whenever a solution is reported.
   - Zero robot tax ⇒ all three schemes give the identical baseline.
   - Endogenous-tax solver: the returned τ actually reproduces the target SS/Y.
   - Continuity as elasticity → 1 (CES vs Cobb–Douglas branch).
3. **Metamorphic tests.** Changing γ leaves ratios and required taxes unchanged. Tech A with
   φ = 0 equals Tech B with μ = 0 (same baseline). Scaling the target by k scales the
   robot-revenue requirement predictably.
4. **Analytic special cases.** Cobb–Douglas closed forms; the no-tax relation
   R_d − δ_d = R_k − δ_k = 1/β − 1 (p. 79); eqs (31)/(32) as identities.
5. **Regression tests** against the benchmarks in §7 and digitised curve points, with stated
   tolerances.
6. **Optional, recommended:** an independent oracle. A short Python/SciPy script (`fsolve` on the
   10-equation system) run in CI on a fixed parameter grid, whose outputs are committed as JSON
   fixtures that the TypeScript tests compare against. This keeps the delivered app TS-only while
   reusing the original Python idea as a cross-check.
7. **Optional:** mutation testing (StrykerJS) on `src/economics/` to measure whether the tests
   actually catch injected bugs.
