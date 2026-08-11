const targetMetrics = [
  'nondropout_4_all', 'pct_cer_6mo_vocat_all', 'grad_pct_4_all', 'grad_pct_6_all',
  'attendance_k8_all', 'chronic_absent_ems_all', 'attendance_hs_all', 'chronic_absent_hs_all',
  'pct_cri_4yr_all', 'lre_all'
];
const metricsStr = targetMetrics.map(m => `'${m}'`).join(',');
const soql = `SELECT school_year, dbn, metric_variable_name, metric_value WHERE metric_variable_name IN (${metricsStr}) LIMIT 100000`;
const url = `https://data.cityofnewyork.us/resource/dnpx-dfnc.json?$query=${encodeURIComponent(soql)}`;

console.log("Fetching from:", url);

fetch(url)
  .then(res => res.json())
  .then(rows => {
    console.log("Rows fetched:", rows.length);
    const boroughMap = {'M': 'Manhattan', 'X': 'Bronx', 'K': 'Brooklyn', 'Q': 'Queens', 'R': 'Staten Island'};
    const processed = {};
    
    targetMetrics.forEach(m => {
      processed[m] = { years: new Set(), Manhattan: {}, Bronx: {}, Brooklyn: {}, Queens: {}, 'Staten Island': {} };
    });

    rows.forEach(row => {
      const boroCode = row.dbn.substring(2, 3);
      const boro = boroughMap[boroCode];
      if (!boro) return;
      
      const metric = row.metric_variable_name;
      const year = row.school_year;
      const val = parseFloat(row.metric_value);
      
      if (!isNaN(val) && processed[metric]) {
        processed[metric].years.add(year);
        if (!processed[metric][boro][year]) processed[metric][boro][year] = [];
        processed[metric][boro][year].push(val);
      }
    });

    // average the values
    const finalData = {};
    targetMetrics.forEach(m => {
      const yearsArray = Array.from(processed[m].years).sort();
      finalData[m] = { years: yearsArray };
      ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'].forEach(boro => {
        finalData[m][boro] = yearsArray.map(y => {
          const vals = processed[m][boro][y];
          if (!vals || vals.length === 0) return null;
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          return Math.round(avg * 10000) / 10000;
        });
      });
    });

    console.log("Sample Output:", JSON.stringify(finalData['nondropout_4_all'], null, 2));
  })
  .catch(err => console.error("Error loading time series data", err));
