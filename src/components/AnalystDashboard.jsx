import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

const METRICS = {
  academics: [
    { id: 'nondropout_4_all', title: '4-Year Non-Dropout Rate' },
    { id: 'pct_cer_6mo_vocat_all', title: 'Vocational Certification (6 mo)' },
    { id: 'grad_pct_4_all', title: '4-Year Graduation Rate' },
    { id: 'grad_pct_6_all', title: '6-Year Graduation Rate' }
  ],
  engagement: [
    { id: 'attendance_k8_all', title: 'Average Student Attendance (K-8)' },
    { id: 'chronic_absent_ems_all', title: 'Chronic Absenteeism (EMS)' },
    { id: 'attendance_hs_all', title: 'Average Student Attendance (HS)' },
    { id: 'chronic_absent_hs_all', title: 'Chronic Absenteeism (HS)' }
  ],
  demographics: [
    { id: 'pct_cri_4yr_all', title: 'College Readiness Index (4-Year)' },
    { id: 'lre_all', title: 'Disabilities - Less Restrictive Environments' }
  ]
};

export default function AnalystDashboard() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('academics');
  const [selectedBoroughs, setSelectedBoroughs] = useState(['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']);

  useEffect(() => {
    const targetMetrics = [
      'nondropout_4_all', 'pct_cer_6mo_vocat_all', 'grad_pct_4_all', 'grad_pct_6_all',
      'attendance_k8_all', 'chronic_absent_ems_all', 'attendance_hs_all', 'chronic_absent_hs_all',
      'pct_cri_4yr_all', 'lre_all'
    ];
    const metricsStr = targetMetrics.map(m => `'${m}'`).join(',');
    const soql = `SELECT school_year, dbn, metric_variable_name, metric_value WHERE metric_variable_name IN (${metricsStr}) LIMIT 100000`;
    const url = `https://data.cityofnewyork.us/resource/dnpx-dfnc.json?$query=${encodeURIComponent(soql)}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`API returned status: ${res.status}`);
        return res.json();
      })
      .then(rows => {
        if (!Array.isArray(rows)) throw new Error("API did not return an array of rows");
        const boroughMap = {'M': 'Manhattan', 'X': 'Bronx', 'K': 'Brooklyn', 'Q': 'Queens', 'R': 'Staten Island'};
        const processed = {};
        
        targetMetrics.forEach(m => {
          processed[m] = { years: new Set(), Manhattan: {}, Bronx: {}, Brooklyn: {}, Queens: {}, 'Staten Island': {} };
        });

        rows.forEach(row => {
          if (!row.dbn) return;
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

        setData(finalData);
      })
      .catch(err => {
        console.error("Live fetch failed, attempting fallback to static JSON:", err);
        fetch('/borough_timeseries.json')
          .then(res => res.json())
          .then(json => setData(json))
          .catch(fallbackErr => {
            console.error("Fallback also failed:", fallbackErr);
            setData({}); // set to empty object to remove loading screen
          });
      });
  }, []);

  if (!data) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f4f7f6' }}>
        <style>{`
          @keyframes pulse-ring {
            0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(52, 152, 219, 0); }
            100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(52, 152, 219, 0); }
          }
        `}</style>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#3498db',
          animation: 'pulse-ring 1.5s infinite',
          marginBottom: '25px'
        }}></div>
        <div style={{ fontSize: '1.4em', color: '#2c3e50', fontWeight: 'bold' }}>Loading Time-Series Data...</div>
        <div style={{ fontSize: '1em', color: '#7f8c8d', marginTop: '8px' }}>Fetching live metrics from NYC Open Data</div>
      </div>
    );
  }

  const renderPlot = (metricId, title) => {
    const metricData = data[metricId];
    if (!metricData) {
      return (
        <div key={metricId} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>{title}</h3>
          <p style={{ color: '#888' }}>Data not available in API.</p>
        </div>
      );
    }

    const boroughs = ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'];
    const colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'];
    
    const traces = boroughs.map((boro, i) => {
      if (!selectedBoroughs.includes(boro)) return null;
      return {
        x: metricData.years,
        y: metricData[boro],
        type: 'scatter',
        mode: 'lines+markers',
        name: boro,
        line: { color: colors[i], width: 3 },
        marker: { size: 8 }
      };
    }).filter(Boolean);

    return (
      <div key={metricId} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>{title}</h3>
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height: 400,
            margin: { t: 20, r: 20, b: 40, l: 50 },
            xaxis: { title: 'School Year', tickformat: 'd' },
            yaxis: { title: 'Value' },
            legend: { orientation: 'h', y: -0.2 }
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  };

  return (
    <div style={{ padding: '40px', backgroundColor: '#f4f7f6', minHeight: '100vh' }}>
      <h1 style={{ fontSize: '2.5em', color: '#2c3e50', margin: '0 0 10px' }}>Analyst Dashboard</h1>
      <p style={{ color: '#7f8c8d', fontSize: '1.1em', marginBottom: '30px' }}>Time-Series Borough Analysis. Click legend items to isolate or compare boroughs.</p>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '40px' }}>
        {Object.keys(METRICS).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 24px',
              fontSize: '1.1em',
              fontWeight: 'bold',
              textTransform: 'capitalize',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === tab ? '#3498db' : '#e0e6ed',
              color: activeTab === tab ? 'white' : '#7f8c8d',
              transition: 'all 0.2s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* BOROUGH FILTER */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h3 style={{ margin: '0 0 15px', color: '#2c3e50', fontSize: '1.1em' }}>Filter Boroughs (Applies to all graphs)</h3>
        <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', alignItems: 'center' }}>
          {['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'].map(boro => (
            <label key={boro} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1.05em', color: '#34495e' }}>
              <input 
                type="checkbox" 
                checked={selectedBoroughs.includes(boro)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedBoroughs([...selectedBoroughs, boro]);
                  } else {
                    setSelectedBoroughs(selectedBoroughs.filter(b => b !== boro));
                  }
                }}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              {boro}
            </label>
          ))}
          <button 
            onClick={() => setSelectedBoroughs(['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'])}
            style={{ 
              marginLeft: 'auto', padding: '8px 16px', borderRadius: '6px', 
              border: '1px solid #bdc3c7', background: '#ecf0f1', color: '#2c3e50',
              cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#bdc3c7'}
            onMouseOut={(e) => e.target.style.background = '#ecf0f1'}
          >
            Select All
          </button>
        </div>
      </div>

      {/* GRAPHS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '30px' }}>
        {METRICS[activeTab].map(m => renderPlot(m.id, m.title))}
      </div>
    </div>
  );
}
