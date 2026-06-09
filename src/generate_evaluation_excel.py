import pandas as pd
import numpy as np
import os
import pickle
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute import SimpleImputer
import xgboost as xgb

# Define feature lists
CAT_COLS = [
    'Stage', 'Region', 'Business Unit', 'Country/Entity', 
    'Service Group', 'Sub-Service', 'Core Industry', 'Detail Industry', 
    'Partner', 'Comp/SS', 'Client Type (New)'
]

NUM_COLS = [
    'Num_Appearances', 'Opp_Age_Days', 'Num_Stage_Changes', 'Stage_Velocity', 
    'Days_In_Current_Stage', 'Weighted_Amount', 'Unweighted_Amount', 
    'Amount_Growth_Trend', 'Amount_Decline_Trend', 'Num_Slippages', 
    'client_win_rate', 'client_loss_rate', 'client_avg_size'
]

ALL_FEATURES = CAT_COLS + NUM_COLS

ORIGINAL_COLS = [
    'Month Date', 'Expected_Start_Date__c', 'Stage', 'Region', 'Business Unit', 
    'Country/Entity', 'Service Group', 'Sub-Service', 'Partner', 'Opportunity Number', 
    'Core Industry', 'Detail Industry', 'Weighted Net Amount', 'Un-Wtd Net Amount', 
    'Comp/SS', 'Client Type (New)', 'Client', 'R2L', 'SF Program', 'Client Journey/GI', 
    'Expected FP', 'Expected FY', 'CreatedDate', 'Created FP', 'POD Name', 'As of FP', 
    'As of FY', 'POD Region', 'Client Industry', 'Partnership', 'Primary_Campaign__c'
]

def train_gated_classifier(clf_class, clf_params, X_train, y_train, early_codes):
    from sklearn.model_selection import train_test_split
    from sklearn.utils.class_weight import compute_sample_weight
    from sklearn.metrics import f1_score
    
    # Stratified split for threshold tuning
    try:
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_train, y_train, test_size=0.2, random_state=42, stratify=y_train
        )
    except:
        X_tr, X_val, y_tr, y_val = train_test_split(
            X_train, y_train, test_size=0.2, random_state=42
        )
        
    is_early_tr = X_tr['Stage'].isin(early_codes)
    is_early_val = X_val['Stage'].isin(early_codes)
    
    clf_early = clf_class(**clf_params)
    clf_late = clf_class(**clf_params)
    
    if is_early_tr.sum() > 0:
        w_tr_early = compute_sample_weight(class_weight='balanced', y=y_tr[is_early_tr])
        clf_early.fit(X_tr[is_early_tr], y_tr[is_early_tr], sample_weight=w_tr_early)
    else:
        clf_early.fit(X_tr, y_tr)
        
    if (~is_early_tr).sum() > 0:
        w_tr_late = compute_sample_weight(class_weight='balanced', y=y_tr[~is_early_tr])
        clf_late.fit(X_tr[~is_early_tr], y_tr[~is_early_tr], sample_weight=w_tr_late)
    else:
        clf_late.fit(X_tr, y_tr)
        
    best_thresh = 0.5
    best_f1 = -1
    
    probs_val = np.zeros((len(X_val), 3))
    if is_early_val.sum() > 0:
        probs_val[is_early_val] = clf_early.predict_proba(X_val[is_early_val])
    if (~is_early_val).sum() > 0:
        probs_val[~is_early_val] = clf_late.predict_proba(X_val[~is_early_val])
        
    for th in np.linspace(0.2, 0.6, 9):
        preds_val = np.zeros(len(X_val), dtype=int)
        for idx in range(len(X_val)):
            if probs_val[idx, 0] >= th:
                preds_val[idx] = 0
            else:
                preds_val[idx] = 1 if probs_val[idx, 1] >= probs_val[idx, 2] else 2
                
        f1_val = f1_score(y_val, preds_val, average='macro')
        if f1_val > best_f1:
            best_f1 = f1_val
            best_thresh = th
            
    clf_early_full = clf_class(**clf_params)
    clf_late_full = clf_class(**clf_params)
    is_early_full = X_train['Stage'].isin(early_codes)
    
    if is_early_full.sum() > 0:
        w_full_early = compute_sample_weight(class_weight='balanced', y=y_train[is_early_full])
        clf_early_full.fit(X_train[is_early_full], y_train[is_early_full], sample_weight=w_full_early)
    else:
        clf_early_full.fit(X_train, y_train)
        
    if (~is_early_full).sum() > 0:
        w_full_late = compute_sample_weight(class_weight='balanced', y=y_train[~is_early_full])
        clf_late_full.fit(X_train[~is_early_full], y_train[~is_early_full], sample_weight=w_full_late)
    else:
        clf_late_full.fit(X_train, y_train)
        
    return clf_early_full, clf_late_full, best_thresh

