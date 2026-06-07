# Deployment Instructions

This guide provides step-by-step instructions for running the Opportunity Intelligence Platform and launching the interactive web dashboard.

---

## 1. Environment Setup
The platform is built in Python 3.x and requires standard machine learning and data libraries.

### Install Dependencies
Run the following pip command to install the required libraries:
```bash
pip install pandas pyxlsb openpyxl scikit-learn xgboost lightgbm catboost shap
```

---

## 2. Running the Pipeline
The entire forecasting and explainability pipeline is modularized in `src/`. You can execute it as a single script or run the modules sequentially.

### Execute the Complete Pipeline
From the root project folder, execute:
```bash
python -c "import src.preprocess as prep; prep.preprocess_data(); import src.features as feat; feat.build_features(); import src.predict as pred; pred.run_predictions()"
```
This script will:
1. Parse raw Excel `.xlsb` files and resolve date serial numbers.
2. Calculate time-aware features and targets.
3. Train XGBoost ensemble classifiers and regressors.
4. Predict outcomes, durations, slippage, and next stage for open deals.
5. Export CSV files to `output/` and JSON datasets to `web/data/`.

---

## 3. Launching the Web Dashboard
Since the frontend application loads local JSON datasets, browser CORS security policies will block loading if opened directly from a folder (e.g. `file://` protocol). A local HTTP server is required.

### Start local server
From the root directory:
```bash
cd web
python -m http.server 8000
```
Then open your web browser and navigate to:
[http://localhost:8000](http://localhost:8000)

---

## 4. Power BI Desktop Integration
The pipeline generates four CSV files in the `output/` directory that are ready to be imported into Power BI Desktop for further reporting and analysis:

1. **`opportunity_predictions.csv`**: Contains opportunity predictions, probabilities, risk scores, confidence, next stages, and SHAP drivers.
2. **`monthly_forecast.csv`**: Contains aggregated monthly forecast metrics.
3. **`model_performance.csv`**: Contains model calibration and accuracy evaluations.
4. **`stage_movement.csv`**: Contains chronological opportunity stage transitions.

### Import Steps in Power BI:
1. Open Power BI Desktop.
2. Click **Get Data** &rarr; **Text/CSV**.
3. Navigate to `output/` and select `opportunity_predictions.csv`. Click **Load**.
4. Repeat for the other files.
5. In the Model view, link the tables on `Opportunity Number` and `Month` fields.
