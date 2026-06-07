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
    
    # Vectorized Stage Changes
    # Check if stage changed from previous row
    snap_df['stage_changed_flag'] = (snap_df['Stage'] != snap_df['Stage'].shift(1)).astype(int)
    # Set change to 0 if the opportunity number changed
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'stage_changed_flag'] = 0
    # Cumulative sum per opportunity
    snap_df['Num_Stage_Changes'] = snap_df.groupby('Opportunity Number')['stage_changed_flag'].cumsum()
    
    snap_df['Stage_Velocity'] = snap_df['Opp_Age_Days'] / (snap_df['Num_Stage_Changes'] + 1)
    
    # Time in Current Stage
    # Mark the start of each contiguous stage block
    snap_df['stage_block'] = (snap_df['Stage'] != snap_df['Stage'].shift(1)).astype(int)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'stage_block'] = 1
    snap_df['stage_block_id'] = snap_df.groupby('Opportunity Number')['stage_block'].cumsum()
    
    # Min date in this stage block
    earliest_dates = snap_df.groupby(['Opportunity Number', 'stage_block_id'])['Month Date dt'].transform('min')
    snap_df['Days_In_Current_Stage'] = (snap_df['Month Date dt'] - earliest_dates).dt.days.fillna(0).clip(lower=0)
    
    # Drop temp helper columns
    snap_df = snap_df.drop(columns=['stage_changed_flag', 'stage_block', 'stage_block_id'], errors='ignore')
    
    # --- 2. Running Value Features ---
    print("Computing running value features...")
    snap_df['Weighted_Amount'] = snap_df['Weighted Net Amount'].fillna(0)
    snap_df['Unweighted_Amount'] = snap_df['Un-Wtd Net Amount'].fillna(0)
    
    # Amount trends
    amount_diff = snap_df['Unweighted_Amount'] - snap_df.groupby('Opportunity Number')['Unweighted_Amount'].shift(1).fillna(0)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'Unweighted_Amount'] = 0 # reset shift diff
    snap_df['Amount_Growth_Trend'] = amount_diff.clip(lower=0)
    snap_df['Amount_Decline_Trend'] = (-amount_diff).clip(lower=0)
    
    # --- 3. Running Slippages ---
    print("Computing running slippages...")
    # Slipped if Expected Start Date is pushed out
    snap_df['slipped_flag'] = (snap_df['Expected_Start_Date__c_dt'] > snap_df['Expected_Start_Date__c_dt'].shift(1)).astype(int)
    snap_df.loc[snap_df['Opportunity Number'] != snap_df['Opportunity Number'].shift(1), 'slipped_flag'] = 0
    snap_df['Num_Slippages'] = snap_df.groupby('Opportunity Number')['slipped_flag'].cumsum()
    snap_df = snap_df.drop(columns=['slipped_flag'], errors='ignore')
    
    # --- 4. Dynamic Client Features (Time-Aware) ---
    print("Computing dynamic, time-aware client win/loss features...")
    # Get all unique month dates
    unique_dates = sorted(snap_df['Month Date dt'].unique())
    
    client_features_list = []
    for d in unique_dates:
        # Filter closed opportunities that closed strictly before date d
        closed_prior = closed_df[closed_df['Closed Date dt'] < d]
        
        if len(closed_prior) > 0:
            # Aggregate by client
            client_stats = closed_prior.groupby('Client').agg(
                client_total_deals=('Opportunity Number', 'count'),
                client_won_deals=('IsWon', 'sum'),
                client_total_val=('Closed Value', 'sum')
            ).reset_index()
            
            client_stats['client_win_rate'] = (client_stats['client_won_deals'] / client_stats['client_total_deals']).fillna(0)
            client_stats['client_loss_rate'] = (1 - client_stats['client_win_rate']).fillna(0)
            client_stats['client_avg_size'] = (client_stats['client_total_val'] / client_stats['client_total_deals']).fillna(0)
        else:
            client_stats = pd.DataFrame(columns=['Client', 'client_win_rate', 'client_loss_rate', 'client_avg_size'])
            
        client_stats['Month Date dt'] = d
        client_features_list.append(client_stats[['Client', 'Month Date dt', 'client_win_rate', 'client_loss_rate', 'client_avg_size']])
        
    client_features_df = pd.concat(client_features_list, ignore_index=True)
    
    # Merge back to snapshot
    snap_df = pd.merge(snap_df, client_features_df, on=['Client', 'Month Date dt'], how='left')
    
    # Fill missing client metrics with global defaults
    snap_df['client_win_rate'] = snap_df['client_win_rate'].fillna(0.5)
    snap_df['client_loss_rate'] = snap_df['client_loss_rate'].fillna(0.5)
    snap_df['client_avg_size'] = snap_df['client_avg_size'].fillna(snap_df['Unweighted_Amount'].mean())
    
    # --- 5. Targets (Labels) Builder ---
    print("Building target labels for classification and regression...")
    
    snap_df['Target_Outcome'] = snap_df['Opportunity Number'].map(lambda x: closed_mapping[x]['Outcome'] if x in closed_mapping else 'Open')
    
    # Extract actual closed dates
    snap_df['Actual_Closed_Date'] = snap_df['Opportunity Number'].map(lambda x: closed_mapping[x]['Closed Date dt'] if x in closed_mapping else pd.NaT)
    
    # Months until closure
    snap_df['Months_Until_Close'] = ((snap_df['Actual_Closed_Date'] - snap_df['Month Date dt']).dt.days / 30.4375).clip(lower=0)
    
    # Months Until Win / Loss / Abandon (separate fields)
    snap_df['Months_Until_Win'] = np.where(snap_df['Target_Outcome'] == 'Won', snap_df['Months_Until_Close'], np.nan)
    snap_df['Months_Until_Loss'] = np.where(snap_df['Target_Outcome'] == 'Lost', snap_df['Months_Until_Close'], np.nan)
    snap_df['Months_Until_Abandon'] = np.where(snap_df['Target_Outcome'] == 'Abandoned', snap_df['Months_Until_Close'], np.nan)
    
    # Forecast Slippage target
    # Slipped if Actual Closed Date month > Expected Start Date month
    def calculate_slippage(row):
        c = row['Actual_Closed_Date']
        e = row['Expected_Start_Date__c_dt']
        if pd.isna(c) or pd.isna(e):
            return 0
        return 1 if (c.year > e.year) or (c.year == e.year and c.month > e.month) else 0
        
    snap_df['Target_Slipped'] = snap_df.apply(calculate_slippage, axis=1)
    
    # Next Stage target
    snap_df['Target_Next_Stage'] = snap_df.groupby('Opportunity Number')['Stage'].shift(-1)
    # If next stage is NaN (it was the last snapshot record), we fill with the eventual closed stage
    snap_df['Target_Next_Stage'] = snap_df['Target_Next_Stage'].fillna(
        snap_df['Target_Outcome'].map({'Won': '5. Won', 'Lost': '6. Lost', 'Abandoned': '7. Abandoned'}).fillna('Open')
    )
    
    # --- 6. Save Features DataFrame ---
    print("Saving engineered features...")
    snap_df.to_pickle(os.path.join(processed_dir, "features_df.pkl"))
    print(f"Features dataframe saved with shape: {snap_df.shape}")
    
    # --- 7. Save Active Prediction Set ---
    print("Engineering features for currently active opportunities...")
    # Open opportunities are those in the snapshot at the latest Month Date where the target outcome is 'Open'
    latest_date = snap_df['Month Date dt'].max()
    active_features = snap_df[(snap_df['Month Date dt'] == latest_date) & (snap_df['Target_Outcome'] == 'Open')].copy()
    active_features.to_pickle(os.path.join(processed_dir, "active_features_df.pkl"))
    print(f"Active features dataframe saved with shape: {active_features.shape}")

if __name__ == "__main__":
    build_features()
