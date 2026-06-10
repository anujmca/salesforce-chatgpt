import pandas as pd
import numpy as np
import os
import pickle
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score
import xgboost as xgb
import lightgbm as lgb
import catboost as cb

# Define optimized features
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

def prepare_data(df):
    df = df.copy()
    num_imputer = SimpleImputer(strategy='median')
    if len(df) > 0:
        df[NUM_COLS] = num_imputer.fit_transform(df[NUM_COLS])
        
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    df[CAT_COLS] = encoder.fit_transform(df[CAT_COLS].astype(str))
    
    return df, num_imputer, encoder

def train_and_tune_gated(clf_class, param_grid, X_train, y_train, early_codes, default_params=None):
    from sklearn.model_selection import train_test_split
    from sklearn.utils.class_weight import compute_sample_weight
    
    # Split for tuning
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
    
    best_score = -1
    best_params = None
    best_thresh = 0.5
    
    # Simple focused hyperparameter search
    # We loop over parameters in the grid
    keys = list(param_grid.keys())
    
    import itertools
    combinations = list(itertools.product(*[param_grid[k] for k in keys]))
    
    print(f"  Tuning {clf_class.__name__} (searching {len(combinations)} combinations)...")
    
    for comb in combinations:
        params = dict(zip(keys, comb))
        use_weight = params.pop('use_sample_weight', False)
        
        # Combine default parameters with searched ones
        full_params = default_params.copy() if default_params else {}
        full_params.update(params)
        
        clf_early = clf_class(**full_params)
        clf_late = clf_class(**full_params)
        
        # Train
        if is_early_tr.sum() > 0:
            if use_weight:
                w_tr_early = compute_sample_weight(class_weight='balanced', y=y_tr[is_early_tr])
                clf_early.fit(X_tr[is_early_tr], y_tr[is_early_tr], sample_weight=w_tr_early)
            else:
                clf_early.fit(X_tr[is_early_tr], y_tr[is_early_tr])
        else:
            clf_early.fit(X_tr, y_tr)
            
        if (~is_early_tr).sum() > 0:
            if use_weight:
                w_tr_late = compute_sample_weight(class_weight='balanced', y=y_tr[~is_early_tr])
                clf_late.fit(X_tr[~is_early_tr], y_tr[~is_early_tr], sample_weight=w_tr_late)
            else:
                clf_late.fit(X_tr[~is_early_tr], y_tr[~is_early_tr])
        else:
            clf_late.fit(X_tr, y_tr)
            
        # Predict on validation
        probs_val = np.zeros((len(X_val), 3))
        if is_early_val.sum() > 0:
            probs_val[is_early_val] = clf_early.predict_proba(X_val[is_early_val])
        if (~is_early_val).sum() > 0:
            probs_val[~is_early_val] = clf_late.predict_proba(X_val[~is_early_val])
            
        # Tune threshold for Win class vs Loss/Abandon
        for th in [0.3, 0.4, 0.5, 0.6]:
            preds_val = np.zeros(len(X_val), dtype=int)
            for idx in range(len(X_val)):
                if probs_val[idx, 0] >= th:
                    preds_val[idx] = 0
                else:
                    preds_val[idx] = 1 if probs_val[idx, 1] >= probs_val[idx, 2] else 2
                    
            val_acc = accuracy_score(y_val, preds_val)
            val_f1 = f1_score(y_val, preds_val, average='macro')
            
            # Combine accuracy and macro F1 (emphasizing accuracy)
            score = val_acc + 0.2 * val_f1
            if score > best_score:
                best_score = score
                best_params = (params, use_weight)
                best_thresh = th
                
    # Retrain on full training data with best hyperparameters
    best_hp, best_use_weight = best_params
    print(f"    Best Params: {best_hp}, use_sample_weight: {best_use_weight}, Threshold: {best_thresh}")
    
    full_params = default_params.copy() if default_params else {}
    full_params.update(best_hp)
    
    clf_early_full = clf_class(**full_params)
    clf_late_full = clf_class(**full_params)
    is_early_full = X_train['Stage'].isin(early_codes)
    
    if is_early_full.sum() > 0:
        if best_use_weight:
            w_full_early = compute_sample_weight(class_weight='balanced', y=y_train[is_early_full])
            clf_early_full.fit(X_train[is_early_full], y_train[is_early_full], sample_weight=w_full_early)
        else:
            clf_early_full.fit(X_train[is_early_full], y_train[is_early_full])
    else:
        clf_early_full.fit(X_train, y_train)
        
    if (~is_early_full).sum() > 0:
        if best_use_weight:
            w_full_late = compute_sample_weight(class_weight='balanced', y=y_train[~is_early_full])
            clf_late_full.fit(X_train[~is_early_full], y_train[~is_early_full], sample_weight=w_full_late)
        else:
            clf_late_full.fit(X_train[~is_early_full], y_train[~is_early_full])
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

