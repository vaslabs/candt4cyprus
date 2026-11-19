# Technical note: Technology A required robot-tax rates at low adoption

**To:** Pablo Casas and José L. Torres
**Re:** *Automation, Taxation, and Social Security Sustainability*, Hacienda Pública Española /
Review of Public Economics 256(1), 69–104 (2026), DOI 10.7866/HPE-RPE.26.1.3
**Purpose:** request for clarification for an independent, open-source replication. This note is
not a critique of the paper's conclusions. Most headline results replicate closely (summary at
the end).

---

## 1. Observation

In Figs 2–4 (left panels, Technology A), the required robot-tax rates are elevated at low
adoption and converge to ≈ 0.56 / 0.38 / 0.28 as φ grows, at different speeds for υ = 1, 2, 3.
Our exact steady-state solution gives rates that are **constant in φ and υ**, equal to the
converged values at every adoption level.

## 2. Why the Technology A rates are constant (our derivation)

We use your steady state (Appendix) with the policy target $SS/Y = \bar s$, where $\bar s$ is the
SS/Y ratio of the same economy at φ = 0 without robot taxes. SS includes the revenue of the
active robot tax, as in your Fig. 5.

1. Equation (25) fixes $R_k$ from (β, δ_k, τ^k) alone.
2. Under constant returns and zero profit, the outer CES unit-cost condition
   $1=c_\rho(R_k,c_X)$ then fixes the unit cost $c_X$ of the labour-task aggregate X, and with it
   the cost share $s_X=c_XX/Y=1-R_kK/Y$. Neither depends on φ, υ or any robot tax.
3. Labour cost and robot cost exhaust that share: $(1+\tau^{sse})WL+(1+\tau^{ssz})R_dD=s_XY$.
4. With $a=(\tau^{sse}+\tau^{ssw})/(1+\tau^{sse})$, labour yields `a` units of SS per unit of
   labour cost. The target is therefore $\bar s=a\,s_X$. It holds for every φ iff the robot source
   yields `a` per unit of robot cost:

$$\frac{\tau^{ssz}}{1+\tau^{ssz}}=a,\qquad \frac{\tau^{d}(R_d-\delta_d)}{R_d}=a,\qquad \frac{\tau^{id}\delta_d}{R_d}=a .$$

With $R_d$ from (26), $r=1/\beta-1$, the closed forms are:

$$\tau^{ssz}=\frac{\tau^{sse}+\tau^{ssw}}{1-\tau^{ssw}},\quad
\tau^{d}=\frac{a\,(r+(1-\tau^k)\delta_d)}{r+a\,\delta_d},\quad
\tau^{id}=\frac{a\,(r+(1-\tau^k)\delta_d)}{(1-\tau^k)\delta_d-a\,(r+\delta_d)}.$$

With your Table 1 calibration these are **τ^ssz = 0.2798, τ^d = 0.5588, τ^id = 0.3789**. They
match your converged values of 0.28, 0.56 and 0.38, and they hold for any φ at which a steady state
exists. This is consistent with your statement that the Technology A rates are independent of
the elasticity of substitution, but here the independence holds exactly at every adoption level,
not only asymptotically. Under Technology B, R_k does not pin down the relevant cost share, so
the rates do vary with adoption. Our Technology B paths match your Figs 2–4 (right panels) well.

## 3. A possible explanation (hypothesis, not adopted)

The transients appear if the target is slightly **above** the model's own φ = 0 ratio. As φ → 0
the robot tax base vanishes while a fixed gap remains, so the required rate rises without bound.
Robot income tax, Technology A, υ = 2:

| Target SS/Y | φ = 0.02 | 0.05 | 0.10 | 0.20 | 0.30 |
|---|---:|---:|---:|---:|---:|
| 0.1516 (model's φ = 0 value) | 0.559 | 0.559 | 0.559 | 0.559 | 0.559 |
| 0.1516 + 0.0002 | unattainable | 0.587 | 0.566 | 0.561 | 0.560 |
| 0.1516 + 0.0005 | unattainable | 0.628 | 0.577 | 0.563 | 0.561 |
| Fig. 2 (visual reading) | ≈ 0.62 | ≈ 0.57 | ≈ 0.562 | ≈ 0.559 | ≈ 0.559 |

## 4. Questions

1. Was the target SS/Y set to the computed φ = 0 ratio, or to a fixed number (e.g. a rounded or
   externally calibrated value), or to the ratio at a small positive φ?
2. In eq. (1), Table 1 describes θ = 0.35 as the *traditional capital share*, but θ multiplies X as
   typeset. Your Figs 1 and 8 (SS/Y ≈ 0.151, labour share ≈ 0.59, capital share ≈ 0.31) are
   reproduced only with weight 0.35 on K. Can you confirm this is the intended specification?
3. The Fig. 6–7 levels (L ≈ 0.33, Y ≈ 0.6, K ≈ 2.0) are reproduced when the labour-supply
   condition (24) is solved without the tax wedges (1+τ^c) and (1−τ^l−τ^ssw). With them we
   obtain L = 0.237, Y = 0.423. Which version was used for the figures? Ratios and tax rates are
   unaffected either way.
4. How are the net income shares in Figs 10–11 defined? With (factor income − its
   depreciation)/(Y − total depreciation), and labour income including employer SS, we obtain a
   baseline net labour share of 0.862 against ≈ 0.84 in the figures, and different scheme
   rankings at high adoption.
5. Fig. 5 / Introduction: is "robots constitute approximately 35% of total capital" meant as the
   adoption parameter (≈ 0.35 at the crossover in our solution) or as D/(K+D) (≈ 0.26 for Tech A
   and ≈ 0.51 for Tech B in our solution)?

## 5. What replicates (for context)

At tolerances fixed in advance, 17 of 21 benchmarks pass. These include:
- every headline rate within ±0.002;
- the baseline SS/Y of 0.1516;
- the labour/robot SS crossover at adoption 0.35–0.39;
- the robot SS contribution as the least distortionary scheme;
- the gross labour-share ordering τ^id > τ^d > τ^ssz;
- the flat Tech A capital share;
- the Technology B rate paths.

Steady states are cross-checked against an independent SciPy implementation.

Code, tests and the full report: `docs/replication/REPLICATION_REPORT.md` in the project repository.
