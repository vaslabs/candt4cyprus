# Build a Cyprus AI, Automation & Social Insurance Policy Simulator

## Your role

Act as a senior computational economist, Python developer, and public-finance researcher.

I want you to build a rigorous, interactive Python application investigating how artificial intelligence and automation could affect the long-term financing of Cyprus's Social Insurance Fund.

**Primary academic reference:**

Pablo Casas and José L. Torres (2026), *Automation, Taxation, and Social Security Sustainability*, Hacienda Pública Española / Review of Public Economics, 256(1), 69–104.

DOI: https://doi.org/10.7866/HPE-RPE.26.1.3

I am attaching the full 36-page paper. You must read the equations, calibration table, figures, appendix, and conclusions before implementing the model.

The purpose is to examine whether Cyprus can preserve social insurance financing as automation increases, without unnecessarily discouraging innovation, economic growth, or employment.

I also want to test an additional hypothesis:

**Should companies with high economic value added, low labour shares, and substantial profits contribute more to social insurance, regardless of whether their productivity comes from identifiable AI or robots?**

Build a research tool that compares this hypothesis with the three tax mechanisms in the paper.

Do not assume the hypothesis is correct. The application should be capable of showing circumstances in which the proposed policies perform poorly.

---

# PART 1 — Research replication

## 1. Implement the original economic model

Reproduce the two production technologies in Section 3 of Casas and Torres:

**Technology A:**

- Autonomous capital substitutes for human labour.
- Autonomous capital and human labour jointly provide effective labour tasks.
- Traditional capital complements this effective labour input.
- Implement the nested CES production functions in equations (1) and (2).

**Technology B:**

- Autonomous capital substitutes for both traditional capital and human labour.
- Traditional capital and labour form the conventional production process.
- Autonomous capital competes with that combined production technology.
- Implement equations (10) and (11).

Implement the equilibrium conditions for households, firms, capital accumulation, and government taxation from Sections 3.1–3.3 and the steady-state expressions in the appendix.

Use numerical equilibrium solving with scipy.optimize.

The model must solve the endogenous variables described in the paper, including output, consumption, labour, traditional capital, autonomous capital, wages, returns, and investment.

Do not replace the research model with arbitrary linear relationships or percentage multipliers.

Document every equation and parameter with the corresponding paper section and equation number.

## 2. Implement the paper's three automation tax policies

Compare four cases:

A. No specific taxation of autonomous capital.

B. Autonomous-capital income tax.

C. Ad-valorem tax on investment in autonomous capital.

D. Employer-paid social security contribution on autonomous capital.

The policy objective is to maintain social security contributions as a constant proportion of GDP despite automation.

Endogenously solve for the tax rate needed to achieve this target.

Make the target contribution-to-GDP ratio adjustable.

Implement each tax consistently with the relevant production, household, government budget and equilibrium equations.

Important: do not confuse the tax on autonomous-capital income, the investment tax, and the employer contribution. They have different tax bases.

## 3. Replicate the original paper first

Provide a separate "Original Paper" calibration preset.

Use the published calibration values:

| Parameter | Value |
|---|---:|
| Discount factor β | 0.975 |
| Consumption preference γ | 0.40 |
| Traditional capital depreciation δk | 0.06 |
| Autonomous capital depreciation δd | 0.20 |
| Traditional capital share | 0.35 |
| Traditional capital–labour substitution elasticity | 0.90 |
| Autonomous substitution elasticity | 2.0 |
| Consumption tax | 18.32% |
| Labour income tax | 16.46% |
| Employer social security rate | 15.89% |
| Employee social security rate | 9.45% |
| Capital income tax | 24.18% |
| Automation adoption parameter | 0–0.45 |

Reproduce Figures 1–11 where feasible.

In particular, compare calculated results against the following published findings:

