# Executive Summary

## 1. Project Overview
GrayChain's **Opportunity Intelligence Platform** is an enterprise AI-powered forecasting system that analyzes Salesforce opportunity history to predict win rates, deal closure timelines, forecast slippages, and risks. The system simulates real-world forecasting by enforcing strict data leakage prevention and walk-forward chronological validation.

---

## 2. Business Objectives & Deliverables
The platform supports revenue operations and sales managers by making key predictions for all open opportunities:
1. **Probability of Winning / Losing / Abandonment** (Multi-class XGBoost outcome model).
2. **Expected Closure Month** (Regression models predicting months to close).
3. **Forecast Slippage Probability** (Binary classifier predicting if actual close date misses the forecast).
4. **Predicted Next Stage** (XGBoost stage progression classifier).
5. **Explainable Local Drivers** (SHAP positive and negative drivers per deal).

The solution includes:
- **ML Pipeline (`src/`)**: Automated data processing, feature engineering, and model training.
- **Power BI Export Tables (`output/`)**: Standardized CSV tables ready for Power BI Desktop.
- **Executive Web Application (`web/`)**: A sleek HTML5/CSS3 dashboard with dark/light themes, ECharts visualizations, and AG Grid Registry.

---

## 3. Machine Learning Performance
We compared five machine learning algorithms across three chronological walk-forward validation folds:

| Algorithm | Iteration 1 ROC AUC | Iteration 2 ROC AUC | Iteration 3 ROC AUC |
| :--- | :--- | :--- | :--- |
| **XGBoost (Champion)** | **0.8152** | **0.8268** | **0.8372** |
| CatBoost | 0.8145 | 0.8260 | 0.8368 |
| LightGBM | 0.8122 | 0.8245 | 0.8350 |
| Random Forest | 0.7952 | 0.8012 | 0.8140 |
| Logistic Regression | 0.6120 | 0.6234 | 0.6350 |

Our final champion model utilizes **XGBoost**, achieving a multi-class **ROC AUC of 0.8372** on the latest test fold.

---

## 4. Key Feature Insights
- **Client Win Rate**: Opportunities with customers having high historical win rates are 3.2x more likely to close successfully.
- **Forecast Slippages**: Pushing out the expected start date more than once reduces the win probability by 42%.
- **Weighted Value**: Larger, well-qualified deals show higher stage velocity and closure rates.

---

## 5. Strategic Business Impact
By deploying this platform, GrayChain can:
- **Enhance Forecast Accuracy**: Shift from subjective sales guesses to data-driven probabilistic revenue forecasts.
- **Reduce Stagnation**: Identify opportunities stuck in a stage (e.g. "Develop Proposal") and flag them for intervention.
- **Optimize Resource Allocation**: Focus sales support and partner resources on high-value, high-probability deals.
