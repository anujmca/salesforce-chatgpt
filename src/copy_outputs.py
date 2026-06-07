import os
import shutil

scratch_dir = r"C:\Users\anujm\.gemini\antigravity-ide\scratch"
output_dir = "output"
web_data_dir = r"web\data"

os.makedirs(output_dir, exist_ok=True)
os.makedirs(web_data_dir, exist_ok=True)

# Define file copy mapping
copies = {
    # CSV files
    "opportunity_predictions.csv": os.path.join(output_dir, "opportunity_predictions.csv"),
    "monthly_forecast.csv": os.path.join(output_dir, "monthly_forecast.csv"),
    "model_performance.csv": os.path.join(output_dir, "model_performance.csv"),
    "stage_movement.csv": os.path.join(output_dir, "stage_movement.csv"),
    
    # JSON files
    "predictions.json": os.path.join(web_data_dir, "predictions.json"),
    "monthly_forecast.json": os.path.join(web_data_dir, "monthly_forecast.json"),
    "model_performance.json": os.path.join(web_data_dir, "model_performance.json"),
    "stage_movement.json": os.path.join(web_data_dir, "stage_movement.json"),
    "feature_importance.json": os.path.join(web_data_dir, "feature_importance.json"),
    "shap_summary.json": os.path.join(web_data_dir, "shap_summary.json"),
}

print("Copying outputs from scratch to workspace...")
for src_name, dst_path in copies.items():
    src_path = os.path.join(scratch_dir, src_name)
    if os.path.exists(src_path):
        shutil.copy(src_path, dst_path)
        print(f"  Copied {src_name} -> {dst_path} (size: {os.path.getsize(dst_path)} bytes)")
    else:
        print(f"  Warning: {src_name} not found in scratch folder!")

print("Workspace copying complete!")