- Robot income tax converges to approximately 56% under Technology A and to a lower value, around 48%, at high adoption under Technology B.
- Robot investment tax converges to approximately 38% under Technology A and 23% under Technology B.
- Employer social security tax on autonomous capital converges to approximately 28% under Technology A and 18% under Technology B.
- The financing burden shifts from human labour toward autonomous capital as automation increases.
- Capital and labour contributions become approximately equal around the paper's reported 35% adoption parameter.
- The autonomous-capital social security contribution causes fewer economic distortions than the other two simulated tax schemes.
- None of the three taxes substantially reverses the decline in labour's income share.

These are replication benchmarks, not values to hardcode into model outputs.

Report the numerical replication error for each benchmark. If the results differ, explain why and do not claim successful replication.

Do not confuse the automation adoption parameter with the observed share of Cyprus businesses using AI.

---

# PART 2 — Cyprus calibration

Create a second preset called "Cyprus 2026".

Use the following Cyprus-specific, source-verified parameters and statistics.

## A. Cyprus statutory parameters

| Parameter | Value |
|---|---:|
| Employee Social Insurance | 8.8% |
| Employer Social Insurance | 8.8% |
| Government Social Insurance contribution | 5.2% |
| Annual maximum insurable earnings | €68,904 |
| Monthly maximum insurable earnings | €5,742 |
| Self-employed Social Insurance | 16.6% |
| Employee General Healthcare System | 2.65% |
| Employer General Healthcare System | 2.90% |
| GHS annual income ceiling | €180,000 |
| Employer Social Cohesion Fund | 2.0% |
| Employer Redundancy Fund | 1.2% |
| Employer Human Resource Development Fund | 0.5% |
| Standard corporate income tax | 15.0% |
| Standard VAT | 19.0% |

Income tax brackets for 2026:

- €0–€22,000: 0%
- €22,000–€32,000: 20%
- €32,000–€42,000: 25%
- €42,000–€72,000: 30%
- Above €72,000: 35%

Important accounting rules:

1. Respect the individual earnings ceilings for applicable contributions.
2. Do not apply the annual maximum once to total company payroll; calculate capped insurable earnings at employee or salary-band level.
3. Keep employee, employer and government contributions separate.
4. Do not add the government's 5.2% contribution to the employer's legal payroll cost.
5. Keep the GHS, Social Cohesion, Redundancy and HR Development funds separate from the Social Insurance Fund.
6. Treat the Central Holiday Fund contribution as an optional 8% where applicable.
7. Handle the 2026 personal income tax as a progressive schedule, not a flat rate.
8. Personal income tax is based on taxable income after applicable deductions.
9. Treat corporate income tax as a tax on taxable corporate profits, not a direct tax on capital rental income.
10. Do not equate the 15% Cyprus corporate tax rate with the paper's effective capital-income tax without explicitly modelling the difference.
11. Include the scheduled 2029 and subsequent social insurance rate changes as a configurable policy timeline, clearly separated from the 2026 baseline.
12. Apply the appropriate coverage rules for self-employed income, foreign workers and social insurance exemptions if those modules are implemented.

## B. Cyprus macroeconomic baseline

Latest revised annual figures:

- Nominal GDP, 2025: €38.3141 billion.
- Real GDP growth, 2025: 4.8%.
- General-government social contributions, 2025: €4.8998 billion.
- Employment, Q2 2026: 520,763 people.
- Unemployment rate, Q2 2026: 3.6%.
- Employees within total employment, Q2 2026: 467,712.

Selected 2025 industry value-added figures:

- Information and communication: €4.6379 billion.
- Wholesale and retail trade: €3.9507 billion.
- Financial and insurance activities: €3.1037 billion.
- Professional, scientific and technical activities: €2.5575 billion.
- Accommodation and food services: €2.3214 billion.

Use these as reference inputs for sector analysis, not as estimates of autonomous capital or AI-generated output.

The €4.8998 billion social contributions figure covers the general-government national accounts category. It must NOT be treated as the Social Insurance Fund's actual contribution revenue.

Find the latest separately reported Social Insurance Fund revenue and expenditure figures if possible. If unavailable, leave the relevant calibration fields unpopulated and request input.

Do not manufacture a pension deficit or assume general-government social contributions are exclusively pension contributions.

