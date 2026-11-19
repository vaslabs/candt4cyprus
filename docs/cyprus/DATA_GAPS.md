# Cyprus data gaps and how they are handled

Access date for all sources: 2026-11-19. Full provenance: `src/data/sources.json` and
`src/data/cyprus2026.json`. In the app, every number links back to these records.

## 1. Social Insurance Fund finances: mostly closed

**Source:** Social Insurance Services statistical bulletins, official archive
https://www.mlsi.gov.cy/mlsi/sid/sidv2.nsf/page21_gr/page21_gr (Greek) and
https://www.mlsi.gov.cy/mlsi/sid/sidv2.nsf/page21_en/page21_en (English).
- 24 editions (January and July, 2020–2026; no July 2025 edition exists), section "Final
  accounts of the Social Insurance Fund" (€000).
- Extracted reproducibly by `npm run data:sis` (tools/sis/extract_bulletins.py, antiword,
  SHA-256 verified against `tools/sis/manifest.json`) into `src/data/sifAccountsEditions.json`,
  which keeps the full revision history.
- The 11 copies first supplied by the project owner are byte-identical to the official Greek files.
- Greek and English editions agree except one €1k rounding cell.
- The original Word files are not committed (redistribution terms not established).

**Integrity checks (all passed):**
- income, expenditure and reserve identities in all 11 editions, within ±€1k rounding;
- reserve continuity 2016–2025;
- 2020 reproduces the independent ILO actuarial valuation exactly: contributions incl. the state share €1,738.1m, expenditure €1,636.8m, reserve €8,066.7m;
- the 2024 state contribution matches the Treasury's cash figure (€633.1m vs €633.5m);
- revisions between editions are minor (2022 income +€0.2m after being marked final; 2024 refined from preliminary).

| Fund, € million | 2021 | 2022 | 2023 | 2024 | 2025 (prelim.) |
|---|---:|---:|---:|---:|---:|
| Contributions excl. state | 1,456.0 | 1,643.2 | 1,861.0 | 2,136.7 | 2,324.6 |
| State contribution | 431.5 | 486.6 | 551.7 | 633.1 | 689.3 |
| Interest | 0.9 | 47.5 | 327.8 | 393.4 | 256.2 |
| Total expenditure | 1,694.9 | 1,855.4 | 1,940.1 | 2,074.8 | 2,243.3 |
| Balance | 227.2 | 359.6 | 844.1 | 1,135.0 | 1,077.0 |
| Reserve, end of year | 8,293.9 | 8,653.5 | 9,497.6 | 10,632.6 | 11,709.6 |

**Still missing or limited:**
- Employee vs employer split *within* each employee category (the accounts combine them).
- Pensions by type (old-age / survivors / invalidity) in euros.
- **State's accumulated obligation to the Fund:** sources still conflict (€10.6bn–€13.9bn). The
  Fund's accounting reserve (€11.71bn end-2025) is a different concept and is recorded separately.
  Hypothetical scenarios only.
- **Correction of an earlier secondary figure:** the press "Fund balance" figures (546 / 1,174 / 1,421
  for 2022–24) are Eurostat S1314 net lending (the social security funds subsector, which also
  includes the HIO/GHS), not the Fund's own balance (360 / 844 / 1,135).

**General-government social contributions (€4,899.8m in 2025) are never used as Fund revenue.**

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

  **Decision (step 5 review):** the primary calibration uses β = 0.975 as a structural assumption
  (K/Y not matched: 5.70 in the model vs 2.89 observed). β = 0.922 is kept as the K/Y-matching
  alternative. Neither is an established Cyprus discount factor.
- **Investment/output:** the model's no-growth steady state has replacement investment only (12.8% of output, against 24.5% in the data).
- **Effective SI rate:** the default is now top-down. It reproduces the Fund's actual 2023
  contributions (τ = 0.0610 per side). Statutory bottom-up gives 0.0792 and overstates revenue by
  ≈27%, because the model wage bill includes non-Fund employer contributions and imputed
  self-employed income. **Decision (step 5 review):** the macro model uses the calibrated 0.0610
  (a model coefficient, not a statutory rate). The payroll engine keeps the statutory 8.8%.
