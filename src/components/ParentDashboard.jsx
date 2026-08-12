import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { BookOpen, GraduationCap, Calculator } from 'lucide-react';

export default function ParentDashboard() {
  const [geojson, setGeojson] = useState(null);
  const [rawData, setRawData] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [mapMetric, setMapMetric] = useState('math');
  const [selectedSchoolType, setSelectedSchoolType] = useState('All Schools');

  useEffect(() => {
    fetch('/districts.geojson').then(r => r.json()).then(setGeojson);

    const metricsToFetch = ['rating_mean_math_all', 'rating_mean_ela_all', 'grad_pct_4_all'];
    const metricsStr = metricsToFetch.map(m => `'${m}'`).join(',');
    const soql = `SELECT dbn, school_type, metric_variable_name, metric_value, number_of_students WHERE metric_variable_name IN (${metricsStr}) AND dbn IS NOT NULL LIMIT 200000`;
    const url = `https://data.cityofnewyork.us/resource/dnpx-dfnc.json?$query=${encodeURIComponent(soql)}`;
    
    fetch(url).then(r => r.json()).then(setRawData).catch(err => console.error("Failed to fetch Socrata:", err));
  }, []);

  useEffect(() => {
    if (!rawData) return;
    
    let allowedTypes = null;
    if (selectedSchoolType === 'Elementary') allowedTypes = ['Elementary', 'K-8', 'K-3', 'K-2', 'K-1'];
    else if (selectedSchoolType === 'Middle') allowedTypes = ['Middle', 'K-8'];
    else if (selectedSchoolType === 'High School') allowedTypes = ['High School', 'High School Transfer', 'YABC'];

    const districtAgg = {};

    // Check for Socrata error response
    if (!Array.isArray(rawData)) {
      console.error("Invalid API response:", rawData);
      return;
    }

    rawData.forEach(row => {
      if (allowedTypes && !allowedTypes.includes(row.school_type)) return;
      if (!row.dbn || row.dbn.length < 2) return;
      
      const dist = parseInt(row.dbn.substring(0, 2), 10).toString();
      if (isNaN(dist) || dist === 'NaN') return;

      const metric = row.metric_variable_name;
      const val = parseFloat(row.metric_value);
      const weight = parseInt(row.number_of_students, 10) || 1;

      if (isNaN(val)) return;

      if (!districtAgg[dist]) districtAgg[dist] = {};
      if (!districtAgg[dist][metric]) districtAgg[dist][metric] = { sumWeighted: 0, totalWeight: 0 };
      
      districtAgg[dist][metric].sumWeighted += (val * weight);
      districtAgg[dist][metric].totalWeight += weight;
    });

    const finalMetrics = {};
    Object.keys(districtAgg).forEach(dist => {
      const getVal = (metricName) => {
        const m = districtAgg[dist][metricName];
        if (!m || m.totalWeight === 0) return null;
        return Math.round((m.sumWeighted / m.totalWeight) * 10) / 10;
      };

      finalMetrics[dist] = {
        math: getVal('rating_mean_math_all'),
        reading: getVal('rating_mean_ela_all'),
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
  }, [rawData, selectedSchoolType]);

  if (!geojson || !metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f0f4f8' }}>
        <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '20px' }}>
          <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', animation: 'spin 4s linear infinite' }}>
            <style>
              {`
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes ping { 0% { r: 0; opacity: 1; } 100% { r: 30px; opacity: 0; } }
              `}
            </style>
            <circle cx="50" cy="40" r="30" fill="none" stroke="#e0e0e0" strokeWidth="1" />
            <circle cx="50" cy="40" r="20" fill="none" stroke="#e0e0e0" strokeWidth="1" />
            <circle cx="50" cy="40" r="10" fill="none" stroke="#e0e0e0" strokeWidth="1" />
            <path d="M 50 40 L 50 10 A 30 30 0 0 1 80 40 Z" fill="rgba(52, 152, 219, 0.2)" />
            <circle cx="65" cy="25" fill="none" stroke="#3498db" strokeWidth="2" style={{ animation: 'ping 2s ease-out infinite' }} />
            <circle cx="65" cy="25" r="2" fill="#e74c3c" />
            <circle cx="50" cy="40" r="3" fill="#3498db" />
          </svg>
        </div>
        
        <div style={{ fontSize: '1.4em', color: '#2c3e50', fontWeight: 'bold' }}>Fetching Live District Data...</div>
        <div style={{ fontSize: '1em', color: '#7f8c8d', marginTop: '8px' }}>Pulling from NYC OpenData</div>
      </div>
    );
  }

  const locations = [];
  const zScores = [];
  const textLabels = [];

  geojson.features.forEach(feature => {
    const distId = feature.properties.SchoolDist.toString();
    const data = metrics[distId];
    if (data) {
      locations.push(distId);
      const val = data[mapMetric];
      zScores.push(val !== null && val !== undefined ? val : NaN);
      
      const mStr = data.math !== null && data.math !== undefined ? `${data.math}` : 'N/A';
      const rStr = data.reading !== null && data.reading !== undefined ? `${data.reading}` : 'N/A';
      const gStr = data.graduation !== null && data.graduation !== undefined ? `${data.graduation}%` : 'N/A';
      textLabels.push(`District ${distId}<br>Math: ${mStr}<br>Reading: ${rStr}<br>Graduation: ${gStr}`);
    }
  });

  // Calculate valid min and max for the colorscale
  const validZ = zScores.filter(v => !isNaN(v));
  const zMin = validZ.length > 0 ? Math.min(...validZ) : 0;
  const zMax = validZ.length > 0 ? Math.max(...validZ) : 100;

  const handleMapClick = (data) => {
    if (data.points && data.points.length > 0) {
      const distId = data.points[0].location;
      setSelectedDistrict({
        id: distId,
        ...metrics[distId]
      });
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* LEFT: MAP */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: 'white', padding: '15px 25px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h1 style={{ margin: 0, fontSize: '1.5em', color: '#333' }}>NYC Parent Portal</h1>
          <p style={{ margin: '5px 0 0', color: '#666', fontSize: '0.9em' }}>Click any district for a Report Card</p>
        </div>

        {/* INTERACTIVE LEGEND CONTROL */}
        <div style={{ position: 'absolute', top: 20, right: 30, zIndex: 10, backgroundColor: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '15px', minWidth: '200px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.85em', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>School Level</label>
            <select 
              value={selectedSchoolType} 
              onChange={(e) => setSelectedSchoolType(e.target.value)}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none', cursor: 'pointer', fontSize: '1em', backgroundColor: '#f8f9fa', color: '#333' }}
            >
              <option value="All Schools">All Schools</option>
              <option value="Elementary">Elementary</option>
              <option value="Middle">Middle School</option>
              <option value="High School">High School</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.85em', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Color Map By</label>
            <select 
              value={mapMetric} 
              onChange={(e) => setMapMetric(e.target.value)}
              style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none', cursor: 'pointer', fontSize: '1em', backgroundColor: '#f8f9fa', color: '#333' }}
            >
              <option value="math">Math Proficiency</option>
              <option value="reading">Reading Proficiency</option>
              <option value="graduation">Graduation Rate %</option>
            </select>
          </div>

        </div>

        <Plot
          data={[{
            type: "choroplethmapbox",
            geojson: geojson,
            locations: locations,
            z: zScores,
            featureidkey: "properties.SchoolDist",
            colorscale: "Viridis",
            text: textLabels,
            hoverinfo: "text",
            marker: { opacity: 0.7, line: { width: 1, color: 'white' } },
            colorbar: { title: "", x: 0.95, y: 0.4, len: 0.7 },
            zmin: zMin,
            zmax: zMax
          }]}
          layout={{
            mapbox: {
              style: "carto-positron",
              center: { lon: -73.98, lat: 40.73 },
              zoom: 9.5
            },
            margin: { t: 0, b: 0, l: 0, r: 0 },
            height: window.innerHeight,
            autosize: true
          }}
          useResizeHandler={true}
          style={{ width: '100%', height: '100%' }}
          onClick={handleMapClick}
        />
      </div>

      {/* RIGHT: REPORT CARD PANEL */}
      <div style={{ width: '400px', backgroundColor: '#f8f9fa', borderLeft: '1px solid #ddd', padding: '40px', overflowY: 'auto' }}>
        {!selectedDistrict ? (
          <div style={{ textAlign: 'center', color: '#888', marginTop: '100px' }}>
            <div style={{ fontSize: '3em', marginBottom: '20px' }}>👆</div>
            <h2>Select a District</h2>
            <p>Click on any shaded region on the map to view its detailed report card.</p>
          </div>
        ) : (
          <div>
            <h2 style={{ fontSize: '2em', marginBottom: '5px', color: '#222' }}>District {selectedDistrict.id}</h2>
            <p style={{ color: '#666', marginBottom: '40px' }}>School Report Card ({selectedSchoolType})</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <MetricCard 
                icon={<Calculator size={24} color="#007bff" />} 
                title="Math Proficiency" 
                value={selectedDistrict.math} 
                suffix="" 
              />
              
              <MetricCard 
                icon={<BookOpen size={24} color="#2ca02c" />} 
                title="Reading Proficiency" 
                value={selectedDistrict.reading} 
                suffix="" 
              />
              
              <MetricCard 
                icon={<GraduationCap size={24} color="#d62728" />} 
                title="Graduation Rate" 
                value={selectedDistrict.graduation} 
                suffix="%" 
              />

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, title, value, suffix }) {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ padding: '15px', backgroundColor: '#f0f4f8', borderRadius: '50%' }}>
        {icon}
      </div>
      <div>
        <h4 style={{ margin: 0, color: '#666', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</h4>
        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#222', marginTop: '5px' }}>
          {value !== null && value !== undefined && !isNaN(value) ? `${value}${suffix}` : 'N/A'}
        </div>
      </div>
    </div>
  );
}
