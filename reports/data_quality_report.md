# Data Quality Report

This report assesses data cleanliness, missing values, cardinality, potential anomalies, and integrity constraints.

## Missing Value Analysis
### Snapshot Missing Values (Threshold > 5%)
| Column              | Type    |   Missing Count | Missing %   |   Unique Values | Samples                                                                                                                                 |
|:--------------------|:--------|----------------:|:------------|----------------:|:----------------------------------------------------------------------------------------------------------------------------------------|
| Business Unit       | str     |              83 | 0.01%       |              73 | Digital Services Core, Great Lakes & Northeast, North America Commercial Team                                                           |
| Country/Entity      | str     |             468 | 0.06%       |             173 | Digital Services Core, Northeast, Great Lakes West                                                                                      |
| Sub-Service         | str     |              43 | 0.01%       |             137 | Management Systems & Compliance, Data Mgmt, Visualization, Analytics, Engineering for Capital Projects                                  |
| Partner             | str     |              17 | 0.00%       |            1956 | Hector Garces, Mark Clark, Lyndsey Colburn                                                                                              |
| Detail Industry     | str     |             140 | 0.02%       |              92 | Utilities, Data Centers & Network Infrastructure, Energy Storage                                                                        |
| Comp/SS             | str     |             252 | 0.03%       |               2 | Sole Source, Competitive                                                                                                                |
| Client Type (New)   | str     |             100 | 0.01%       |               5 | RKC, GKC, Other                                                                                                                         |
| Client              | str     |             252 | 0.03%       |           15086 | Edison International, Vantage Data Centers LLC, RWE                                                                                     |
| R2L                 | str     |          718987 | 96.87%      |               2 | Refuse 2 Lose, High Priority                                                                                                            |
| SF Program          | str     |          446387 | 60.14%      |            2093 | CEBU CHEM POD -  Liabilities, Asset Rationalisation & CAPEX, Climate Markets FY26, Minning and Metals Decarbonization GTM Campaign 2024 |
| Client Journey/GI   | str     |          359507 | 48.44%      |               5 | Energy Security and Cost Optimisation, Capital Investment/MCP, Value-driven Strategy & Disclosure                                       |
| Expected FP         | float64 |             279 | 0.04%       |              95 | 202704.0, 202703.0, 202702.0                                                                                                            |
| Expected FY         | float64 |             279 | 0.04%       |               8 | 2027.0, 2028.0, 2026.0                                                                                                                  |
| POD Name            | str     |          641168 | 86.38%      |              39 | NA Data Centers, EMEA PE, EMEA ME                                                                                                       |
| POD Region          | str     |          641168 | 86.38%      |               5 | North America, Europe, Middle East, & Africa, LAC                                                                                       |
| Client Industry     | str     |          176055 | 23.72%      |              11 | Power, Technology, Chemical                                                                                                             |
| Partnership         | str     |          698746 | 94.14%      |             136 | Sphera, Ceezer, Cority                                                                                                                  |
| Primary_Campaign__c | str     |          676800 | 91.18%      |            1314 | Sphera_Summit_EMEA 2024, FY26_SLC_TECH_Energy GTM, FY26_MKTC_RE_NA_ACP Siting & Permitting Conference 2025                              |

### Closed Missing Values (Threshold > 5%)
| Column                       | Type    |   Missing Count | Missing %   |   Unique Values | Samples                                                                                                       |
|:-----------------------------|:--------|----------------:|:------------|----------------:|:--------------------------------------------------------------------------------------------------------------|
| Project / Title              | str     |               1 | 0.00%       |          165975 | Island Barge Development, Modern Slavery Impact and Success, Seymour Whyte - ACT - Commonwealth Avenue Bridge |
| Country/Entity               | str     |             123 | 0.07%       |             149 | Mid-South, Australia, UK                                                                                      |
| Business Unit                | str     |              16 | 0.01%       |              54 | Atlantic Central, Australia & New Zealand, Northern Europe                                                    |
| Sole Source / Competitive    | str     |           11910 | 6.89%       |               2 | Sole Source, Competitive                                                                                      |
| Created FP                   | float64 |           12632 | 7.31%       |              49 | 202506.0, 202505.0, 202504.0                                                                                  |
| Close Date Accounting Period | float64 |           75677 | 43.78%      |              36 | 202507.0, 202506.0, 202508.0                                                                                  |
| Pricing Structure            | str     |           69484 | 40.20%      |               7 | Lump Sum, Time and Materials, Unit Price                                                                      |
| SF Close FP                  | float64 |            1288 | 0.75%       |              49 | 202507.0, 202508.0, 202509.0                                                                                  |

## Key Quality Findings & Anomalies
1. **Missing expected dates**: A small subset of snapshots and closed records have missing or invalid date fields. These will be handled during feature engineering by forward-filling or defaulting to creation dates plus average duration.
2. **Amount trends**: Un-weighted and weighted net amounts sometimes show large jumps (e.g. going from $5k to $500k). We have engineered trend features (Amount Growth Trend / Amount Decline Trend) to capture these behaviors as predictive signals.
3. **High cardinality categorical columns**: Columns such as `POD Name`, `Primary_Campaign__c`, and `Client` have high cardinality. We will apply frequency encoding and group low-frequency values into an "Other" category to improve model generalization.
