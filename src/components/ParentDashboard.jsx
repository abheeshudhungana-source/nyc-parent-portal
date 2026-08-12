import React, { useState } from 'react';
import K8Dashboard from './K8Dashboard';
import HighSchoolDashboard from './HighSchoolDashboard';

export default function ParentDashboard() {
  const [activeTab, setActiveTab] = useState('k8'); // 'k8' or 'highschool'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        padding: '15px', 
        backgroundColor: '#fff', 
        borderBottom: '1px solid #ddd',
        boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
        zIndex: 100
      }}>
        <button
          onClick={() => setActiveTab('k8')}
          style={{
            padding: '10px 20px',
            fontSize: '1em',
            fontWeight: 'bold',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'k8' ? '#3498db' : '#f1f2f6',
            color: activeTab === 'k8' ? 'white' : '#7f8c8d',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'k8' ? '0 2px 8px rgba(52, 152, 219, 0.4)' : 'none'
          }}
        >
          K-8 Schools
        </button>
        <button
          onClick={() => setActiveTab('highschool')}
          style={{
            padding: '10px 20px',
            fontSize: '1em',
            fontWeight: 'bold',
            borderRadius: '20px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'highschool' ? '#9b59b6' : '#f1f2f6',
            color: activeTab === 'highschool' ? 'white' : '#7f8c8d',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'highschool' ? '0 2px 8px rgba(155, 89, 182, 0.4)' : 'none'
          }}
        >
          High Schools
        </button>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeTab === 'k8' ? <K8Dashboard /> : <HighSchoolDashboard />}
      </div>
    </div>
  );
}