def predict_gated(clf_early, clf_late, X_test, is_early_test, threshold):
    probs = np.zeros((len(X_test), 3))
    if is_early_test.sum() > 0:
        probs[is_early_test] = clf_early.predict_proba(X_test[is_early_test])
    if (~is_early_test).sum() > 0:
        probs[~is_early_test] = clf_late.predict_proba(X_test[~is_early_test])
        
    preds = np.zeros(len(X_test), dtype=int)
    for idx in range(len(X_test)):
        if probs[idx, 0] >= threshold:
            preds[idx] = 0
        else:
            preds[idx] = 1 if probs[idx, 1] >= probs[idx, 2] else 2
    return preds, probs

def prepare_fold_data(train_df, test_df):
    train_df = train_df.copy()
    test_df = test_df.copy()
    
    num_imputer = SimpleImputer(strategy='median')
    train_df[NUM_COLS] = num_imputer.fit_transform(train_df[NUM_COLS])
    test_df[NUM_COLS] = num_imputer.transform(test_df[NUM_COLS])
    
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    train_df[CAT_COLS] = encoder.fit_transform(train_df[CAT_COLS].astype(str))
    test_df[CAT_COLS] = encoder.transform(test_df[CAT_COLS].astype(str))
    
    return train_df, test_df, encoder