## C. Additional parameters requiring calibration

The published paper uses assumptions for:

- Capital depreciation
- Capital stocks
- Elasticities of substitution
- Labour preferences
- Technology adoption
- Traditional capital shares
- Economic income distribution

These are not automatically the correct values for Cyprus.

Preserve the paper's assumptions as clearly labelled initial modelling assumptions where appropriate.

For Cyprus, attempt calibration using CYSTAT, Eurostat, OECD, European Commission AMECO, and official Cyprus Social Insurance Fund publications.

If verified values are unavailable, expose parameters as adjustable assumptions and assign uncertainty ranges.

Do not invent Cyprus-specific AI adoption or productivity estimates.

The Cyprus calibration must preserve accounting identities and produce a valid baseline steady state before policy simulations are run.

---

# PART 3 — Additional policy models

Add three extensions to the academic paper.

These are new research hypotheses and must be labelled as such.

## Policy E — Value-added social insurance contribution

Introduce a contribution based on company gross value added.

Allow the user to choose:

- Contribution rate
- Minimum firm size
- Minimum taxable value added
- Sector-specific exemptions
- Whether the contribution supplements or partially replaces payroll contributions

Model the business response to the tax instead of assuming taxable value added is fixed.

Distinguish national-accounts value added from company turnover.

## Policy F — Labour-share-adjusted contribution

Calculate:

Labour share = Employee compensation / Gross value added

Create a contribution system where employers with unusually low labour shares may pay an additional contribution.

The policy should account for:

- Sector benchmarks
- Profitability
- Company size
- Capital intensity
- Employee compensation
- Outsourcing
- International profit shifting
- Potential behavioural responses

Use configurable thresholds.

Do not automatically assume that a low labour share proves a company has replaced employees with AI.

A firm with high sales but low profits should not automatically be treated like a highly profitable automated software business.

Clearly distinguish a stylised policy formula from an empirically validated optimal tax.

## Policy G — Excess economic profit contribution

Investigate a contribution based on economic rents or profits exceeding a benchmark return on invested capital.

Allow adjustments for:

- Normal return on capital
- Capital depreciation
- Eligible investment
- Loss carryforwards
- Deductible expenses
- Effective tax base
- International profit mobility

Compare the resulting revenue and potential investment distortions with Policies D, E and F.

---

# PART 4 — Interactive application

Build the application using:

- Python 3.12+
- Streamlit
- NumPy
- SciPy
- pandas
- Plotly
- Pydantic or dataclasses for parameter validation
- pytest for automated tests

Prioritise a polished, accessible interface suitable for economists, public policymakers, journalists and interested citizens.

The application should have the following pages.

## Page 1 — Cyprus overview

Show:

- Current GDP and employment indicators
- Social insurance contribution rules
- Current financing structure
- Verified statistics versus assumptions
- Cyprus's baseline position
- Source dates and links

## Page 2 — The automation problem

Interactive controls for:

- Autonomous-capital adoption
- Substitution elasticities
- Capital depreciation
- Wage and productivity assumptions
- Labour supply preferences
- GDP growth assumptions

Show the effects on:

- Output
- Human labour input
- Wages
- Traditional capital
- Autonomous capital
- Labour income share
- Social insurance contributions as a percentage of GDP

Distinguish reductions in aggregate working time from unemployment.

## Page 3 — Compare taxation policies

Show the four original cases and the three new extensions.

Controls should include:

- Policy selection
- Rates or endogenous rate solution
- Revenue targets
- Tax bases
- Exemptions
- Behavioural elasticities
- Automation adoption
- Technology A or B

Display:

- Revenue raised
- Contribution-to-GDP ratio
- Change in GDP versus no-tax baseline
- Change in consumption
- Change in investment
- Change in labour input
- Change in labour income share
- Capital accumulation
- Effective tax burden

Use consistent baselines and units.

## Page 4 — Business comparison

Include an illustrative firm-level simulator with editable inputs:

