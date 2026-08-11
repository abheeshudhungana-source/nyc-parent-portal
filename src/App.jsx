import React, { useState } from 'react';
import ParentDashboard from './components/ParentDashboard';
import AnalystDashboard from './components/AnalystDashboard';
import { Users, BarChart2 } from 'lucide-react';

export default function App() {
  const [view, setView] = useState('parent'); // 'parent' or 'analyst'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* TOP NAVIGATION BAR */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: '0 30px', 
        height: '70px', 
        backgroundColor: '#1a252f', 
        color: 'white',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 100
      }}>
        <div style={{ fontSize: '1.4em', fontWeight: 'bold', letterSpacing: '1px' }}>
          NYC Schools Data Portal
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setView('parent')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', fontSize: '1em', fontWeight: 'bold',
              borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: view === 'parent' ? '#3498db' : 'transparent',
              color: view === 'parent' ? 'white' : '#bdc3c7',
              transition: 'all 0.2s'
            }}
          >
            <Users size={18} />
            Parent View
          </button>
          
          <button 
            onClick={() => setView('analyst')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', fontSize: '1em', fontWeight: 'bold',
              borderRadius: '6px', border: 'none', cursor: 'pointer',
              backgroundColor: view === 'analyst' ? '#3498db' : 'transparent',
              color: view === 'analyst' ? 'white' : '#bdc3c7',
              transition: 'all 0.2s'
            }}
          >
            <BarChart2 size={18} />
            Analyst View
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'parent' ? <ParentDashboard /> : <AnalystDashboard />}
      </div>

    </div>
  );
}