def main():
    print("Loading data...")
    df = pd.read_pickle("processed_data/features_df.pkl")
    active_df = pd.read_pickle("processed_data/active_features_df.pkl")
    
    # Sort chronologically
    df_trainable = df[df['Target_Outcome'] != 'Open'].copy()
    df_trainable = df_trainable.sort_values('Month Date dt').reset_index(drop=True)
    
    months = sorted(df_trainable['Month Date dt'].unique())
    
    folds = [
        {"name": "Iteration 1", "train_end_idx": 12, "test_end_idx": 18},
        {"name": "Iteration 2", "train_end_idx": 24, "test_end_idx": 30},
        {"name": "Iteration 3", "train_end_idx": 30, "test_end_idx": 36}
    ]
    
    output_path = os.path.join("output", "Opportunity_Forecasting_Evaluation.xlsx")
    print(f"Opening ExcelWriter for file: {output_path}")
    writer = pd.ExcelWriter(output_path, engine='xlsxwriter')
    
    for fold in folds:
        name = fold["name"]
        t_end = fold["train_end_idx"]
        te_end = fold["test_end_idx"]
        
        train_dates = months[:t_end]
        test_dates = months[t_end:te_end]
        
        train_df = df_trainable[df_trainable['Month Date dt'].isin(train_dates)].copy()
        test_df = df_trainable[df_trainable['Month Date dt'].isin(test_dates)].copy()
        
        print(f"\nProcessing {name}...")
        print(f"  Train: {len(train_df)} rows, Test: {len(test_df)} rows")
        
        # Prepare processed data
        train_df_proc, test_df_proc, encoder = prepare_fold_data(train_df, test_df)
        
        X_train, X_test = train_df_proc[ALL_FEATURES], test_df_proc[ALL_FEATURES]
        y_train_outcome = train_df_proc['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
        
        # 1. Gated Classifier for Outcome
        stage_list = list(encoder.categories_[0])
        early_codes = [stage_list.index(s) for s in ['1. Identify Opp', '2. Qualify Opp'] if s in stage_list]
        is_early_test = test_df_proc['Stage'].isin(early_codes)
        
        clf_early, clf_late, threshold = train_gated_classifier(
            xgb.XGBClassifier, {"n_estimators": 50, "max_depth": 5, "random_state": 42, "n_jobs": -1, "eval_metric": "mlogloss"},
            X_train, y_train_outcome, early_codes
        )
        
        preds_outcome, probs_outcome = predict_gated(clf_early, clf_late, X_test, is_early_test, threshold)
        pred_outcome_label = pd.Series(preds_outcome).map({0: 'Won', 1: 'Lost', 2: 'Abandoned'}).values
        
        # 2. Regressors for closure month
        win_idx = train_df['Target_Outcome'] == 'Won'
        reg_win = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
        reg_win.fit(X_train[win_idx], train_df.loc[win_idx, 'Months_Until_Win'])
        
        loss_idx = train_df['Target_Outcome'] == 'Lost'
        reg_loss = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
        reg_loss.fit(X_train[loss_idx], train_df.loc[loss_idx, 'Months_Until_Loss'])
        
        abandon_idx = train_df['Target_Outcome'] == 'Abandoned'
        reg_abandon = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
        reg_abandon.fit(X_train[abandon_idx], train_df.loc[abandon_idx, 'Months_Until_Abandon'])
        
        pred_months_win = reg_win.predict(X_test).clip(0, 24)
        pred_months_loss = reg_loss.predict(X_test).clip(0, 24)
        pred_months_abandon = reg_abandon.predict(X_test).clip(0, 24)
        
        pred_months = np.zeros(len(X_test))
        for idx in range(len(X_test)):
            outcome = pred_outcome_label[idx]
            if outcome == 'Won':
                pred_months[idx] = pred_months_win[idx]
            elif outcome == 'Lost':
                pred_months[idx] = pred_months_loss[idx]
            else:
                pred_months[idx] = pred_months_abandon[idx]
                
        # 3. Slippage Classifier
        y_train_slipped = train_df['Target_Slipped'].values
        clf_slippage = xgb.XGBClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1, eval_metric='logloss')
        clf_slippage.fit(X_train, y_train_slipped)
        probs_slip = clf_slippage.predict_proba(X_test)[:, 1]
        
        # Build evaluation sheet
        raw_test_df = test_df[ORIGINAL_COLS].copy().reset_index(drop=True)
        raw_test_df['Win Probability'] = np.round(probs_outcome[:, 0], 4)
        raw_test_df['Loss Probability'] = np.round(probs_outcome[:, 1], 4)
        raw_test_df['Abandon Probability'] = np.round(probs_outcome[:, 2], 4)
        raw_test_df['Predicted Outcome'] = pred_outcome_label
        raw_test_df['Expected Months to Close'] = np.round(pred_months, 1)
        raw_test_df['Slippage Probability'] = np.round(probs_slip, 4)
        
        actual_outcome = test_df['Target_Outcome'].values
        raw_test_df['Actual Outcome'] = actual_outcome
        raw_test_df['Correct'] = np.where(actual_outcome == pred_outcome_label, 'True', 'False')
        
        err_types = []
        for idx in range(len(test_df)):
            act = actual_outcome[idx]
            pr = pred_outcome_label[idx]
            if act == pr:
                err_types.append('Correct')
            elif act == 'Won' and pr != 'Won':
                err_types.append('False Negative (Win)')
            elif act != 'Won' and pr == 'Won':
                err_types.append('False Positive (Win)')
            else:
                err_types.append('Misclassified')
        raw_test_df['Error Type'] = err_types
        
        print(f"  Saving {name} sheet (shape: {raw_test_df.shape})...")
        raw_test_df.to_excel(writer, sheet_name=name, index=False)

    # 4. Sheet 4: Production (Active)
    print("\nProcessing Production (Active) sheet...")
    # Train on all available trainable historical snapshots
    train_df = df_trainable.copy()
    test_df = active_df.copy() # Predict on active open opportunities
    
    train_df_proc, test_df_proc, encoder = prepare_fold_data(train_df, test_df)
    
    X_train, X_test = train_df_proc[ALL_FEATURES], test_df_proc[ALL_FEATURES]
    y_train_outcome = train_df_proc['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
    
    stage_list = list(encoder.categories_[0])
    early_codes = [stage_list.index(s) for s in ['1. Identify Opp', '2. Qualify Opp'] if s in stage_list]
    is_early_test = test_df_proc['Stage'].isin(early_codes)
    
    clf_early, clf_late, threshold = train_gated_classifier(
        xgb.XGBClassifier, {"n_estimators": 50, "max_depth": 5, "random_state": 42, "n_jobs": -1, "eval_metric": "mlogloss"},
        X_train, y_train_outcome, early_codes
    )
    
    preds_outcome, probs_outcome = predict_gated(clf_early, clf_late, X_test, is_early_test, threshold)
    pred_outcome_label = pd.Series(preds_outcome).map({0: 'Won', 1: 'Lost', 2: 'Abandoned'}).values
    
    # Train regressors
    win_idx = train_df['Target_Outcome'] == 'Won'
    reg_win = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
    reg_win.fit(X_train[win_idx], train_df.loc[win_idx, 'Months_Until_Win'])
    
    loss_idx = train_df['Target_Outcome'] == 'Lost'
    reg_loss = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
    reg_loss.fit(X_train[loss_idx], train_df.loc[loss_idx, 'Months_Until_Loss'])
    
    abandon_idx = train_df['Target_Outcome'] == 'Abandoned'
    reg_abandon = xgb.XGBRegressor(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1)
    reg_abandon.fit(X_train[abandon_idx], train_df.loc[abandon_idx, 'Months_Until_Abandon'])
    
    pred_months_win = reg_win.predict(X_test).clip(0, 24)
    pred_months_loss = reg_loss.predict(X_test).clip(0, 24)
    pred_months_abandon = reg_abandon.predict(X_test).clip(0, 24)
    
    pred_months = np.zeros(len(X_test))
    for idx in range(len(X_test)):
        outcome = pred_outcome_label[idx]
        if outcome == 'Won':
            pred_months[idx] = pred_months_win[idx]
        elif outcome == 'Lost':
            pred_months[idx] = pred_months_loss[idx]
        else:
            pred_months[idx] = pred_months_abandon[idx]
            
    # Train slippage
    y_train_slipped = train_df['Target_Slipped'].values
    clf_slippage = xgb.XGBClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1, eval_metric='logloss')
    clf_slippage.fit(X_train, y_train_slipped)
    probs_slip = clf_slippage.predict_proba(X_test)[:, 1]
    
    # Build active prediction sheet
    raw_test_df = test_df[ORIGINAL_COLS].copy().reset_index(drop=True)
    raw_test_df['Win Probability'] = np.round(probs_outcome[:, 0], 4)
    raw_test_df['Loss Probability'] = np.round(probs_outcome[:, 1], 4)
    raw_test_df['Abandon Probability'] = np.round(probs_outcome[:, 2], 4)
    raw_test_df['Predicted Outcome'] = pred_outcome_label
    raw_test_df['Expected Months to Close'] = np.round(pred_months, 1)
    raw_test_df['Slippage Probability'] = np.round(probs_slip, 4)
    raw_test_df['Actual Outcome'] = 'Open'
    raw_test_df['Correct'] = 'N/A'
    raw_test_df['Error Type'] = 'N/A'
    
    print(f"  Saving Production (Active) sheet (shape: {raw_test_df.shape})...")
    raw_test_df.to_excel(writer, sheet_name="Production (Active)", index=False)
    
    print("\nClosing Excel file...")
    writer.close()
    print(f"Successfully generated evaluation excel sheet at: {output_path}")

if __name__ == "__main__":
    main()
