import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { BookOpen, GraduationCap, Calculator } from 'lucide-react';

const METRIC_CONFIG = {
  math: { min: 200, max: 800, suffix: '', title: 'Math SAT Score', apiVar: 'mean_score_sat_math_all' },
  reading: { min: 200, max: 800, suffix: '', title: 'Reading SAT Score', apiVar: 'mean_score_sat_writ_all' },
  graduation: { min: 0, max: 100, suffix: '%', title: 'Graduation Rate', apiVar: 'grad_pct_4_all' }
};

export default function HighSchoolDashboard() {
  const [geojson, setGeojson] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [mapMetric, setMapMetric] = useState('graduation'); // 'math', 'reading', or 'graduation'
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  useEffect(() => {
    fetch('/districts.geojson').then(r => r.json()).then(setGeojson);

    const metricsToFetch = ['mean_score_sat_math_all', 'mean_score_sat_writ_all', 'grad_pct_4_all'];
    const metricsStr = metricsToFetch.map(m => `'${m}'`).join(',');
    const soql = `SELECT dbn, school_type, metric_variable_name, metric_value, number_of_students WHERE metric_variable_name IN (${metricsStr}) AND dbn IS NOT NULL LIMIT 200000`;
    const url = `https://data.cityofnewyork.us/resource/dnpx-dfnc.json?$query=${encodeURIComponent(soql)}`;
    
    fetch(url).then(r => r.json()).then(setRawData);
  }, []);

  useEffect(() => {
    if (!rawData) return;

    // Filter to only High School and related types
    const allowedTypes = ['High School', 'High School Transfer', 'YABC'];

    const districtAgg = {};

    rawData.forEach(row => {
      if (!allowedTypes.includes(row.school_type)) return;

      const dist = row.dbn.substring(0, 2);
      if (!districtAgg[dist]) districtAgg[dist] = {};
      
      const metric = row.metric_variable_name;
      const val = parseFloat(row.metric_value);
      const wt = parseInt(row.number_of_students, 10);
      
      if (!isNaN(val) && !isNaN(wt)) {
        if (!districtAgg[dist][metric]) districtAgg[dist][metric] = { sum: 0, weight: 0 };
        districtAgg[dist][metric].sum += val * wt;
        districtAgg[dist][metric].weight += wt;
      }
    });

    const finalMetrics = {};
    Object.keys(districtAgg).forEach(dist => {
      const getVal = (mName) => {
        const obj = districtAgg[dist][mName];
        if (!obj || obj.weight === 0) return null;
        let rawVal = obj.sum / obj.weight;
        if (mName === 'grad_pct_4_all') rawVal *= 100;
        return parseFloat(rawVal.toFixed(1));
      };

      finalMetrics[dist] = {
        math: getVal('mean_score_sat_math_all'),
        reading: getVal('mean_score_sat_writ_all'),
        graduation: getVal('grad_pct_4_all')
      };
    });

    setMetrics(finalMetrics);
    
    if (selectedDistrict) {
      setSelectedDistrict(prev => ({
        id: prev.id,
        ...(finalMetrics[prev.id] || { math: null, reading: null, graduation: null })
      }));
    }
  }, [rawData]);

  if (!geojson || !metrics) return <div style={{ padding: 20 }}>Loading map data...</div>;

  const locations = [];
  const zValues = [];
  const textLabels = [];

  geojson.features.forEach(f => {
    const distId = String(f.properties.schoolDist).padStart(2, '0');
    const data = metrics[distId];
    if (data) {
      locations.push(distId);
      zValues.push(data[mapMetric]);
      
      const mStr = data.math !== null && data.math !== undefined ? `${data.math}` : 'N/A';
      const rStr = data.reading !== null && data.reading !== undefined ? `${data.reading}` : 'N/A';
      const gStr = data.graduation !== null && data.graduation !== undefined ? `${data.graduation}%` : 'N/A';
      textLabels.push(`District ${distId}<br>Math SAT: ${mStr}<br>Reading SAT: ${rStr}<br>Graduation: ${gStr}`);
    }
  });

  const config = METRIC_CONFIG[mapMetric];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      
      {/* LEFT: MAP */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* High School Map Header */}
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: 'white', padding: '15px 25px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: '1.5em', color: '#333' }}>High Schools</h1>
          <p style={{ margin: '5px 0 0', color: '#666', fontSize: '0.9em' }}>Click any district for a Report Card</p>
        </div>

        {/* Filters */}
        <div style={{ position: 'absolute', top: 110, left: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          <div style={{ backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <label style={{ display: 'block', fontSize: '0.85em', fontWeight: 'bold', color: '#666', marginBottom: '5px' }}>
              Select Metric:
            </label>
            <select 
              value={mapMetric} 
              onChange={e => setMapMetric(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="math">Math SAT Score</option>
              <option value="reading">Reading SAT Score</option>
              <option value="graduation">Graduation Rate %</option>
            </select>
          </div>
          
        </div>

        <Plot
          data={[{
            type: 'choroplethmapbox',
            geojson: geojson,
            locations: locations,
            z: zValues,
            featureidkey: 'properties.schoolDist',
            colorscale: 'Viridis',
            zmin: config.min,
            zmax: config.max,
            marker: { opacity: 0.7, line: { width: 1, color: 'white' } },
            text: textLabels,
            hoverinfo: 'text',
            colorbar: {
              title: config.title,
              thickness: 20,
              len: 0.5,
              ticksuffix: config.suffix
            }
          }]}
          layout={{
            mapbox: {
              style: 'carto-positron',
              center: { lon: -73.97, lat: 40.70 },
              zoom: 9.5
            },
            margin: { l: 0, r: 0, t: 0, b: 0 },
            autosize: true
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          onClick={(data) => {
            if (data.points && data.points.length > 0) {
              const distId = data.points[0].location;
              const distData = metrics[distId];
              setSelectedDistrict({ id: distId, ...distData });
            }
          }}
        />
      </div>

      {/* RIGHT: DETAILS PANEL */}
      <div style={{ width: '400px', backgroundColor: '#f8f9fa', borderLeft: '1px solid #e9ecef', padding: '30px', overflowY: 'auto' }}>
        {!selectedDistrict ? (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#adb5bd', textAlign: 'center' }}>
            <h2>Select a district on the map<br/>to view details</h2>
          </div>
        ) : (
          <div>
            <div style={{ borderBottom: '2px solid #3498db', paddingBottom: '15px', marginBottom: '25px' }}>
              <h2 style={{ margin: 0, fontSize: '2em', color: '#2c3e50' }}>District {selectedDistrict.id}</h2>
              <span style={{ display: 'inline-block', backgroundColor: '#e1f0fa', color: '#3498db', padding: '4px 10px', borderRadius: '15px', fontSize: '0.85em', fontWeight: 'bold', marginTop: '10px' }}>
                High Schools Only
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <MetricCard 
                icon={<Calculator size={24} color="#007bff" />} 
                title={METRIC_CONFIG.math.title}
                value={selectedDistrict.math} 
                suffix={METRIC_CONFIG.math.suffix}
              />
              
              <MetricCard 
                icon={<BookOpen size={24} color="#2ca02c" />} 
                title={METRIC_CONFIG.reading.title}
                value={selectedDistrict.reading} 
                suffix={METRIC_CONFIG.reading.suffix}
              />
              
              <MetricCard 
                icon={<GraduationCap size={24} color="#d62728" />} 
                title={METRIC_CONFIG.graduation.title}
                value={selectedDistrict.graduation} 
                suffix={METRIC_CONFIG.graduation.suffix}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable Metric Card Component
function MetricCard({ icon, title, value, suffix }) {
  const displayVal = value !== null && value !== undefined ? `${value}${suffix}` : 'No Data';
  
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ backgroundColor: '#f1f3f5', padding: '15px', borderRadius: '50%' }}>
        {icon}
      </div>
      <div>
        <div style={{ color: '#868e96', fontSize: '0.9em', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px' }}>
          {title}
        </div>
        <div style={{ color: '#212529', fontSize: '1.8em', fontWeight: 'bold' }}>
          {displayVal}
        </div>
      </div>
    </div>
  );
}
