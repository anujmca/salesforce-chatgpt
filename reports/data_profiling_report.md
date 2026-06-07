# Data Profiling Report

This report provides a statistical profiling of the Opportunity Intelligence Platform's source datasets: Open Pipeline Snapshots, Closed Pipeline Data, and currently active pipeline data.

## Open Pipeline Snapshots (Historical)
- **Total Rows**: 742,232
- **Unique Opportunities**: 138,757
- **Month Date Range**: 2022-06-04 to 2026-05-08

### Column Summary
| Column                    | Type           |   Missing Count | Missing %   |   Unique Values | Samples                                                                                                                                 |
|:--------------------------|:---------------|----------------:|:------------|----------------:|:----------------------------------------------------------------------------------------------------------------------------------------|
| Month Date                | str            |               0 | 0.00%       |              48 | Friday, April 10, 2026, Friday, April 5, 2024, Friday, August 1, 2025                                                                   |
| Expected_Start_Date__c    | str            |               0 | 0.00%       |            2264 | Friday, July 31, 2026, Tuesday, June 30, 2026, Wednesday, July 29, 2026                                                                 |
| Stage                     | str            |               0 | 0.00%       |               4 | 1. Identify Opp, 2. Qualify Opp, 4. Issue Proposal                                                                                      |
| Region                    | str            |               0 | 0.00%       |              16 | Digital Services, North America, Europe Middle East & Africa                                                                            |
| Business Unit             | str            |              83 | 0.01%       |              73 | Digital Services Core, Great Lakes & Northeast, North America Commercial Team                                                           |
| Country/Entity            | str            |             468 | 0.06%       |             173 | Digital Services Core, Northeast, Great Lakes West                                                                                      |
| Service Group             | str            |               0 | 0.00%       |              11 | Safe & Sustainable Operations, Capital Project Delivery, Mergers & Acquisitions                                                         |
| Sub-Service               | str            |              43 | 0.01%       |             137 | Management Systems & Compliance, Data Mgmt, Visualization, Analytics, Engineering for Capital Projects                                  |
| Partner                   | str            |              17 | 0.00%       |            1956 | Hector Garces, Mark Clark, Lyndsey Colburn                                                                                              |
| Opportunity Number        | int64          |               0 | 0.00%       |          138757 | 756721, 806376, 763628                                                                                                                  |
| Core Industry             | str            |               0 | 0.00%       |              14 | Power, Technology, Chemical                                                                                                             |
| Detail Industry           | str            |             140 | 0.02%       |              92 | Utilities, Data Centers & Network Infrastructure, Energy Storage                                                                        |
| Weighted Net Amount       | float64        |               0 | 0.00%       |           52569 | 5000.0, 12500.0, 10000.0                                                                                                                |
| Un-Wtd Net Amount         | float64        |               0 | 0.00%       |           41648 | 50000.0, 100000.0, 150000.0                                                                                                             |
| Comp/SS                   | str            |             252 | 0.03%       |               2 | Sole Source, Competitive                                                                                                                |
| Client Type (New)         | str            |             100 | 0.01%       |               5 | RKC, GKC, Other                                                                                                                         |
| Client                    | str            |             252 | 0.03%       |           15086 | Edison International, Vantage Data Centers LLC, RWE                                                                                     |
| R2L                       | str            |          718987 | 96.87%      |               2 | Refuse 2 Lose, High Priority                                                                                                            |
| SF Program                | str            |          446387 | 60.14%      |            2093 | CEBU CHEM POD -  Liabilities, Asset Rationalisation & CAPEX, Climate Markets FY26, Minning and Metals Decarbonization GTM Campaign 2024 |
| Client Journey/GI         | str            |          359507 | 48.44%      |               5 | Energy Security and Cost Optimisation, Capital Investment/MCP, Value-driven Strategy & Disclosure                                       |
| Expected FP               | float64        |             279 | 0.04%       |              95 | 202704.0, 202703.0, 202702.0                                                                                                            |
| Expected FY               | float64        |             279 | 0.04%       |               8 | 2027.0, 2028.0, 2026.0                                                                                                                  |
| CreatedDate               | int64          |               0 | 0.00%       |              52 | 46123, 45388, 45871                                                                                                                     |
| Created FP                | int64          |               0 | 0.00%       |              46 | 202701, 202501, 202605                                                                                                                  |
| POD Name                  | str            |          641168 | 86.38%      |              39 | NA Data Centers, EMEA PE, EMEA ME                                                                                                       |
| As of FP                  | int64          |               0 | 0.00%       |              48 | 202612, 202412, 202604                                                                                                                  |
| As of FY                  | int64          |               0 | 0.00%       |               5 | 2026, 2024, 2025                                                                                                                        |
| POD Region                | str            |          641168 | 86.38%      |               5 | North America, Europe, Middle East, & Africa, LAC                                                                                       |
| Client Industry           | str            |          176055 | 23.72%      |              11 | Power, Technology, Chemical                                                                                                             |
| Partnership               | str            |          698746 | 94.14%      |             136 | Sphera, Ceezer, Cority                                                                                                                  |
| Primary_Campaign__c       | str            |          676800 | 91.18%      |            1314 | Sphera_Summit_EMEA 2024, FY26_SLC_TECH_Energy GTM, FY26_MKTC_RE_NA_ACP Siting & Permitting Conference 2025                              |
| Month Date dt             | datetime64[us] |               0 | 0.00%       |              48 | 2026-04-10 00:00:00, 2024-04-05 00:00:00, 2025-08-01 00:00:00                                                                           |
| Expected_Start_Date__c_dt | datetime64[us] |               0 | 0.00%       |            2264 | 2026-07-31 00:00:00, 2026-06-30 00:00:00, 2026-07-29 00:00:00                                                                           |
| CreatedDate_dt            | datetime64[s]  |               0 | 0.00%       |              52 | 2026-04-11 00:00:00, 2024-04-06 00:00:00, 2025-08-02 00:00:00                                                                           |

