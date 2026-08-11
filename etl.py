import pandas as pd
import json
import os
import urllib.request

print("Starting ETL Process for Parent Portal...")
api_url = "https://data.cityofnewyork.us/api/views/dnpx-dfnc/rows.csv?accessType=DOWNLOAD"
print(f"Fetching LIVE data directly from NYC Open Data API: {api_url}...")

# 1. Load Data
df = pd.read_csv(api_url, usecols=['District, Borough and School Number (DBN)', 'Metric Variable Name', 'Metric Value'])
df = df.rename(columns={
    'District, Borough and School Number (DBN)': 'dbn',
    'Metric Variable Name': 'metric_variable_name',
    'Metric Value': 'metric_value'
})
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
