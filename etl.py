import pandas as pd
import json
import os
import urllib.request

print("Starting ETL Process for Parent Portal...")
csv_path = r"C:\Users\dhung\Downloads\dnpx-dfnc_version_40.csv"
print(f"Reading RAW data from {csv_path}...")

# 1. Load Data
df = pd.read_csv(csv_path, usecols=['dbn', 'metric_variable_name', 'metric_value'])
df['metric_value'] = pd.to_numeric(df['metric_value'], errors='coerce')
df = df.dropna(subset=['metric_value'])

# Extract district from DBN (first two characters)
df['district'] = df['dbn'].str[:2].astype(int)

print("Calculating District Averages...")

# Define the metrics we want for parents
metrics_map = {
    'prof_pct_watn5_mthlevel34': 'math',
    'prof_pct_watn5_elalevel34': 'reading',
    'grad_pct_watn8_level2': 'graduation'
}

parent_df = df[df['metric_variable_name'].isin(metrics_map.keys())].copy()
parent_df['metric_type'] = parent_df['metric_variable_name'].map(metrics_map)

# Group by district and metric type, calculate mean
district_agg = parent_df.groupby(['district', 'metric_type'])['metric_value'].mean().unstack().reset_index()

# Convert back to regular Python dict
metrics_dict = {}
for _, row in district_agg.iterrows():
    d_id = int(row['district'])
    metrics_dict[str(d_id)] = {
        "math": round(row['math'] * 100, 1) if not pd.isna(row['math']) else None,
        "reading": round(row['reading'] * 100, 1) if not pd.isna(row['reading']) else None,
        "graduation": round(row['graduation'] * 100, 1) if not pd.isna(row['graduation']) else None,
    }

# 2. Save JSON
os.makedirs("public", exist_ok=True)
with open("public/district_metrics.json", "w") as f:
    json.dump(metrics_dict, f)

# 3. Download GeoJSON
print("Downloading NYC School Districts GeoJSON...")
geojson_url = "https://raw.githubusercontent.com/dwillis/nyc-maps/master/school_districts.geojson"
urllib.request.urlretrieve(geojson_url, "public/districts.geojson")

print("ETL complete. JSON and GeoJSON files generated in /public")
