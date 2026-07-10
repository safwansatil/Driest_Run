import React from 'react';
import { useStore } from '../store';


const StatusBar: React.FC = () => {
  const mode = useStore((state) => state.mode);
  const backendError = useStore((state) => state.backendError);
  const resetEStop = useStore((state) => state.resetEStop);
  const triggerEStop = useStore((state) => state.triggerEStop);
  const setError = useStore((state) => state.setError);
  const showGrid = useStore((state) => state.showGrid);
  const setShowGrid = useStore((state) => state.setShowGrid);
  const controlMode = useStore((state) => state.controlMode);
  const activeJoint = useStore((state) => state.activeJoint);
  const cameraMode = useStore((state) => state.cameraMode);
  const setCameraMode = useStore((state) => state.setCameraMode);
  const stepSize = useStore((state) => state.stepSize);
  
  const clearError = () => setError(null);

  const getStatusColor = () => {
    switch (mode) {
      case 'REST': return '#00ffcc';
      case 'JOGGING': return '#3399ff';
      case 'EXECUTE': return '#b366ff';
      case 'ERROR': return '#ff3333';
      case 'STOP': return '#ffcc00';
      default: return '#888';
    }
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '60px',
      background: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 1.5rem', zIndex: 100, boxSizing: 'border-box',
      boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
    }}>
      
      {/* Left: Brand & Connection */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, letterSpacing: '2px', color: '#111' }}>VANTAGE</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#555' }}>
          WS: CONNECTED
        </div>
        <div style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1' }}>
          Input: {controlMode}
        </div>
        <div style={{ padding: '4px 10px', background: '#2563eb', color: '#fff', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 800, border: '1px solid #1d4ed8' }}>
          ACTIVE SERVO: JOINT {activeJoint}
        </div>
        {controlMode === 'MOUSE' && (
          <button 
             onClick={() => setCameraMode(!cameraMode)}
             style={{ padding: '4px 10px', background: cameraMode ? '#eab308' : '#f1f5f9', color: cameraMode ? '#fff' : '#111', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1', cursor: 'pointer' }}>
            {cameraMode ? 'CAMERA PAN: ON' : 'CAMERA PAN: OFF'}
          </button>
        )}
        <div style={{ padding: '4px 10px', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600, border: '1px solid #cbd5e1' }}>
          Step: {stepSize.toFixed(2)}
        </div>
      </div>

      {/* Center: Status Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ 
          padding: '6px 16px', borderRadius: '20px', 
          background: mode === 'ERROR' ? 'rgba(255,51,51,0.1)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${getStatusColor()}`,
          color: getStatusColor(), fontWeight: 'bold', letterSpacing: '1px',
          boxShadow: `0 0 10px ${getStatusColor()}20`,
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>

          {mode}
        </div>
        
        {backendError && (
          <div style={{ color: '#ff3333', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {backendError}
            <button 
              onClick={clearError}
              style={{ padding: '4px 12px', background: '#ff3333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              CLEAR ERROR
            </button>
          </div>
        )}
      </div>

      {/* Right: Grid Toggle & E-STOP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        
        {/* Grid Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: '#555', fontWeight: 'bold' }}>GRID</span>
          <div 
            onClick={() => setShowGrid(!showGrid)}
            style={{
              width: '40px', height: '22px', borderRadius: '11px',
              background: showGrid ? '#0066cc' : '#ccc',
              position: 'relative', cursor: 'pointer',
              transition: 'background 0.3s'
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: '#fff', position: 'absolute', top: '2px',
              left: showGrid ? '20px' : '2px',
              transition: 'left 0.3s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }} />
          </div>
        </div>

        {/* E-STOP */}
        <button 
          onClick={mode === 'STOP' ? resetEStop : triggerEStop}
          style={{
            height: '40px', padding: '0 2rem',
            background: mode === 'STOP' ? '#ffcc00' : '#ff3333',
            color: mode === 'STOP' ? '#000' : '#fff',
            border: 'none', borderRadius: '4px',
            fontWeight: 900, fontSize: '1.1rem', letterSpacing: '1px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: `0 0 15px ${mode === 'STOP' ? '#ffcc00' : '#ff3333'}60`,
            transition: 'all 0.2s'
          }}
        >

          {mode === 'STOP' ? 'RESET STOP' : 'E-STOP'}
        </button>
      </div>

    </div>
  );
};

export default StatusBar;