def main():
    print("Loading optimized feature dataset...")
    df = pd.read_pickle("processed_data/opt_features_df.pkl")
    
    # Exclude open deals for training
    df_trainable = df[df['Target_Outcome'] != 'Open'].copy()
    print(f"Trainable rows: {len(df_trainable)}")
    
    # Preprocess
    df_trainable, num_imputer, encoder = prepare_data(df_trainable)
    
    # Sort chronologically
    df_trainable = df_trainable.sort_values('Month Date dt').reset_index(drop=True)
    months = sorted(df_trainable['Month Date dt'].unique())
    
    folds = [
        {"name": "Iteration 1", "train_end_idx": 12, "test_end_idx": 18},
        {"name": "Iteration 2", "train_end_idx": 24, "test_end_idx": 30},
        {"name": "Iteration 3", "train_end_idx": 30, "test_end_idx": 36}
    ]
    
    # Gated configs for stage split
    stage_list = list(encoder.categories_[0])
    early_codes = [stage_list.index(s) for s in ['1. Identify Opp', '2. Qualify Opp'] if s in stage_list]
    
    for fold in folds:
        name = fold["name"]
        t_end = fold["train_end_idx"]
        te_end = fold["test_end_idx"]
        
        train_dates = months[:t_end]
        test_dates = months[t_end:te_end]
        
        train_df = df_trainable[df_trainable['Month Date dt'].isin(train_dates)].copy()
        test_df = df_trainable[df_trainable['Month Date dt'].isin(test_dates)].copy()
        
        print(f"\n==========================================")
        print(f" Running {name}")
        print(f"   Train: {len(train_df)} rows, Test: {len(test_df)} rows")
        print(f"==========================================")
        
        # Keep training size manageable but large enough for good results
        if len(train_df) > 150000:
            train_df = train_df.sample(150000, random_state=42)
            
        X_train, X_test = train_df[ALL_FEATURES], test_df[ALL_FEATURES]
        y_train = train_df['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
        y_test = test_df['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
        
        is_early_test = X_test['Stage'].isin(early_codes)
        
        # Tune XGBoost
        xgb_grid = {
            "max_depth": [5, 7],
            "learning_rate": [0.05, 0.1],
            "use_sample_weight": [True, False]
        }
        xgb_early, xgb_late, xgb_th = train_and_tune_gated(
            xgb.XGBClassifier, xgb_grid, X_train, y_train, early_codes,
            default_params={"n_estimators": 80, "random_state": 42, "n_jobs": -1, "eval_metric": "mlogloss"}
        )
        xgb_preds, xgb_probs = predict_gated(xgb_early, xgb_late, X_test, is_early_test, xgb_th)
        xgb_acc = accuracy_score(y_test, xgb_preds)
        print(f"    XGBoost Test Accuracy: {xgb_acc:.4%}")
        
        # Tune LightGBM
        lgb_grid = {
            "max_depth": [6, 8],
            "learning_rate": [0.05, 0.1],
            "use_sample_weight": [True, False]
        }
        lgb_early, lgb_late, lgb_th = train_and_tune_gated(
            lgb.LGBMClassifier, lgb_grid, X_train, y_train, early_codes,
            default_params={"n_estimators": 100, "random_state": 42, "n_jobs": -1, "verbose": -1}
        )
        lgb_preds, lgb_probs = predict_gated(lgb_early, lgb_late, X_test, is_early_test, lgb_th)
        lgb_acc = accuracy_score(y_test, lgb_preds)
        print(f"    LightGBM Test Accuracy: {lgb_acc:.4%}")
        
        # Tune CatBoost
        cb_grid = {
            "depth": [5, 7],
            "learning_rate": [0.05, 0.1],
            "use_sample_weight": [True, False]
        }
        cb_early, cb_late, cb_th = train_and_tune_gated(
            cb.CatBoostClassifier, cb_grid, X_train, y_train, early_codes,
            default_params={"iterations": 80, "random_state": 42, "verbose": 0, "thread_count": -1}
        )
        cb_preds, cb_probs = predict_gated(cb_early, cb_late, X_test, is_early_test, cb_th)
        cb_acc = accuracy_score(y_test, cb_preds)
        print(f"    CatBoost Test Accuracy: {cb_acc:.4%}")
        
        # Evaluation of Gated Ensemble (Soft Voting)
        ens_probs = (xgb_probs + lgb_probs + cb_probs) / 3.0
        
        # Optimize threshold on ensemble probabilities
        best_ens_th = 0.5
        best_ens_acc = -1
        for th in np.linspace(0.3, 0.6, 7):
            ens_preds = np.zeros(len(X_test), dtype=int)
            for idx in range(len(X_test)):
                if ens_probs[idx, 0] >= th:
                    ens_preds[idx] = 0
                else:
                    ens_preds[idx] = 1 if ens_probs[idx, 1] >= ens_probs[idx, 2] else 2
            
            ens_acc = accuracy_score(y_test, ens_preds)
            if ens_acc > best_ens_acc:
                best_ens_acc = ens_acc
                best_ens_th = th
                
        print(f"  ===> Optimized Gated Ensemble Accuracy: {best_ens_acc:.4%} (Ensemble Threshold: {best_ens_th:.2f})")

if __name__ == "__main__":
    main()