- Revenue
- Gross value added
- Operating profit
- Capital stock
- Number of employees
- Employee salary distribution
- Outsourced labour costs
- AI-related investment
- Depreciation
- Industry classification

Create at least three explicitly hypothetical company archetypes:

1. Labour-intensive hospitality company
2. Financial or professional services company
3. Highly automated software company

Compare their total payroll costs, existing contributions and additional contributions under Policies E, F and G.

Make the effect of Cyprus's €68,904 Social Insurance earnings ceiling visible.

## Page 5 — Scenarios and sensitivity analysis

Allow users to model:

- Low automation
- Medium automation
- High automation
- Automation complements labour
- Automation replaces labour
- High international profit shifting
- Low economic growth

Run simulations with configurable parameter ranges.

Include sensitivity charts and uncertainty bands.

Uncertainty bands must be derived from explicit parameter distributions or scenarios, not arbitrary decorative ranges.

## Page 6 — Policy conclusions

Automatically generate an evidence-based summary containing:

- What the simulations indicate
- Which assumptions drive the results
- Trade-offs between funding and economic activity
- Consequences for labour and capital
- Major uncertainties
- What data would be needed for a more reliable Cyprus estimate

Avoid presenting the results as definitive forecasts.

Allow the user to export this report to Markdown, HTML and PDF.

---

# PART 5 — Visual presentation

Charts must be interactive, informative and professionally styled.

Create at least:

1. Social insurance contributions/GDP versus automation.
2. Required autonomous-capital tax rates across adoption levels.
3. GDP and investment changes across policies.
4. Labour-versus-capital contribution shares.
5. Gross and net labour income shares.
6. Government revenue waterfall comparing different financing sources.
7. Heatmap of revenue under combinations of AI adoption and tax rates.
8. Business-level comparison showing payroll and alternative contribution burdens.
9. Sensitivity chart showing the parameters with the greatest effect on results.

Use euro figures for the Cyprus preset.

Every chart must include:

- Units
- Clear baseline
- Scenario name
- Source or methodology
- Interpretation
- Warnings where parameters are assumed or unverified

Avoid misleading dual axes or charts that visually exaggerate small differences.

Use plain-language descriptions alongside economic terminology.

For example, explain what a simulated 20% robot social insurance contribution actually taxes, and why it is not a 20% tax on revenue.

---

# PART 6 — Model integrity

This is particularly important.

### Distinguish three analytical levels

**Level 1: Paper replication**

Reproduce the actual Casas–Torres equations and findings.

**Level 2: Cyprus-calibrated macroeconomic simulation**

Use verified Cyprus statistics and transparently estimated or assumed structural parameters.

**Level 3: Exploratory company-level policy simulation**

Investigate revenue, value-added, labour-share and excess-profit contributions.

Do not claim that Level 3 is empirically implied by the Casas–Torres model.

If linking the firm-level and macroeconomic models, explicitly implement and test an aggregation or calibration bridge. Otherwise present results separately.

### Prevent double-counting

Separate:

- Payroll contributions
- Government transfers
- Income taxes
- Corporate taxes
- Healthcare contributions
- Other employer funds
- New automation-related contributions

Clearly identify which receipts enter the Social Insurance Fund.

### Preserve the paper's meaning

- The adoption parameter is not a real-world adoption percentage.
- The model uses a representative household.
- It does not explicitly estimate unemployment.
- It assumes competitive firms and zero economic profits in equilibrium.
- Its baseline government revenue is returned through lump-sum transfers.
- It does not directly estimate Cyprus pension liabilities.
- The 18–28% robot social security rates are outputs of the original model, not appropriate automatic rates for Cyprus.
- The results depend on long-run equilibrium assumptions.
- The model does not identify the amount of corporate profit caused by AI.

### Numerical reliability

Implement:

- Solver convergence diagnostics
- Economic feasibility checks
- Non-negative capital and consumption
- Government budget consistency
- Sensitivity to initial guesses
- Explicit reporting of failed solutions
- Tests for the no-automation baseline
- Tests for zero-tax and equal-tax cases
- Regression tests against published figures
- Tests ensuring statutory Cyprus contribution ceilings work correctly

