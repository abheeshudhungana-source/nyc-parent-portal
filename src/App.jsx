import { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { BookOpen, GraduationCap, Calculator } from 'lucide-react';

export default function App() {
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
    return <div style={{ padding: '50px', textAlign: 'center', fontSize: '1.2em' }}>Loading NYC School District Map...</div>;
  }

  // Extract arrays for Plotly
  const locations = [];
  const mathScores = [];
  const textLabels = [];

  geojson.features.forEach(feature => {
    const distId = feature.properties.SchoolDist.toString();
    // Sometimes districts are 1-9 without a leading zero in the GeoJSON, but in our data they might be standard ints
    const data = metrics[distId];
    if (data) {
      locations.push(distId);
      mathScores.push(data.math || 0);
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

        <Plot
          data={[{
            type: "choroplethmapbox",
            geojson: geojson,
            locations: locations,
            z: mathScores,
            featureidkey: "properties.SchoolDist",
            colorscale: "Viridis",
            text: textLabels,
            hoverinfo: "text",
            marker: { opacity: 0.7, line: { width: 1, color: 'white' } },
            colorbar: { title: "Math %", x: 0.95 }
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
