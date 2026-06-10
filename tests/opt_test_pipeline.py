import unittest
import pandas as pd
import numpy as np
import os

class TestOptimizedPipeline(unittest.TestCase):
    
    def setUp(self):
        self.processed_dir = "processed_data"
        self.features_path = os.path.join(self.processed_dir, "opt_features_df.pkl")
        self.active_features_path = os.path.join(self.processed_dir, "opt_active_features_df.pkl")
        self.excel_path = os.path.join("output", "opt_Opportunity_Forecasting_Evaluation.xlsx")
        
    def test_file_existence(self):
        """
        Check that optimized processed datasets and the final workbook exist.
        """
        self.assertTrue(os.path.exists(self.features_path), "opt_features_df.pkl is missing")
        self.assertTrue(os.path.exists(self.active_features_path), "opt_active_features_df.pkl is missing")
        self.assertTrue(os.path.exists(self.excel_path), "opt_Opportunity_Forecasting_Evaluation.xlsx is missing")
        
    def test_leakage_prevention(self):
        """
        Check that optimized features do not contain future closed outcomes or leak forward.
        """
        df = pd.read_pickle(self.features_path)
        
        leakage_cols = ['Closed Date', 'Closed Value', 'IsClosed', 'IsWon']
        for col in leakage_cols:
            self.assertNotIn(col, df.columns, f"Potential data leakage: {col} is in dataframe columns")
            
        self.assertTrue((df['Opp_Age_Days'] >= 0).all(), "Opportunity age has negative values")
        
    def test_target_alignment(self):
        """
        Ensure classification targets only contain expected classes.
        """
        df = pd.read_pickle(self.features_path)
        trainable_df = df[df['Target_Outcome'] != 'Open']
        
        unique_outcomes = set(trainable_df['Target_Outcome'].unique())
        self.assertTrue(unique_outcomes.issubset({'Won', 'Lost', 'Abandoned'}), 
                        f"Unexpected outcomes in trainable dataset: {unique_outcomes}")

if __name__ == "__main__":
    unittest.main()