## Closed Pipeline Data (Final Outcomes)
- **Total Rows**: 172,853
- **Unique Opportunities**: 172,853
- **Created Date Range**: 2011-05-09 to 2026-06-02
- **Closed Date Range**: 2014-07-07 to 2026-06-02

### Column Summary
| Column                       | Type          |   Missing Count | Missing %   |   Unique Values | Samples                                                                                                       |
|:-----------------------------|:--------------|----------------:|:------------|----------------:|:--------------------------------------------------------------------------------------------------------------|
| Closed Date                  | int64         |               0 | 0.00%       |            1808 | 45591, 45573, 45621                                                                                           |
| Created Date                 | int64         |               0 | 0.00%       |            2700 | 45554, 45553, 45552                                                                                           |
| Project / Title              | str           |               1 | 0.00%       |          165975 | Island Barge Development, Modern Slavery Impact and Success, Seymour Whyte - ACT - Commonwealth Avenue Bridge |
| Stage                        | str           |               0 | 0.00%       |               3 | 7. Abandoned, 6. Lost, 5. Won                                                                                 |
| Service Group                | str           |               0 | 0.00%       |               6 | Capital Project Delivery, Safe & Sustainable Operations, Site Investigation & Remediation                     |
| Sub-Service                  | str           |               0 | 0.00%       |              62 | Impact Assessment, Capital Proj Human Rights, Technical & Functional Safety                                   |
| Opportunity Number           | int64         |               0 | 0.00%       |          172853 | 748675, 748485, 748481                                                                                        |
| Country/Entity               | str           |             123 | 0.07%       |             149 | Mid-South, Australia, UK                                                                                      |
| Business Unit                | str           |              16 | 0.01%       |              54 | Atlantic Central, Australia & New Zealand, Northern Europe                                                    |
| Region                       | str           |               0 | 0.00%       |              13 | North America, ANZ, Europe Middle East & Africa                                                               |
| Client Type                  | str           |               0 | 0.00%       |               5 | Client, Global Key Client, Regional Key Client                                                                |
| Sole Source / Competitive    | str           |           11910 | 6.89%       |               2 | Sole Source, Competitive                                                                                      |
| Core Industry                | str           |               0 | 0.00%       |              11 | Finance, Pharmaceuticals & Healthcare, Diversified Energy                                                     |
| Detail Industry              | str           |               0 | 0.00%       |              66 | Private Equity, Infrastructure, Medical Devices                                                               |
| Closed Value                 | int64         |               0 | 0.00%       |           40766 | 50000, 26144, 32680                                                                                           |
| IsClosed                     | bool          |               0 | 0.00%       |               1 | True                                                                                                          |
| IsWon                        | bool          |               0 | 0.00%       |               2 | False, True                                                                                                   |
| Created FP                   | float64       |           12632 | 7.31%       |              49 | 202506.0, 202505.0, 202504.0                                                                                  |
| Close Date Accounting Period | float64       |           75677 | 43.78%      |              36 | 202507.0, 202506.0, 202508.0                                                                                  |
| Client                       | str           |               0 | 0.00%       |           16906 | Island Barge Company, LLC, Property Council Australia, Seymour Whyte Constructions                            |
| Pricing Structure            | str           |           69484 | 40.20%      |               7 | Lump Sum, Time and Materials, Unit Price                                                                      |
| Standalone vs. CO            | str           |               0 | 0.00%       |               2 | Standalone, Change Order                                                                                      |
| SF Close FP                  | float64       |            1288 | 0.75%       |              49 | 202507.0, 202508.0, 202509.0                                                                                  |
| SS/Comp                      | str           |               0 | 0.00%       |               2 | Sole Source, Competitive                                                                                      |
| Closed Date dt               | datetime64[s] |               0 | 0.00%       |            1808 | 2024-10-26 00:00:00, 2024-10-08 00:00:00, 2024-11-25 00:00:00                                                 |
| Created Date dt              | datetime64[s] |               0 | 0.00%       |            2700 | 2024-09-19 00:00:00, 2024-09-18 00:00:00, 2024-09-17 00:00:00                                                 |
| Outcome                      | str           |               0 | 0.00%       |               3 | Abandoned, Lost, Won                                                                                          |

## Active Pipeline Data (Prediction Target Set)
- **Total Rows**: 108,062
- **Unique Opportunities**: 33,234
- **Snapshot Month Dates**: 2025-11-28, 2026-01-05, 2026-01-30, 2026-02-27, 2026-04-10, 2026-05-08
