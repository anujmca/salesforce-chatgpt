import pandas as pd
import numpy as np
import os
import pickle
import json
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute import SimpleImputer
import xgboost as xgb
import lightgbm as lgb
import catboost as cb
import shap

# Define optimized features list
CAT_COLS = [
    'Stage', 'Region', 'Business Unit', 'Country/Entity', 
    'Service Group', 'Sub-Service', 'Core Industry', 'Detail Industry', 
    'Partner', 'Comp/SS', 'Client Type (New)',
    'BU_Industry_Cross', 'Region_Industry_Cross'
]

NUM_COLS = [
    'Num_Appearances', 'Opp_Age_Days', 'Num_Stage_Changes', 'Stage_Velocity', 
    'Days_In_Current_Stage', 'Weighted_Amount', 'Unweighted_Amount', 
    'Amount_Growth_Trend', 'Amount_Decline_Trend', 'Num_Slippages', 
    'client_win_rate', 'client_loss_rate', 'client_avg_size',
    'client_win_rate_3m', 'client_total_deals_3m',
    'client_win_rate_6m', 'client_total_deals_6m',
    'is_quarter_end', 'is_fy_end', 'days_in_stage_ratio', 'is_stage_stagnant'
]

ALL_FEATURES = CAT_COLS + NUM_COLS

FEATURE_NAMES_MAP = {
    'Num_Appearances': 'High Snapshot Appearances',
    'Opp_Age_Days': 'Long Deal Age',
    'Num_Stage_Changes': 'Frequent Stage Transitions',
    'Stage_Velocity': 'Fast Stage Progression',
    'Days_In_Current_Stage': 'Stuck in Stage',
    'Weighted_Amount': 'Large Weighted Value',
    'Unweighted_Amount': 'Large Unweighted Value',
    'Amount_Growth_Trend': 'Increasing Deal Value',
    'Amount_Decline_Trend': 'Declining Deal Value',
    'Num_Slippages': 'Multiple Forecast Slippages',
    'client_win_rate': 'Strong Historical Client Win Rate',
    'client_loss_rate': 'Poor Historical Client Win Rate',
    'client_avg_size': 'Large Historical Client Deal Size',
    'client_win_rate_3m': 'Recent Client Win Rate (3M)',
    'client_total_deals_3m': 'Recent Client Volume (3M)',
    'client_win_rate_6m': 'Recent Client Win Rate (6M)',
    'client_total_deals_6m': 'Recent Client Volume (6M)',
    'is_quarter_end': 'Quarter-End Closing Period',
    'is_fy_end': 'Fiscal Year-End Period',
    'days_in_stage_ratio': 'Stall Stage Duration Ratio',
    'is_stage_stagnant': 'Stagnated Stage Progress',
    'Stage': 'Current stage position',
    'Region': 'Geographic Region',
    'Business Unit': 'Business Unit Group',
    'Country/Entity': 'Country Entity Location',
    'Service Group': 'Service Group Department',
    'Sub-Service': 'Sub-Service Offering',
    'Core Industry': 'Core Client Industry',
    'Detail Industry': 'Specific Industry Segment',
    'Partner': 'Assigned Partner Influence',
    'Comp/SS': 'Competitive Bid Status',
    'Client Type (New)': 'Client Relationship Status',
    'BU_Industry_Cross': 'BU Core Industry segment',
    'Region_Industry_Cross': 'Region Core Industry segment'
}

def clean_and_impute(df, imputer=None, encoder=None):
    df = df.copy()
    if imputer is None:
        imputer = SimpleImputer(strategy='median')
        df[NUM_COLS] = imputer.fit_transform(df[NUM_COLS])
    else:
        df[NUM_COLS] = imputer.transform(df[NUM_COLS])
        
    if encoder is None:
        encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
        df[CAT_COLS] = encoder.fit_transform(df[CAT_COLS].astype(str))
    else:
        df[CAT_COLS] = encoder.transform(df[CAT_COLS].astype(str))
        
    return df, imputer, encoder

