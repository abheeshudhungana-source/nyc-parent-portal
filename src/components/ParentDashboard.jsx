import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { BookOpen, GraduationCap, Calculator } from 'lucide-react';

export default function ParentDashboard() {
  const [geojson, setGeojson] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('/districts.geojson').then(r => r.json()),
      fetch('/district_metrics.json').then(r => r.json())
    ]).then(([geo, data]) => {
      setGeojson(geo);
      setMetrics(data);
    });
  }, []);

  if (!geojson || !metrics) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#f4f7f6', fontFamily: 'sans-serif' }}>
        <style>{`
          @keyframes radar-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes map-ripple {
            0% { transform: scale(0.1); opacity: 0.8; }
            100% { transform: scale(1.5); opacity: 0; }
          }
        `}</style>
        
        <div style={{ position: 'relative', width: '120px', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          {/* Ripple effect at the base */}
          <div style={{ 
            position: 'absolute', bottom: '5px', width: '60px', height: '20px', 
            border: '2px solid #3498db', borderRadius: '50%',
            animation: 'map-ripple 2s infinite cubic-bezier(0.215, 0.61, 0.355, 1)' 
          }}></div>
          
          <svg width="80" height="100" viewBox="0 0 100 100" style={{ zIndex: 2 }}>
            {/* Map Pin Body */}
            <path 
              fill="#2c3e50" 
              d="M50 10c-16.6 0-30 13.4-30 30 0 20 30 55 30 55s30-35 30-55c0-16.6-13.4-30-30-30z" 
            />
            {/* Inner Hole */}
            <circle cx="50" cy="40" r="15" fill="#f4f7f6" />
            
            {/* Radar Sweeping Line */}
            <g style={{ transformOrigin: '50px 40px', animation: 'radar-spin 1.2s linear infinite' }}>
              <path d="M50 40 L50 25 A15 15 0 0 1 65 40 Z" fill="rgba(52, 152, 219, 0.3)" />
              <line x1="50" y1="40" x2="50" y2="25" stroke="#3498db" strokeWidth="3" strokeLinecap="round" />
            </g>
            
            {/* Radar Center Dot */}
            <circle cx="50" cy="40" r="3" fill="#3498db" />
          </svg>
        </div>
        
        <div style={{ fontSize: '1.4em', color: '#2c3e50', fontWeight: 'bold' }}>Mapping NYC School Districts...</div>
        <div style={{ fontSize: '1em', color: '#7f8c8d', marginTop: '8px' }}>Generating report cards</div>
      </div>
    );
  }

  const [mapMetric, setMapMetric] = useState('math');

  // Extract arrays for Plotly
  const locations = [];
  const zScores = [];
  const textLabels = [];

  geojson.features.forEach(feature => {
    const distId = feature.properties.SchoolDist.toString();
    // Sometimes districts are 1-9 without a leading zero in the GeoJSON, but in our data they might be standard ints
    const data = metrics[distId];
    if (data) {
      locations.push(distId);
      zScores.push(data[mapMetric] || 0);
      textLabels.push(`District ${distId}<br>Math: ${data.math}%<br>Reading: ${data.reading}%<br>Graduation: ${data.graduation}%`);
    }
  });

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
        <div style={{ position: 'absolute', top: 20, right: 30, zIndex: 10, backgroundColor: 'white', padding: '10px 15px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.85em', color: '#666', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Color Map By</label>
          <select 
            value={mapMetric} 
            onChange={(e) => setMapMetric(e.target.value)}
            style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', outline: 'none', cursor: 'pointer', fontSize: '1em', backgroundColor: '#f8f9fa', color: '#333' }}
          >
            <option value="math">Math Proficiency %</option>
            <option value="reading">Reading Proficiency %</option>
            <option value="graduation">Graduation Rate %</option>
          </select>
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
            colorbar: { title: "", x: 0.95, y: 0.4, len: 0.7 }
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
            <p style={{ color: '#666', marginBottom: '40px' }}>School Report Card</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <MetricCard 
                icon={<Calculator size={24} color="#007bff" />} 
                title="Math Proficiency" 
                value={selectedDistrict.math} 
                suffix="%" 
              />
              
              <MetricCard 
                icon={<BookOpen size={24} color="#2ca02c" />} 
                title="Reading Proficiency" 
                value={selectedDistrict.reading} 
                suffix="%" 
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
          {value ? `${value}${suffix}` : 'N/A'}
        </div>
      </div>
    </div>
  );
}
