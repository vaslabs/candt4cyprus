# Cyprus data gaps and how they are handled

Access date for all sources: 2026-11-19. Full provenance: `src/data/sources.json` and
`src/data/cyprus2026.json`. In the app, every number links back to these records.

## 1. Social Insurance Fund finances (the most important gap)

| Item | Status | Handling |
|---|---|---|
| Fund contribution income, revenue, expenditure, reserves, **2021–2025** | **Missing.** No official Fund accounts after 2020 could be retrieved. Audit Office and Social Insurance Services documents for 2021–2024 are behind gov.cy access controls. | Fields set to `null` with status `missing`. 2020 official values (ILO actuarial valuation, Annex 3) are recorded for reference only. |
| Contribution income by payer (employee / employer / self-employed / state) in euros | **Missing** (only rates, and Ageing Report % of GDP, which mixes in the public servants' scheme) | Not used. The model uses statutory rates × insurable share. |
| State's accumulated obligation to the Fund | **Conflicting:** €10.6bn (MoF, end-2023), €12.03bn (Dec 2023), ≈€12bn (Fiscal Council, 2026), €13.9bn (press, Jul 2026) | Left unset. Only explicitly hypothetical scenarios are allowed. |
| Recent annual surpluses (2022–2025) | Secondary only, and sources conflict | Not used. |
| Reserve composition | Conflicting: 98.6% non-tradeable government deposits (ILO, 2020) vs 95% government bonds (Fiscal Council, 2026) | Recorded in notes only. |

**General-government social contributions (€4,899.8m in 2025) are never used as Fund revenue.**
That aggregate includes GHS, other funds and imputed contributions.

**What would close the gap:** Social Insurance Fund financial statements for 2021–2025 (Social
Insurance Services or Audit Office), with contributions split by payer and the state
contribution reported on both a cash and an accrual basis.

## 2. Statutory rules not fully confirmed

| Item | Status | Handling |
|---|---|---|
| Annual maximum insurable earnings €68,904 | Secondary only (KPMG). The official notice states only €5,742/month and €1,325/week. | Calculations use the official per-period ceilings. The annual figure is shown as a secondary reference (= 12 × monthly). |
| Ceiling treatment of a 13th salary or bonus in the month it is paid | **Not found** in official sources (13th/14th salaries are insurable, but the per-period rule for that month is unstated) | The calculator caps each payment period separately. The `salarySchedule(…, 13)` helper treats the 13th salary as its own period; this is labelled as an assumption. |
| Law number for the 2029/2034/2039 rate schedule | Not confirmed (cylaw.org inaccessible); the schedule itself is official (SIS guide) | Schedule implemented as a configurable timeline, separate from the 2026 baseline. |
| EU / third-country / posted workers coverage | Not found | Not modelled. All employees are treated as compulsorily insured. |
| Social Cohesion Fund uncapped | Secondary confirmation only, supported by omission in the official ceiling notice | Implemented as uncapped and flagged. |

## 3. Macro data caveats

- **Major revision (CYSTAT, 20 Oct 2026):** 2022–2024 were revised up sharply. The calibration uses
  post-revision Eurostat vintages (updated Nov 2026), except the capital stock.
- **Capital stock:** the latest year is 2023 (Eurostat), possibly pre-revision. AMECO differs by
  ≈13%. Calibration base year = 2023 for stock–flow consistency.
- **No Cyprus estimate exists** for the autonomous-capital adoption parameter, the elasticities
  of substitution, or the depreciation of AI/robot capital. These are assumptions with
  sensitivity ranges and must not be confused with the share of firms using AI.
- **Earnings above the ceiling:** CYSTAT bands go to ≥ €6,000/month (6.0% of employees in 2025).
  There is no official wage-bill share above the ceiling. It is estimated two ways (lognormal and
  band-based) and both estimates are reported.

## 4. Tax rules

| Item | Status | Handling |
|---|---|---|
| 2026 income tax bands, 1/5 deduction cap, child/housing/green deductions, family income ceilings | Verified (Tax Department guide 11/05/2026, Form T.D.59A 2026) | Bands and the 1/5 cap are applied automatically. Personal deductions are user inputs, never inferred. |
| First-employment exemptions (20% capped at €8,550; 50% above €55,000) | Amounts official; **eligibility conditions secondary only** (PwC) | Not applied automatically. |
| Notional interest deduction (2026) | **Not found** | Not modelled. Field left `missing`. |
| Corporate tax 15% (from 1/1/2026), SDC on dividends 5% (17% for pre-2026 profits paid by 2031), VAT 19% | Verified | Statutory rates. **Not** used as the model's effective capital-income tax (C6). |
| Employer fund rates (2% / 1.2% / 0.5%) | Official pages not 2026-dated; rates confirmed current by PwC (Aug 2026); caps per the 2026 ceiling notice | Implemented and flagged. |

## 5. Calibration issues to review

- **β = 0.922 when K/Y is targeted** (an implied 8.4% net after-tax return), outside the conventional
  0.95–0.99. Measured Cyprus capital is low relative to its capital share (K/Y = 2.89, s_K = 0.44). Possible causes:
  - a pre-revision capital stock against post-revision flows (the October 2026 revision added large cross-border firms);
  - foreign-owned or mobile capital and profit shifting;
  - land and dwellings.

  An alternative calibration with β fixed at 0.975 gives K/Y = 5.70 (untargeted). Both are reported. **Decision needed.**
- **Investment/output:** the model's no-growth steady state has replacement investment only (12.8% of output, against 24.5% in the data).
- **Effective SI rate depends on the earnings distribution:** 7.92% (bands) vs 8.10% (lognormal), against 8.8% statutory.