def train_gated_model(clf_class, clf_params, X_train, y_train, early_codes):
    is_early = X_train['Stage'].isin(early_codes)
    
    clf_early = clf_class(**clf_params)
    clf_late = clf_class(**clf_params)
    
    if is_early.sum() > 0:
        clf_early.fit(X_train[is_early], y_train[is_early])
    else:
        clf_early.fit(X_train, y_train)
        
    if (~is_early).sum() > 0:
        clf_late.fit(X_train[~is_early], y_train[~is_early])
    else:
        clf_late.fit(X_train, y_train)
        
    return clf_early, clf_late

def predict_ensemble_gated(xgb_early, xgb_late, lgb_early, lgb_late, cb_early, cb_late, X_test, is_early, threshold=0.45):
    # Get probabilities from XGBoost
    xgb_probs = np.zeros((len(X_test), 3))
    if is_early.sum() > 0:
        xgb_probs[is_early] = xgb_early.predict_proba(X_test[is_early])
    if (~is_early).sum() > 0:
        xgb_probs[~is_early] = xgb_late.predict_proba(X_test[~is_early])
        
    # Get probabilities from LightGBM
    lgb_probs = np.zeros((len(X_test), 3))
    if is_early.sum() > 0:
        lgb_probs[is_early] = lgb_early.predict_proba(X_test[is_early])
    if (~is_early).sum() > 0:
        lgb_probs[~is_early] = lgb_late.predict_proba(X_test[~is_early])
        
    # Get probabilities from CatBoost
    cb_probs = np.zeros((len(X_test), 3))
    if is_early.sum() > 0:
        cb_probs[is_early] = cb_early.predict_proba(X_test[is_early])
    if (~is_early).sum() > 0:
        cb_probs[~is_early] = cb_late.predict_proba(X_test[~is_early])
        
    # Ensemble average
    probs = (xgb_probs + lgb_probs + cb_probs) / 3.0
    
    preds = np.zeros(len(X_test), dtype=int)
    for idx in range(len(X_test)):
        if probs[idx, 0] >= threshold:
            preds[idx] = 0
        else:
            preds[idx] = 1 if probs[idx, 1] >= probs[idx, 2] else 2
            
    return preds, probs

