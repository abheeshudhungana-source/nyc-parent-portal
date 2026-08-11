import pandas as pd
import json
import urllib.parse

print("Fetching targeted time-series data directly from NYC Open Data API (SoQL)...")

# Define the exact 10 metrics we want
target_metrics = [
    'attendance_k8_all',
    'chronic_absent_ems_all',
    'grad_pct_4_all',
    'pct_cri_4yr_all',
    'lre_all',
    'attendance_hs_all',
    'chronic_absent_hs_all',
    'grad_pct_6_all',
    'pct_cer_6mo_vocat_all',
    'nondropout_4_all'
]

# Use Socrata Query Language (SoQL) to download ONLY the rows we care about
# This reduces the download from 1.2 Million rows (300MB) to just a few thousand rows instantly!
metrics_str = ",".join([f"'{m}'" for m in target_metrics])
soql_query = f"""
    SELECT school_year, dbn, metric_variable_name, metric_value 
    WHERE metric_variable_name IN ({metrics_str}) 
    LIMIT 100000
"""

# Encode the SoQL query into the API URL
api_url = f"https://data.cityofnewyork.us/resource/dnpx-dfnc.csv?$query={urllib.parse.quote(soql_query)}"

# 1. Load Data (This will now be instantly fast)
df = pd.read_csv(api_url)

df = df.rename(columns={
    'school_year': 'year',
    'metric_variable_name': 'metric',
    'metric_value': 'value'
})

df['value'] = pd.to_numeric(df['value'], errors='coerce')
df = df.dropna(subset=['value'])

# 2. Extract Borough from DBN (3rd character)
borough_map = {'M': 'Manhattan', 'X': 'Bronx', 'K': 'Brooklyn', 'Q': 'Queens', 'R': 'Staten Island'}
df['borough_code'] = df['dbn'].str[2:3]
df['borough'] = df['borough_code'].map(borough_map)
df = df.dropna(subset=['borough'])

# 3. Aggregate by Year, Borough, and Metric
grouped = df.groupby(['year', 'borough', 'metric'])['value'].mean().reset_index()

# 4. Restructure into nested JSON for the React UI
output = {}
for metric in target_metrics:
    metric_df = grouped[grouped['metric'] == metric]
    years = sorted(metric_df['year'].unique().tolist())
    
    output[metric] = {
        "years": years,
        "Manhattan": [],
        "Bronx": [],
        "Brooklyn": [],
        "Queens": [],
        "Staten Island": []
    }
    
    for boro in output[metric].keys():
        if boro == "years": continue
        boro_df = metric_df[metric_df['borough'] == boro]
        
        vals = []
        for y in years:
            row = boro_df[boro_df['year'] == y]
            if not row.empty:
                vals.append(round(row['value'].values[0], 4))
            else:
                vals.append(None)
        
        output[metric][boro] = vals

with open('public/borough_timeseries.json', 'w') as f:
    json.dump(output, f, indent=2)

print("Exported to public/borough_timeseries.json instantly!")
