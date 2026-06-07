import unittest
import pandas as pd
import numpy as np
import os
import pickle

class TestPipeline(unittest.TestCase):
    
    def setUp(self):
        self.processed_dir = "processed_data"
        self.features_path = os.path.join(self.processed_dir, "features_df.pkl")
        self.active_features_path = os.path.join(self.processed_dir, "active_features_df.pkl")
        
    def test_file_existence(self):
        """
        Check that processed datasets and model training results exist.
        """
        self.assertTrue(os.path.exists(self.features_path), "features_df.pkl is missing")
        self.assertTrue(os.path.exists(self.active_features_path), "active_features_df.pkl is missing")
        
    def test_leakage_prevention(self):
        """
        Check that features do not contain future closed outcomes.
        """
        df = pd.read_pickle(self.features_path)
        
        # We must verify that no closed outcome fields bleed into the training features.
        # Check that target leakage fields are not part of the training feature columns.
        leakage_cols = ['Closed Date', 'Closed Value', 'IsClosed', 'IsWon']
        for col in leakage_cols:
            self.assertNotIn(col, df.columns, f"Potential data leakage: {col} is in dataframe columns")
            
        # Verify that for any opportunity, features at snapshot date S only use dates <= S
        # Since Opp_Age_Days is calculated using CreatedDate, check that age is always non-negative
        self.assertTrue((df['Opp_Age_Days'] >= 0).all(), "Opportunity age has negative values (possible date parse leakage)")
        
    def test_target_alignment(self):
        """
        Ensure classification targets only contain expected classes.
        """
        df = pd.read_pickle(self.features_path)
        trainable_df = df[df['Target_Outcome'] != 'Open']
        
        unique_outcomes = set(trainable_df['Target_Outcome'].unique())
        self.assertTrue(unique_outcomes.issubset({'Won', 'Lost', 'Abandoned'}), 
                        f"Unexpected outcomes in trainable dataset: {unique_outcomes}")
        
    def test_performance_metrics(self):
        """
        Verify that model training succeeded and achieved minimum ROC AUC threshold of 0.75.
        """
        results_path = os.path.join(self.processed_dir, "training_results.pkl")
        self.assertTrue(os.path.exists(results_path), "training_results.pkl is missing")
        
        with open(results_path, 'rb') as f:
            results = pickle.load(f)
            
        # Check ROC AUC for XGBoost on Iteration 3
        xgb_auc = results['Iteration 3']['XGBoost']['ROC AUC']
        self.assertGreaterEqual(xgb_auc, 0.75, f"XGBoost ROC AUC is below threshold: {xgb_auc:.4f}")
        print(f"XGBoost Iteration 3 Validation ROC AUC: {xgb_auc:.4f} (Threshold: >= 0.75)")

if __name__ == "__main__":
    unittest.main()