Never silently replace failed equilibrium solutions with interpolated or hardcoded answers.

---

# PART 7 — Data provenance and configuration

Create a central configuration file with every parameter and its metadata:

- Parameter name
- Value
- Units
- Reference year
- Geographical coverage
- Source URL
- Publication date
- Date accessed
- Verification status
- Whether measured, calibrated, assumed or scenario-defined
- Explanation
- Plausible sensitivity range

Provide separate configuration files for:

- Original paper
- Cyprus 2026
- Custom scenarios

All numerical inputs must be editable through the application or configuration files.

Allow users to save, reload and compare scenarios.

Make it impossible for assumed values to be mistaken for official Cyprus statistics.

---

# PART 8 — Implementation and delivery

Create a complete, executable Python project with:

- `app.py`
- `models/paper_model.py`
- `models/cyprus_model.py`
- `models/firm_model.py`
- `models/policies.py`
- `models/calibration.py`
- `data/cyprus_defaults.yaml`
- `data/paper_defaults.yaml`
- `data/sources.csv`
- `utils/charts.py`
- `tests/`
- `requirements.txt`
- `README.md`

You may improve the project structure where necessary.

The README must explain:

1. How to install and run the application.
2. The economic equations.
3. How the original model was replicated.
4. How Cyprus parameters were calibrated.
5. Which inputs remain assumptions.
6. How the new policies differ from the original paper.
7. What the results can and cannot establish.
8. How to update the statistics in future years.

## Required output

Deliver functioning code, not merely pseudocode.

Begin by extracting the paper's equations and describing the mathematical implementation.

Then implement and test the research replication.

Only after establishing the replication should you introduce Cyprus calibration and the additional policies.

Finally, build the interactive dashboard and explain the results.

If a required dataset is missing, do not invent it. Explain the limitation, use a clearly marked assumption where justified, and show its sensitivity.

The project should be suitable for further academic development, policy discussion and independent review.

---

# Sources for Cyprus defaults

Use these initial sources and verify them against the latest official publications when implementing the project.

**Cyprus Statistical Service — October 2026 national accounts revision**

https://www.gov.cy/en/economy-and-finance/annual-national-accounts-revised-data-for-the-years-2022-2024-and-revised-estimate-for-the-year-2025/

**Cyprus Statistical Service — 2025 government financial accounts**

https://www.gov.cy/en/economy-and-finance/excessive-deficit-procedure-and-annual-accounts-of-general-government-2025-2/

**Cyprus Statistical Service — Labour Force Survey Q2 2026**

https://www.gov.cy/en/economy-and-finance/labour-force-survey-lfs-2nd-quarter-2026/

**Cyprus Social Insurance Services — 2026 insurable earnings ceilings**

https://sisweb.mlsi.gov.cy/anotato2025/

**Business in Cyprus — Social insurance**

https://www.businessincyprus.gov.cy/social-insurance-registration-and-contributions/

**Cyprus Tax Department — Personal income tax**

https://www.gov.cy/mof-tax/en/documents/forologiki-dilosi-eisodimatos-atomoy/

**PwC — Cyprus corporate tax**

https://taxsummaries.pwc.com/cyprus/corporate/taxes-on-corporate-income

**Cyprus Fiscal Council — Social Protection in Cyprus (2026)**

https://www.fiscalcouncil.gov.cy/assets/modules/wnp/articles/202611/111/docs/cyprussocialprotectionsystem2026.pdf

**PwC — Tax Facts & Figures 2026**

https://www.pwc.com.cy/en/publications/assets/tff-eng-2026.pdf

All sources and values should be timestamped. Use official data for calibration wherever available, and label missing data honestly.

# Final objective

Build an interactive research application answering this question:

**As AI and automation increase economic output while potentially reducing labour's share of income, which social insurance financing mechanisms could preserve Cyprus's Social Insurance Fund revenues with the smallest economic distortions and the fairest distribution of the financing burden?**

Provide evidence, not predetermined conclusions.
