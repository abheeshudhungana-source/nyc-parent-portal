import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';

const CURATED_METRICS = {
  academics: [
    { id: 'nondropout_4_all', title: '4-Year Non-Dropout Rate' },
    { id: 'pct_cer_6mo_vocat_all', title: 'Vocational Certification (6 mo)' },
    { id: 'grad_pct_4_all', title: '4-Year Graduation Rate' },
    { id: 'grad_pct_6_all', title: '6-Year Graduation Rate' },
    { id: 'ele_core_all', title: 'MS Core Course Pass Rate' },
    { id: 'pct_accel_p_all', title: '8th Grader Accelerated Pass Rate' }
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

const SCHOOL_TYPES = [
  "All",
  "High School",
  "High School Transfer",
  "Elementary",
  "Middle",
  "K-8",
  "D75"
];

export default function AnalystDashboard() {
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('academics');
  const [selectedBoroughs, setSelectedBoroughs] = useState(['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island']);
  const [selectedSchoolType, setSelectedSchoolType] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  // Explorer State
  const [explorerMetricsList, setExplorerMetricsList] = useState([]);
  const [explorerSelectedMetric, setExplorerSelectedMetric] = useState('');

  // Fetch Curated Metrics Data
  useEffect(() => {
    setIsLoading(true);
    const targetMetrics = Object.values(CURATED_METRICS).flatMap(cat => cat.map(m => m.id));
    
    // Always fetch explorer metric if selected, so we don't lose it on school type change
    if (explorerSelectedMetric && !targetMetrics.includes(explorerSelectedMetric)) {
      targetMetrics.push(explorerSelectedMetric);
    }

    const metricsStr = targetMetrics.map(m => `'${m}'`).join(',');
    let soql = `SELECT school_year, dbn, metric_variable_name, metric_value, number_of_students WHERE metric_variable_name IN (${metricsStr})`;
    
    if (selectedSchoolType !== 'All') {
      soql += ` AND school_type = '${selectedSchoolType}'`;
    }
    
    soql += ` LIMIT 200000`;
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
          const weight = parseInt(row.number_of_students, 10);
          
          if (!isNaN(val) && !isNaN(weight) && weight > 0 && processed[metric]) {
            processed[metric].years.add(year);
            if (!processed[metric][boro][year]) {
              processed[metric][boro][year] = { sumWeightedValues: 0, totalWeight: 0 };
            }
            processed[metric][boro][year].sumWeightedValues += (val * weight);
            processed[metric][boro][year].totalWeight += weight;
          }
        });

        const finalData = {};
        targetMetrics.forEach(m => {
          const yearsArray = Array.from(processed[m].years).sort();
          finalData[m] = { years: yearsArray };
          ['Manhattan', 'Bronx', 'Brooklyn', 'Queens', 'Staten Island'].forEach(boro => {
            finalData[m][boro] = yearsArray.map(y => {
              const boroYearData = processed[m][boro][y];
              if (!boroYearData || boroYearData.totalWeight === 0) return null;
              const weightedAvg = boroYearData.sumWeightedValues / boroYearData.totalWeight;
              return Math.round(weightedAvg * 10000) / 10000;
            });
          });
        });

        setData(finalData);
        setIsLoading(false);
      })
      .catch(err => {
        console.error("Live fetch failed:", err);
        if (selectedSchoolType === 'All') {
           // fallback to json if default filter
           fetch('/borough_timeseries.json')
            .then(res => res.json())
            .then(json => {
              setData(json);
              setIsLoading(false);
            })
            .catch(() => {
              setData({});
              setIsLoading(false);
            });
        } else {
          setData({});
          setIsLoading(false);
        }
      });
  }, [selectedSchoolType, explorerSelectedMetric]);

  // Fetch Full Metric Catalog for Explorer
  useEffect(() => {
    if (activeTab === 'explorer' && explorerMetricsList.length === 0) {
      const soql = `SELECT metric_variable_name, metric_display_name GROUP BY metric_variable_name, metric_display_name LIMIT 2000`;
      const url = `https://data.cityofnewyork.us/resource/dnpx-dfnc.json?$query=${encodeURIComponent(soql)}`;
      fetch(url)
        .then(res => res.json())
        .then(rows => {
          const formatted = rows
            .filter(r => r.metric_variable_name && r.metric_display_name)
            .map(r => ({
              id: r.metric_variable_name,
              title: r.metric_display_name
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
          
          setExplorerMetricsList(formatted);
          if (formatted.length > 0 && !explorerSelectedMetric) {
            setExplorerSelectedMetric(formatted[0].id);
          }
        })
        .catch(err => console.error("Failed to fetch metric catalog:", err));
    }
  }, [activeTab, explorerMetricsList.length, explorerSelectedMetric]);

  if (isLoading && !data) {
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
    const metricData = data && data[metricId];
    if (!metricData) {
      return (
        <div key={metricId} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '10px', color: '#333' }}>{title}</h3>
          <p style={{ color: '#888' }}>Data not available for selected filters.</p>
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

    const getTooltipText = (id) => {
      if (id.includes('chronic_absent')) {
        return "Definition: The percentage of students missing 10% or more of enrolled school days.";
      } else if (id.includes('lre')) {
        return "Least Restrictive Environment: Higher % means more students with disabilities are integrated into general education classrooms.";
      }
      return "Weighted average based on student population.";
    };

    return (
      <div key={metricId} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ margin: 0, color: '#333' }}>{title}</h3>
          <div 
            title={getTooltipText(metricId)}
            style={{ 
              marginLeft: '10px', width: '18px', height: '18px', borderRadius: '50%', 
              backgroundColor: '#ecf0f1', color: '#7f8c8d', fontSize: '12px', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'help'
            }}
          >
            ?
          </div>
        </div>
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

      {/* FILTER PANEL */}
      <div style={{ marginBottom: '30px', padding: '25px', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', display: 'flex', flexWrap: 'wrap', gap: '40px' }}>
        
        {/* BOROUGH FILTER */}
        <div style={{ flex: '1 1 500px' }}>
          <h3 style={{ margin: '0 0 15px', color: '#2c3e50', fontSize: '1.1em' }}>Filter Boroughs</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                padding: '8px 16px', borderRadius: '6px', 
                border: '1px solid #bdc3c7', background: '#ecf0f1', color: '#2c3e50',
                cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s'
              }}
            >
              Select All
            </button>
          </div>
        </div>

        {/* SCHOOL TYPE FILTER */}
        <div style={{ flex: '1 1 300px' }}>
          <h3 style={{ margin: '0 0 15px', color: '#2c3e50', fontSize: '1.1em' }}>School Type</h3>
          <select 
            value={selectedSchoolType}
            onChange={(e) => setSelectedSchoolType(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: '1.05em',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SCHOOL_TYPES.map(type => (
              <option key={type} value={type}>{type === 'All' ? 'All School Types' : type}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
        {Object.keys(CURATED_METRICS).concat(['explorer']).map(tab => (
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
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tab === 'explorer' ? '🔍 Metric Explorer' : tab}
          </button>
        ))}
      </div>

      {isLoading && data && (
        <div style={{ padding: '20px', backgroundColor: '#e8f4fd', color: '#2980b9', borderRadius: '8px', marginBottom: '30px', fontWeight: 'bold' }}>
          Refreshing data for selected filters...
        </div>
      )}

      {/* GRAPHS */}
      {activeTab === 'explorer' ? (
        <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Discover Metrics</h2>
          <p style={{ color: '#7f8c8d', marginBottom: '20px' }}>Select from the full catalog of hundreds of available NYC school metrics.</p>
          
          {explorerMetricsList.length === 0 ? (
            <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <style>{`
                @keyframes scan-laser {
                  0% { left: -10%; }
                  50% { left: 100%; }
                  100% { left: -10%; }
                }
              `}</style>
              <div style={{ position: 'relative', width: '250px', height: '100px', overflow: 'hidden', borderBottom: '2px solid #cbd5e1' }}>
                <svg viewBox="0 0 200 100" width="100%" height="100%" preserveAspectRatio="none">
                  {/* NYC Skyline Path */}
                  <path d="M 0 100 L 0 75 L 15 75 L 15 50 L 30 50 L 30 65 L 45 65 L 45 35 L 55 35 L 55 25 L 65 25 L 65 35 L 75 35 L 75 60 L 90 60 L 90 20 L 98 20 L 98 10 L 100 0 L 102 10 L 102 20 L 110 20 L 110 50 L 125 50 L 125 40 L 145 40 L 145 70 L 160 70 L 160 85 L 180 85 L 180 65 L 200 65 L 200 100 Z" fill="#94a3b8" />
                </svg>
                {/* Scanning Laser */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: 'rgba(52, 152, 219, 0.9)',
                  boxShadow: '0 0 15px 2px rgba(52, 152, 219, 0.8)',
                  animation: 'scan-laser 2s ease-in-out infinite'
                }} />
              </div>
              <div style={{ marginTop: '20px', fontSize: '1.2em', color: '#334155', fontWeight: 'bold' }}>Scanning NYC OpenData...</div>
              <div style={{ color: '#64748b', marginTop: '5px' }}>Compiling full metric catalog</div>
            </div>
          ) : (
            <div style={{ marginBottom: '30px' }}>
              <select
                value={explorerSelectedMetric}
                onChange={(e) => setExplorerSelectedMetric(e.target.value)}
                style={{
                  width: '100%',
                  maxWidth: '800px',
                  padding: '15px',
                  fontSize: '1.1em',
                  borderRadius: '8px',
                  border: '2px solid #3498db',
                  backgroundColor: '#f8fafc',
                  color: '#2c3e50',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {explorerMetricsList.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          {explorerSelectedMetric && renderPlot(
             explorerSelectedMetric, 
             explorerMetricsList.find(m => m.id === explorerSelectedMetric)?.title || explorerSelectedMetric
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: '30px' }}>
          {CURATED_METRICS[activeTab].map(m => renderPlot(m.id, m.title))}
        </div>
      )}

    </div>
  );
}
