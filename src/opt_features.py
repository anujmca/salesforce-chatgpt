import pandas as pd
import numpy as np
import os
import pickle

def build_features(processed_dir="processed_data"):
    print("Loading preprocessed pickle files...")
    snap_df = pd.read_pickle(os.path.join(processed_dir, "snap_df.pkl"))
    closed_df = pd.read_pickle(os.path.join(processed_dir, "closed_df.pkl"))
    active_df = pd.read_pickle(os.path.join(processed_dir, "active_df.pkl"))
    
    with open(os.path.join(processed_dir, "closed_mapping.pkl"), "rb") as f:
        closed_mapping = pickle.load(f)
        
    print("Sorting snapshots chronologically...")
    snap_df = snap_df.sort_values(['Opportunity Number', 'Month Date dt']).reset_index(drop=True)
    
    # --- 1. Running Opportunity Features ---
    print("Computing running opportunity features...")
    # Number of appearances
    snap_df['Num_Appearances'] = snap_df.groupby('Opportunity Number').cumcount() + 1
    
    # Opportunity Age: days since Creation Date
    snap_df['Opp_Age_Days'] = (snap_df['Month Date dt'] - snap_df['CreatedDate_dt']).dt.days.fillna(0).clip(lower=0)
    
    # Stage Changes
    snap_df['stage_changed_flag'] = (snap_df['Stage'] != snap_df['Stage'].shift(1)).astype(int)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'stage_changed_flag'] = 0
    snap_df['Num_Stage_Changes'] = snap_df.groupby('Opportunity Number')['stage_changed_flag'].cumsum()
    
    snap_df['Stage_Velocity'] = snap_df['Opp_Age_Days'] / (snap_df['Num_Stage_Changes'] + 1)
    
    # Time in Current Stage
    snap_df['stage_block'] = (snap_df['Stage'] != snap_df['Stage'].shift(1)).astype(int)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'stage_block'] = 1
    snap_df['stage_block_id'] = snap_df.groupby('Opportunity Number')['stage_block'].cumsum()
    
    earliest_dates = snap_df.groupby(['Opportunity Number', 'stage_block_id'])['Month Date dt'].transform('min')
    snap_df['Days_In_Current_Stage'] = (snap_df['Month Date dt'] - earliest_dates).dt.days.fillna(0).clip(lower=0)
    
    snap_df = snap_df.drop(columns=['stage_changed_flag', 'stage_block', 'stage_block_id'], errors='ignore')
    
    # --- 2. Stage Stagnation Metrics ---
    print("Computing stage stagnation metrics...")
    # Mean days spent in each stage across all historical data
    mean_days_in_stage = snap_df.groupby('Stage')['Days_In_Current_Stage'].transform('mean')
    snap_df['days_in_stage_ratio'] = (snap_df['Days_In_Current_Stage'] / (mean_days_in_stage + 1)).fillna(0)
    snap_df['is_stage_stagnant'] = (snap_df['days_in_stage_ratio'] > 1.5).astype(int)
    
    # --- 3. Running Value Features ---
    print("Computing running value features...")
    snap_df['Weighted_Amount'] = snap_df['Weighted Net Amount'].fillna(0)
    snap_df['Unweighted_Amount'] = snap_df['Un-Wtd Net Amount'].fillna(0)
    
    # Amount trends
    amount_diff = snap_df['Unweighted_Amount'] - snap_df.groupby('Opportunity Number')['Unweighted_Amount'].shift(1).fillna(0)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'Unweighted_Amount'] = 0
    snap_df['Amount_Growth_Trend'] = amount_diff.clip(lower=0)
    snap_df['Amount_Decline_Trend'] = (-amount_diff).clip(lower=0)
    
    # --- 4. Running Slippages ---
    print("Computing running slippages...")
    snap_df['slipped_flag'] = (snap_df['Expected_Start_Date__c_dt'] > snap_df['Expected_Start_Date__c_dt'].shift(1)).astype(int)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'slipped_flag'] = 0
    snap_df['Num_Slippages'] = snap_df.groupby('Opportunity Number')['slipped_flag'].cumsum()
    snap_df = snap_df.drop(columns=['slipped_flag'], errors='ignore')
    
    # --- 5. Fiscal Seasonality Indicators ---
    print("Computing fiscal seasonality indicators...")
    snap_df['is_quarter_end'] = snap_df['Month Date dt'].dt.month.isin([3, 6, 9, 12]).astype(int)
    snap_df['is_fy_end'] = snap_df['Month Date dt'].dt.month.isin([3, 12]).astype(int) # Standard FY ends
    
    # --- 6. Interaction String Crosses (for advanced splits) ---
    print("Building interaction string crosses...")
    snap_df['BU_Industry_Cross'] = snap_df['Business Unit'].astype(str) + "_" + snap_df['Core Industry'].astype(str)
    snap_df['Region_Industry_Cross'] = snap_df['Region'].astype(str) + "_" + snap_df['Core Industry'].astype(str)
    
    # --- 7. Dynamic Rolling Client Features (Time-Aware) ---
    print("Computing dynamic, time-aware rolling client win/loss features...")
    unique_dates = sorted(snap_df['Month Date dt'].unique())
    
    client_features_list = []
    for d in unique_dates:
        # Lifetime closed deals
        closed_prior = closed_df[closed_df['Closed Date dt'] < d]
        
        # 3-Month Rolling closed deals
        d_3m = d - pd.DateOffset(months=3)
        closed_prior_3m = closed_df[(closed_df['Closed Date dt'] < d) & (closed_df['Closed Date dt'] >= d_3m)]
        
        # 6-Month Rolling closed deals
        d_6m = d - pd.DateOffset(months=6)
        closed_prior_6m = closed_df[(closed_df['Closed Date dt'] < d) & (closed_df['Closed Date dt'] >= d_6m)]
        
        # lifetime metrics
        if len(closed_prior) > 0:
            client_stats = closed_prior.groupby('Client').agg(
                client_total_deals=('Opportunity Number', 'count'),
                client_won_deals=('IsWon', 'sum'),
                client_total_val=('Closed Value', 'sum')
            ).reset_index()
            client_stats['client_win_rate'] = (client_stats['client_won_deals'] / client_stats['client_total_deals']).fillna(0)
            client_stats['client_loss_rate'] = (1 - client_stats['client_win_rate']).fillna(0)
            client_stats['client_avg_size'] = (client_stats['client_total_val'] / client_stats['client_total_deals']).fillna(0)
        else:
            client_stats = pd.DataFrame(columns=['Client', 'client_total_deals', 'client_win_rate', 'client_loss_rate', 'client_avg_size'])
            
        # 3-month rolling metrics
        if len(closed_prior_3m) > 0:
            client_stats_3m = closed_prior_3m.groupby('Client').agg(
                client_total_deals_3m=('Opportunity Number', 'count'),
                client_won_deals_3m=('IsWon', 'sum')
            ).reset_index()
            client_stats_3m['client_win_rate_3m'] = (client_stats_3m['client_won_deals_3m'] / client_stats_3m['client_total_deals_3m']).fillna(0)
        else:
            client_stats_3m = pd.DataFrame(columns=['Client', 'client_total_deals_3m', 'client_win_rate_3m'])
            
        # 6-month rolling metrics
        if len(closed_prior_6m) > 0:
            client_stats_6m = closed_prior_6m.groupby('Client').agg(
                client_total_deals_6m=('Opportunity Number', 'count'),
                client_won_deals_6m=('IsWon', 'sum')
            ).reset_index()
            client_stats_6m['client_win_rate_6m'] = (client_stats_6m['client_won_deals_6m'] / client_stats_6m['client_total_deals_6m']).fillna(0)
        else:
            client_stats_6m = pd.DataFrame(columns=['Client', 'client_total_deals_6m', 'client_win_rate_6m'])
            
        # Merge stats
        merged_stats = pd.merge(client_stats, client_stats_3m[['Client', 'client_total_deals_3m', 'client_win_rate_3m']], on='Client', how='left')
        merged_stats = pd.merge(merged_stats, client_stats_6m[['Client', 'client_total_deals_6m', 'client_win_rate_6m']], on='Client', how='left')
        
        # Fill rolling rates with lifetime rates if missing
        merged_stats['client_win_rate_3m'] = merged_stats['client_win_rate_3m'].fillna(merged_stats['client_win_rate']).fillna(0.5)
        merged_stats['client_win_rate_6m'] = merged_stats['client_win_rate_6m'].fillna(merged_stats['client_win_rate']).fillna(0.5)
        merged_stats['client_total_deals_3m'] = merged_stats['client_total_deals_3m'].fillna(0)
        merged_stats['client_total_deals_6m'] = merged_stats['client_total_deals_6m'].fillna(0)
        
        merged_stats['Month Date dt'] = d
        client_features_list.append(merged_stats[[
            'Client', 'Month Date dt', 'client_win_rate', 'client_loss_rate', 'client_avg_size',
            'client_win_rate_3m', 'client_total_deals_3m', 'client_win_rate_6m', 'client_total_deals_6m'
        ]])
        
    client_features_df = pd.concat(client_features_list, ignore_index=True)
    
    # Merge back to snapshot dataframe
    snap_df = pd.merge(snap_df, client_features_df, on=['Client', 'Month Date dt'], how='left')
    
    # Fill missing values with defaults
    snap_df['client_win_rate'] = snap_df['client_win_rate'].fillna(0.5)
    snap_df['client_loss_rate'] = snap_df['client_loss_rate'].fillna(0.5)
    snap_df['client_avg_size'] = snap_df['client_avg_size'].fillna(snap_df['Unweighted_Amount'].mean())
    snap_df['client_win_rate_3m'] = snap_df['client_win_rate_3m'].fillna(0.5)
    snap_df['client_win_rate_6m'] = snap_df['client_win_rate_6m'].fillna(0.5)
    snap_df['client_total_deals_3m'] = snap_df['client_total_deals_3m'].fillna(0)
    snap_df['client_total_deals_6m'] = snap_df['client_total_deals_6m'].fillna(0)
    
    # --- 8. Targets (Labels) Builder ---
    print("Building target labels for classification and regression...")
    snap_df['Target_Outcome'] = snap_df['Opportunity Number'].map(lambda x: closed_mapping[x]['Outcome'] if x in closed_mapping else 'Open')
    snap_df['Actual_Closed_Date'] = snap_df['Opportunity Number'].map(lambda x: closed_mapping[x]['Closed Date dt'] if x in closed_mapping else pd.NaT)
    snap_df['Months_Until_Close'] = ((snap_df['Actual_Closed_Date'] - snap_df['Month Date dt']).dt.days / 30.4375).clip(lower=0)
    
    snap_df['Months_Until_Win'] = np.where(snap_df['Target_Outcome'] == 'Won', snap_df['Months_Until_Close'], np.nan)
    snap_df['Months_Until_Loss'] = np.where(snap_df['Target_Outcome'] == 'Lost', snap_df['Months_Until_Close'], np.nan)
    snap_df['Months_Until_Abandon'] = np.where(snap_df['Target_Outcome'] == 'Abandoned', snap_df['Months_Until_Close'], np.nan)
    
    def calculate_slippage(row):
        c = row['Actual_Closed_Date']
        e = row['Expected_Start_Date__c_dt']
        if pd.isna(c) or pd.isna(e):
            return 0
        return 1 if (c.year > e.year) or (c.year == e.year and c.month > e.month) else 0
        
    snap_df['Target_Slipped'] = snap_df.apply(calculate_slippage, axis=1)
    
    snap_df['Target_Next_Stage'] = snap_df.groupby('Opportunity Number')['Stage'].shift(-1)
    snap_df['Target_Next_Stage'] = snap_df['Target_Next_Stage'].fillna(
        snap_df['Target_Outcome'].map({'Won': '5. Won', 'Lost': '6. Lost', 'Abandoned': '7. Abandoned'}).fillna('Open')
    )
    
    # --- 9. Save Features DataFrame ---
    print("Saving optimized features...")
    snap_df.to_pickle(os.path.join(processed_dir, "opt_features_df.pkl"))
    print(f"Optimized features dataframe saved with shape: {snap_df.shape}")
    
    # --- 10. Save Active Prediction Set ---
    print("Engineering features for currently active opportunities...")
    latest_date = snap_df['Month Date dt'].max()
    active_features = snap_df[(snap_df['Month Date dt'] == latest_date) & (snap_df['Target_Outcome'] == 'Open')].copy()
    active_features.to_pickle(os.path.join(processed_dir, "opt_active_features_df.pkl"))
    print(f"Optimized active features dataframe saved with shape: {active_features.shape}")

if __name__ == "__main__":
    build_features()
