import pandas as pd
import numpy as np
import os
import pickle
from sklearn.preprocessing import OrdinalEncoder
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import roc_auc_score, f1_score, log_loss, mean_absolute_error, mean_squared_error
import xgboost as xgb
import lightgbm as lgb
import catboost as cb

# Define feature columns
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

def prepare_data(df):
    """
    Imputes numericals and encodes categoricals.
    """
    df = df.copy()
    
    # Impute numericals
    num_imputer = SimpleImputer(strategy='median')
    if len(df) > 0:
        df[NUM_COLS] = num_imputer.fit_transform(df[NUM_COLS])
        
    # Ordinal encode categoricals
    encoder = OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)
    df[CAT_COLS] = encoder.fit_transform(df[CAT_COLS].astype(str))
    
    return df, num_imputer, encoder

def evaluate_classifier(model, X_test, y_test, is_multiclass=False):
    if is_multiclass:
        preds = model.predict(X_test)
        probs = model.predict_proba(X_test)
        
        # Multiclass ROC AUC (One-vs-Rest)
        try:
            auc = roc_auc_score(y_test, probs, multi_class='ovr', average='macro')
        except:
            auc = 0.5
            
        f1 = f1_score(y_test, preds, average='macro')
        loss = log_loss(y_test, probs)
        return {"ROC AUC": auc, "F1": f1, "Log Loss": loss}
    else:
        probs = model.predict_proba(X_test)[:, 1]
        preds = (probs >= 0.5).astype(int)
        
        try:
            auc = roc_auc_score(y_test, probs)
        except:
            auc = 0.5
            
        f1 = f1_score(y_test, preds, zero_division=0)
        loss = log_loss(y_test, probs, labels=[0, 1])
        return {"ROC AUC": auc, "F1": f1, "Log Loss": loss}

def evaluate_regressor(model, X_test, y_test):
    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = np.sqrt(mean_squared_error(y_test, preds))
    return {"MAE": mae, "RMSE": rmse}

def train_and_compare_models():
    print("Loading engineered features...")
    df = pd.read_pickle(r"processed_data\features_df.pkl")
    
    # Exclude open deals for training
    df_trainable = df[df['Target_Outcome'] != 'Open'].copy()
    print(f"Trainable snapshot rows: {len(df_trainable)}")
    
    # Preprocess trainable data
    df_trainable, num_imputer, encoder = prepare_data(df_trainable)
    
    # Sort chronologically
    df_trainable = df_trainable.sort_values('Month Date dt').reset_index(drop=True)
    
    # Unique months
    months = sorted(df_trainable['Month Date dt'].unique())
    print(f"Number of trainable month dates: {len(months)}")
    
    # We define our 3 iterations based on month indices
    # Iteration 1: Train first 12, Test next 6
    # Iteration 2: Train first 24, Test next 6
    # Iteration 3: Train first 30, Test next 6
    folds = [
        {"name": "Iteration 1", "train_end_idx": 12, "test_end_idx": 18},
        {"name": "Iteration 2", "train_end_idx": 24, "test_end_idx": 30},
        {"name": "Iteration 3", "train_end_idx": 30, "test_end_idx": 36}
    ]
    
    results = {}
    
    for fold in folds:
        name = fold["name"]
        t_end = fold["train_end_idx"]
        te_end = fold["test_end_idx"]
        
        train_dates = months[:t_end]
        test_dates = months[t_end:te_end]
        
        train_df = df_trainable[df_trainable['Month Date dt'].isin(train_dates)]
        test_df = df_trainable[df_trainable['Month Date dt'].isin(test_dates)]
        
        print(f"\n==========================================")
        print(f" Running {name}")
        print(f"   Train dates: {train_dates[0].strftime('%Y-%m-%d')} to {train_dates[-1].strftime('%Y-%m-%d')} (rows: {len(train_df)})")
        print(f"   Test dates: {test_dates[0].strftime('%Y-%m-%d')} to {test_dates[-1].strftime('%Y-%m-%d')} (rows: {len(test_df)})")
        print(f"==========================================")
        
        if len(train_df) == 0 or len(test_df) == 0:
            print("Skipping fold due to lack of data.")
            continue
            
        # Downsample training set if it is too large for fast training
        if len(train_df) > 100000:
            train_df = train_df.sample(100000, random_state=42)
            
        X_train, X_test = train_df[ALL_FEATURES], test_df[ALL_FEATURES]
        
        # Outcome Target (multi-class: Won=0, Lost=1, Abandoned=2)
        y_train_outcome = train_df['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
        y_test_outcome = test_df['Target_Outcome'].map({'Won': 0, 'Lost': 1, 'Abandoned': 2}).values
        
        # Model 1: Outcome prediction (Multiclass)
        # We will train and compare LightGBM, XGBoost, CatBoost, RandomForest, LogisticRegression
        print("Training Outcome Classifiers...")
        classifiers = {
            "LightGBM": lgb.LGBMClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1, verbose=-1),
            "XGBoost": xgb.XGBClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1, eval_metric='mlogloss'),
            "CatBoost": cb.CatBoostClassifier(iterations=50, depth=5, random_state=42, verbose=0, thread_count=-1),
            "RandomForest": RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42, n_jobs=-1),
            "LogisticRegression": LogisticRegression(max_iter=100, random_state=42, n_jobs=-1)
        }
        
        fold_results = {}
        for algo_name, clf in classifiers.items():
            print(f"  Training {algo_name}...")
            try:
                clf.fit(X_train, y_train_outcome)
                metrics = evaluate_classifier(clf, X_test, y_test_outcome, is_multiclass=True)
                fold_results[algo_name] = metrics
                print(f"    {algo_name} ROC AUC: {metrics['ROC AUC']:.4f}, F1: {metrics['F1']:.4f}")
            except Exception as e:
                print(f"    Failed {algo_name}: {e}")
                
        results[name] = fold_results
        
    # Save results summary to pickle for report generating
    os.makedirs("processed_data", exist_ok=True)
    with open(r"processed_data\training_results.pkl", "wb") as f:
        pickle.dump(results, f)
        
    print("\nModel training comparison completed and results saved!")

if __name__ == "__main__":
    train_and_compare_models()