def main():
    print("Loading optimized features dataset...")
    df = pd.read_pickle("processed_data/opt_features_df.pkl")
    active_df = pd.read_pickle("processed_data/opt_active_features_df.pkl")
    
    with open("processed_data/closed_mapping.pkl", "rb") as f:
        closed_mapping = pickle.load(f)
        
    # Prepare trainable
    trainable_df = df[df['Target_Outcome'] != 'Open'].copy()
    print(f"Historical trainable snapshot rows: {len(trainable_df)}")
    
    trainable_df, imputer, encoder = clean_and_impute(trainable_df)
    active_df_proc, _, _ = clean_and_impute(active_df, imputer, encoder)
    
    X_train = trainable_df[ALL_FEATURES]
    X_active = active_df_proc[ALL_FEATURES]
    y_train_outcome = trainable_df['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
    
    stage_list = list(encoder.categories_[0])
    early_codes = [stage_list.index(s) for s in ['1. Identify Opp', '2. Qualify Opp'] if s in stage_list]
    is_early_active = X_active['Stage'].isin(early_codes)
    
    # Train Gated XGBoost (depth=7, lr=0.1)
    print("Training Gated XGBoost...")
    xgb_early, xgb_late = train_gated_model(
        xgb.XGBClassifier, {"n_estimators": 100, "max_depth": 7, "learning_rate": 0.1, "random_state": 42, "n_jobs": -1, "eval_metric": "mlogloss"},
        X_train, y_train_outcome, early_codes
    )
    
    # Train Gated LightGBM (depth=8, lr=0.1)
    print("Training Gated LightGBM...")
    lgb_early, lgb_late = train_gated_model(
        lgb.LGBMClassifier, {"n_estimators": 120, "max_depth": 8, "learning_rate": 0.1, "random_state": 42, "n_jobs": -1, "verbose": -1},
        X_train, y_train_outcome, early_codes
    )
    
    # Train Gated CatBoost (depth=7, lr=0.1)
    print("Training Gated CatBoost...")
    cb_early, cb_late = train_gated_model(
        cb.CatBoostClassifier, {"iterations": 100, "depth": 7, "learning_rate": 0.1, "random_state": 42, "verbose": 0, "thread_count": -1},
        X_train, y_train_outcome, early_codes
    )
    
    # Train months to close regressors
    print("Training closure month regressors...")
    win_idx = trainable_df['Target_Outcome'] == 'Won'
    reg_win = xgb.XGBRegressor(n_estimators=80, max_depth=5, learning_rate=0.1, random_state=42, n_jobs=-1)
    reg_win.fit(X_train[win_idx], trainable_df.loc[win_idx, 'Months_Until_Win'])
    
    loss_idx = trainable_df['Target_Outcome'] == 'Lost'
    reg_loss = xgb.XGBRegressor(n_estimators=80, max_depth=5, learning_rate=0.1, random_state=42, n_jobs=-1)
    reg_loss.fit(X_train[loss_idx], trainable_df.loc[loss_idx, 'Months_Until_Loss'])
    
    abandon_idx = trainable_df['Target_Outcome'] == 'Abandoned'
    reg_abandon = xgb.XGBRegressor(n_estimators=80, max_depth=5, learning_rate=0.1, random_state=42, n_jobs=-1)
    reg_abandon.fit(X_train[abandon_idx], trainable_df.loc[abandon_idx, 'Months_Until_Abandon'])
    
    # Train Risk Classifier
    print("Training risk classifier...")
    y_train_risk = (trainable_df['Target_Outcome'] != 'Won').astype(int).values
    clf_risk = lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    clf_risk.fit(X_train, y_train_risk)
    
    # Train Slippage Classifier
    print("Training slippage classifier...")
    y_train_slipped = trainable_df['Target_Slipped'].values
    clf_slippage = lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    clf_slippage.fit(X_train, y_train_slipped)
    
    # Train Next Stage Classifier
    print("Training next stage classifier...")
    next_stage_map = {stage: i for i, stage in enumerate(trainable_df['Target_Next_Stage'].unique())}
    next_stage_inv_map = {i: stage for stage, i in next_stage_map.items()}
    y_train_next_stage = trainable_df['Target_Next_Stage'].map(next_stage_map).fillna(0).astype(int).values
    clf_next_stage = lgb.LGBMClassifier(n_estimators=100, max_depth=6, learning_rate=0.1, random_state=42, n_jobs=-1, verbose=-1)
    clf_next_stage.fit(X_train, y_train_next_stage)
    
    # Save optimized model state
    models_state = {
        "xgb_early": xgb_early, "xgb_late": xgb_late,
        "lgb_early": lgb_early, "lgb_late": lgb_late,
        "cb_early": cb_early, "cb_late": cb_late,
        "reg_win": reg_win, "reg_loss": reg_loss, "reg_abandon": reg_abandon,
        "clf_risk": clf_risk, "clf_slippage": clf_slippage, "clf_next_stage": clf_next_stage,
        "next_stage_inv_map": next_stage_inv_map, "imputer": imputer, "encoder": encoder,
        "early_codes": early_codes
    }
    
    with open("processed_data/opt_models.pkl", "wb") as f:
        pickle.dump(models_state, f)
    print("Optimized models saved successfully!")
    
    # Inference on Active deals
    print("Predicting on active deals...")
    preds_outcome, probs_outcome = predict_ensemble_gated(
        xgb_early, xgb_late, lgb_early, lgb_late, cb_early, cb_late,
        X_active, is_early_active, threshold=0.45
    )
    pred_outcome_label = pd.Series(preds_outcome).map({0: 'Won', 1: 'Lost', 2: 'Abandoned'}).values
    
    pred_months_win = reg_win.predict(X_active).clip(0, 24)
    pred_months_loss = reg_loss.predict(X_active).clip(0, 24)
    pred_months_abandon = reg_abandon.predict(X_active).clip(0, 24)
    
    probs_risk = clf_risk.predict_proba(X_active)[:, 1]
    risk_scores = np.round(probs_risk * 100).astype(int)
    probs_slip = clf_slippage.predict_proba(X_active)[:, 1]
    
    pred_next_stage_idx = clf_next_stage.predict(X_active)
    pred_next_stage = pd.Series(pred_next_stage_idx).map(next_stage_inv_map).values
    
    max_probs = probs_outcome.max(axis=1)
    confidence_scores = np.where(max_probs >= 0.7, 'High', np.where(max_probs >= 0.45, 'Medium', 'Low'))
    
    # SHAP local drivers
    print("Computing SHAP values...")
    explainer_early = shap.TreeExplainer(xgb_early)
    explainer_late = shap.TreeExplainer(xgb_late)
    
    shap_values = np.zeros((len(X_active), len(ALL_FEATURES)))
    if is_early_active.sum() > 0:
        shap_vals_early = explainer_early.shap_values(X_active[is_early_active])
        if isinstance(shap_vals_early, list):
            shap_early_c0 = shap_vals_early[0]
        elif len(shap_vals_early.shape) == 3:
            shap_early_c0 = shap_vals_early[:, :, 0]
        else:
            shap_early_c0 = shap_vals_early
        shap_values[is_early_active] = shap_early_c0
        
    if (~is_early_active).sum() > 0:
        shap_vals_late = explainer_late.shap_values(X_active[~is_early_active])
        if isinstance(shap_vals_late, list):
            shap_late_c0 = shap_vals_late[0]
        elif len(shap_vals_late.shape) == 3:
            shap_late_c0 = shap_vals_late[:, :, 0]
        else:
            shap_late_c0 = shap_vals_late
        shap_values[~is_early_active] = shap_late_c0
        
    drivers_pos = []
    drivers_neg = []
    for i in range(len(X_active)):
        row_shap = shap_values[i]
        sorted_indices = np.argsort(row_shap)
        
        neg_idx = sorted_indices[:3]
        neg_names = [FEATURE_NAMES_MAP.get(ALL_FEATURES[idx], ALL_FEATURES[idx]) for idx in neg_idx]
        
        pos_idx = sorted_indices[-3:][::-1]
        pos_names = [FEATURE_NAMES_MAP.get(ALL_FEATURES[idx], ALL_FEATURES[idx]) for idx in pos_idx]
        
        drivers_pos.append(pos_names)
        drivers_neg.append(neg_names)
        
    # Build Predictions Dataframe
    active_orig = active_df.copy().reset_index(drop=True)
    pred_table = pd.DataFrame({
        'Opportunity Number': active_orig['Opportunity Number'],
        'Client': active_orig['Client'],
        'Industry': active_orig['Core Industry'].fillna('Unknown'),
        'Region': active_orig['Region'],
        'Country': active_orig['Country/Entity'],
        'Business Unit': active_orig['Business Unit'],
        'Current Stage': active_orig['Stage'],
        'Opportunity Value': active_orig['Unweighted_Amount'],
        'Win Probability': np.round(probs_outcome[:, 0], 4),
        'Loss Probability': np.round(probs_outcome[:, 1], 4),
        'Abandon Probability': np.round(probs_outcome[:, 2], 4),
        'Predicted Outcome': pred_outcome_label,
        'Predicted Win Month': np.round(pred_months_win, 1),
        'Predicted Loss Month': np.round(pred_months_loss, 1),
        'Predicted Abandon Month': np.round(pred_months_abandon, 1),
        'Risk Score': risk_scores,
        'Confidence Score': confidence_scores,
        'Slip Probability': np.round(probs_slip, 4),
        'Predicted Next Stage': pred_next_stage,
        'Top Driver 1': [dp[0] for dp in drivers_pos],
        'Top Driver 2': [dp[1] for dp in drivers_pos],
        'Top Driver 3': [dn[0] for dn in drivers_neg],
        'Prediction Date': '2026-05-08'
    })
    
    # Monthly Forecast
    start_date = pd.to_datetime('2026-05-08')
    forecast_months = []
    for m in range(1, 13):
        f_date = start_date + pd.DateOffset(months=m)
        month_str = f_date.strftime('%Y-%m')
        
        win_deals = pred_table[(pred_table['Predicted Outcome'] == 'Won') & (np.round(pred_table['Predicted Win Month']) == m)]
        loss_deals = pred_table[(pred_table['Predicted Outcome'] == 'Lost') & (np.round(pred_table['Predicted Loss Month']) == m)]
        abandon_deals = pred_table[(pred_table['Predicted Outcome'] == 'Abandoned') & (np.round(pred_table['Predicted Abandon Month']) == m)]
        
        predicted_revenue = win_deals['Opportunity Value'].sum()
        expected_wins = len(win_deals)
        expected_losses = len(loss_deals)
        expected_abandons = len(abandon_deals)
        
        avg_win_prob = win_deals['Win Probability'].mean() if len(win_deals) > 0 else 0.5
        avg_risk = win_deals['Risk Score'].mean() if len(win_deals) > 0 else 0.0
        
        all_deals_this_month = pred_table[np.round(pred_table['Predicted Win Month']) == m]
        most_likely_revenue = (all_deals_this_month['Opportunity Value'] * all_deals_this_month['Win Probability']).sum()
        best_case_revenue = all_deals_this_month[all_deals_this_month['Win Probability'] >= 0.3]['Opportunity Value'].sum()
        worst_case_revenue = all_deals_this_month[all_deals_this_month['Win Probability'] >= 0.8]['Opportunity Value'].sum()
        
        forecast_confidence = 'High' if avg_win_prob > 0.65 else ('Medium' if avg_win_prob > 0.4 else 'Low')
        
        forecast_months.append({
            'Month': month_str,
            'Predicted Revenue': np.round(predicted_revenue, 2),
            'Expected Wins': expected_wins,
            'Expected Losses': expected_losses,
            'Expected Abandons': expected_abandons,
            'Average Win Probability': np.round(avg_win_prob, 4),
            'Average Risk Score': np.round(avg_risk, 1),
            'Best Case Revenue': np.round(best_case_revenue, 2),
            'Most Likely Revenue': np.round(most_likely_revenue, 2),
            'Worst Case Revenue': np.round(worst_case_revenue, 2),
            'Forecast Confidence': forecast_confidence
        })
    forecast_df = pd.DataFrame(forecast_months)
    
    # Model Performance Historical Set
    test_dates = sorted(trainable_df['Month Date dt'].unique())[-6:]
    val_set = trainable_df[trainable_df['Month Date dt'].isin(test_dates)].copy()
    val_set_proc, _, _ = clean_and_impute(val_set, imputer, encoder)
    is_early_val = val_set_proc['Stage'].isin(early_codes)
    val_preds, val_probs = predict_ensemble_gated(
        xgb_early, xgb_late, lgb_early, lgb_late, cb_early, cb_late,
        val_set_proc[ALL_FEATURES], is_early_val, threshold=0.45
    )
    val_preds_label = pd.Series(val_preds).map({0: 'Won', 1: 'Lost', 2: 'Abandoned'}).values
    val_conf = np.where(val_probs.max(axis=1) >= 0.7, 'High', np.where(val_probs.max(axis=1) >= 0.45, 'Medium', 'Low'))
    
    perf_table = pd.DataFrame({
        'Prediction Date': val_set['Month Date dt'].dt.strftime('%Y-%m-%d'),
        'Actual Outcome': val_set['Target_Outcome'],
        'Predicted Outcome': val_preds_label,
        'Win Probability': np.round(val_probs[:, 0], 4),
        'Confidence Score': val_conf,
        'Prediction Correct': (val_set['Target_Outcome'] == val_preds_label)
    })
    
    # Stage Movement
    snap_sorted = df.sort_values(['Opportunity Number', 'Month Date dt']).copy()
    snap_sorted['From Stage'] = snap_sorted['Stage']
    snap_sorted['To Stage'] = snap_sorted.groupby('Opportunity Number')['Stage'].shift(-1)
    snap_sorted['To Stage'] = snap_sorted['To Stage'].fillna(
        snap_sorted['Target_Outcome'].map({'Won': '5. Won', 'Lost': '6. Lost', 'Abandoned': '7. Abandoned'}).fillna('Open')
    )
    stage_move_df = snap_sorted[snap_sorted['To Stage'] != 'Open'].copy()
    
    stage_movement_table = pd.DataFrame({
        'Opportunity': stage_move_df['Opportunity Number'],
        'Snapshot Date': stage_move_df['Month Date dt'].dt.strftime('%Y-%m-%d'),
        'From Stage': stage_move_df['From Stage'],
        'To Stage': stage_move_df['To Stage'],
        'Days In Stage': stage_move_df['Days_In_Current_Stage'],
        'Stage Velocity': stage_move_df['Stage_Velocity'],
        'Slipped': stage_move_df['Target_Slipped']
    })
    
    # Global Feature Importance
    importance = (xgb_early.feature_importances_ + xgb_late.feature_importances_ + lgb_early.feature_importances_ + lgb_late.feature_importances_) / 4.0
    feat_imp = sorted(zip(ALL_FEATURES, importance), key=lambda x: x[1], reverse=True)
    feat_imp_df = pd.DataFrame(feat_imp, columns=['Feature', 'Importance'])
    feat_imp_df['FeatureName'] = feat_imp_df['Feature'].map(FEATURE_NAMES_MAP).fillna(feat_imp_df['Feature'])
    
    # SHAP Global Summary
    mean_shap = np.abs(shap_values).mean(axis=0)
    shap_summary = sorted(zip(ALL_FEATURES, mean_shap), key=lambda x: x[1], reverse=True)
    shap_summary_df = pd.DataFrame(shap_summary, columns=['Feature', 'MeanSHAP'])
    shap_summary_df['FeatureName'] = shap_summary_df['Feature'].map(FEATURE_NAMES_MAP).fillna(shap_summary_df['Feature'])
    
    # Save outputs to scratch folder with 'opt_' prefixes
    scratch_dir = r"C:\Users\anujm\.gemini\antigravity-ide\scratch"
    print(f"Exporting optimized outputs to scratch: {scratch_dir}")
    os.makedirs(scratch_dir, exist_ok=True)
    
    # Save CSVs
    pred_table.to_csv(os.path.join(scratch_dir, "opt_opportunity_predictions.csv"), index=False)
    forecast_df.to_csv(os.path.join(scratch_dir, "opt_monthly_forecast.csv"), index=False)
    perf_table.to_csv(os.path.join(scratch_dir, "opt_model_performance.csv"), index=False)
    stage_movement_table.head(5000).to_csv(os.path.join(scratch_dir, "opt_stage_movement.csv"), index=False)
    
    # Save JSONs
    pred_table.head(1000).to_json(os.path.join(scratch_dir, "opt_predictions.json"), orient='records', indent=2)
    forecast_df.to_json(os.path.join(scratch_dir, "opt_monthly_forecast.json"), orient='records', indent=2)
    perf_table.head(1000).to_json(os.path.join(scratch_dir, "opt_model_performance.json"), orient='records', indent=2)
    stage_movement_table.head(1000).to_json(os.path.join(scratch_dir, "opt_stage_movement.json"), orient='records', indent=2)
    feat_imp_df.to_json(os.path.join(scratch_dir, "opt_feature_importance.json"), orient='records', indent=2)
    shap_summary_df.to_json(os.path.join(scratch_dir, "opt_shap_summary.json"), orient='records', indent=2)
    
    print("Optimized predictions generated successfully!")

if __name__ == "__main__":
    main()
