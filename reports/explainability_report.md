# Explainability Report

This report outlines the global and local explainability frameworks for the Opportunity Intelligence Platform.

## 1. Global Explainability
Our primary classification models utilize **XGBoost** and **LightGBM**, which are tree-based ensemble models. We evaluate global feature importance using two methodologies:

### Feature Importance (Gini Importance)
Gini Importance measures the cumulative reduction in split criterion (like Gini impurity or log loss) brought by a feature across all trees in the ensemble.
- **Client Win Rate (`client_win_rate`)**: Represents the single strongest driver. If a client historically closes deals successfully, future opportunities with that client are highly likely to close successfully.
- **Weighted Value (`Weighted_Amount`)**: Reflects the current size and value of the deal. Larger, well-qualified deals generally progress more reliably.
- **Number of Slippages (`Num_Slippages`)**: Pushing forecast dates out repeatedly is a very strong indicator of deal risk and stagnation.

### SHAP (SHapley Additive exPlanations) Global Summary
SHAP values are based on cooperative game theory. They calculate the marginal contribution of each feature to the model's prediction across all possible feature combinations.
- Features like `client_win_rate` and `Weighted_Amount` have positive SHAP values, shifting the output probability closer to a "Won" outcome.
- Features like `Days_In_Current_Stage` and `Num_Slippages` have negative SHAP values, shifting the outcome probability toward "Lost" or "Abandoned".

---

## 2. Local Explainability
For every currently open opportunity scored by the system, we generate local explanations to help account executives understand *why* the model predicted a certain win probability and what action to take.

### Top Positive Drivers
Factors that increased the win probability above the baseline average:
- **Fast Stage Progression**: A deal moving rapidly through the pipeline.
- **Strong Historical Client Win Rate**: Prior success with the same customer.
- **Increasing Deal Value**: Net amount expanding in subsequent snapshots.

### Top Negative Drivers
Factors that dragged the win probability down:
- **Stuck in Stage**: Deal aging in the current stage longer than the typical progression window.
- **Multiple Forecast Slippages**: Changing the expected start date more than twice.
- **Declining Deal Value**: Value reduction over time.

---

## 3. Executive Actionability
By integrating local SHAP drivers directly into the Deal Intelligence Grid, sales managers can hover over high-risk deals and instantly view the root causes, allowing them to:
1. Re-engage clients on deals stuck in "Develop Proposal" for over 60 days.
2. Intervene when deal values drop or forecast dates slip repeatedly.
3. Align resources to support high-value opportunities with high win rates.
