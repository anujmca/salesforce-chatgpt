# Leakage Analysis Report

Data leakage is the single most critical threat in forecasting models. If future info (e.g., final closed outcomes) is allowed to bleed into historical snapshot training instances, the model will achieve near-perfect training/test metrics but fail completely in production.

## Leakage Prevention Protocol

To build a scientifically sound forecasting simulator, we enforce the following rules:

1. **Temporal Boundary Constraint**: For any snapshot date $S$ used to build training features, we **never** use any snapshot records where the snapshot date is greater than $S$.
2. **Exclude Future Label Attributes**: We completely remove the following columns from the feature matrix before model training:
    - `Stage` (in the closed dataset)
    - `Closed Date` / `Closed Date dt`
    - `Closed Value`
    - `IsClosed`
    - `IsWon`
    - `Close Date Accounting Period`
    - `SF Close FP`
3. **Time-Aware Historical Client Metrics**: When computing aggregated client metrics (e.g. `Historical Client Win Rate`), we compute it dynamically for each snapshot date $S$, using only opportunities that closed *before* date $S$. We never compute a global client win rate over the entire dataset, which would leak future wins of that client into early snapshots.

### Removed Fields & Reasons

| Field Name | Source Dataset | Reason for Removal | Leakage Impact |
| :--- | :--- | :--- | :--- |
| `Closed Date` | Closed Dataset | Contains the exact date the event occurred. Leaks time-to-event. | High |
| `IsClosed` | Closed Dataset | Boolean flag indicating finality. | Critical |
| `IsWon` | Closed Dataset | Direct indicator of the positive target. | Critical |
| `Stage` (Closed) | Closed Dataset | Indicates whether won, lost, or abandoned. | Critical |
| `Closed Value` | Closed Dataset | Represents final booking value. | High |
| `SF Close FP` | Closed Dataset | Leaks the final fiscal period of closure. | High |
