import pandas as pd
import numpy as np
import os
import pickle

def parse_excel_date(series):
    """
    Robustly parses a pandas series containing dates.
    Handles numeric Excel serial dates, standard string dates, and NaN values.
    """
    s = series.copy()
    
    def convert_val(val):
        if pd.isna(val):
            return pd.NaT
        try:
            # If it looks like a number, convert Excel serial
            num = float(val)
            if num > 0:
                return pd.to_datetime(num, unit='D', origin='1899-12-30')
        except (ValueError, TypeError):
            pass
        
        # Otherwise, try parsing as string
        try:
            return pd.to_datetime(val, errors='coerce')
        except:
            return pd.NaT

    return s.apply(convert_val)

def preprocess_data(raw_dir="raw_data", processed_dir="processed_data"):
    os.makedirs(processed_dir, exist_ok=True)
    
    # Define paths
    snap_path = os.path.join(raw_dir, "20260606", "Comm Rptg _ ERM Pipeline Snapshot Data for GC _ 06.04.2026.xlsb")
    closed_path = os.path.join(raw_dir, "20260606", "Comm Rptg _ ERM Closed Pipeline Data for GC _ 06.04.2026.xlsb")
    active_path = os.path.join(raw_dir, "20260527", "Comm Rptg _ ERM Opportunity Data for GC _ 05.25.2026.xlsb")
    
    print(f"Loading open pipeline snapshots from: {snap_path}")
    snap_df = pd.read_excel(snap_path, engine='pyxlsb')
    print(f"Loaded snapshot shape: {snap_df.shape}")
    
    print(f"Loading closed pipeline data from: {closed_path}")
    closed_df = pd.read_excel(closed_path, engine='pyxlsb')
    print(f"Loaded closed shape: {closed_df.shape}")
    
    print(f"Loading active pipeline data from: {active_path}")
    active_df = pd.read_excel(active_path, engine='pyxlsb')
    print(f"Loaded active shape: {active_df.shape}")
    
    # Clean date columns
    print("Parsing date columns...")
    snap_df['Month Date dt'] = parse_excel_date(snap_df['Month Date'])
    snap_df['Expected_Start_Date__c_dt'] = parse_excel_date(snap_df['Expected_Start_Date__c'])
    snap_df['CreatedDate_dt'] = parse_excel_date(snap_df['CreatedDate'])
    
    closed_df['Closed Date dt'] = parse_excel_date(closed_df['Closed Date'])
    closed_df['Created Date dt'] = parse_excel_date(closed_df['Created Date'])
    
    active_df['Month Date dt'] = parse_excel_date(active_df['Month Date'])
    active_df['Expected_Start_Date__c_dt'] = parse_excel_date(active_df['Expected_Start_Date__c'])
    active_df['CreatedDate_dt'] = parse_excel_date(active_df['CreatedDate'])
    
    # Create labels mapping from closed opportunities
    print("Creating mappings from closed opportunities...")
    outcome_map = {
        '5. Won': 'Won',
        '6. Lost': 'Lost',
        '7. Abandoned': 'Abandoned'
    }
    
    closed_df['Outcome'] = closed_df['Stage'].map(outcome_map)
    
    # Map from Opportunity Number to closure information
    closed_mapping = closed_df.set_index('Opportunity Number')[['Outcome', 'Closed Date dt', 'Closed Value']].to_dict('index')
    
    # Save the processed dataframes and dictionary
    print("Saving preprocessed files...")
    with open(os.path.join(processed_dir, "closed_mapping.pkl"), "wb") as f:
        pickle.dump(closed_mapping, f)
        
    snap_df.to_pickle(os.path.join(processed_dir, "snap_df.pkl"))
    closed_df.to_pickle(os.path.join(processed_dir, "closed_df.pkl"))
    active_df.to_pickle(os.path.join(processed_dir, "active_df.pkl"))
    
    print("Preprocessing completed successfully!")

if __name__ == "__main__":
    preprocess_data()
