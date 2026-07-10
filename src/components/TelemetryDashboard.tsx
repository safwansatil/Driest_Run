import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { getEndEffectorPose } from '../kinematics';

import type { CartesianPose } from '../kinematics';

import AuditLog from './AuditLog';

export const TelemetryDashboard: React.FC = () => {
  const joints = useStore((state) => state.joints);
  const urdfLimits = useStore((state) => state.urdfLimits);
  const [pose, setPose] = useState<CartesianPose | null>(null);
  const [isJointsExpanded, setIsJointsExpanded] = useState(false);

  // Fast interval to compute end-effector pose based on current joints
  useEffect(() => {
    const interval = setInterval(() => {
      setPose(getEndEffectorPose(useStore.getState().joints));
    }, 100); // 10Hz UI update
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel" style={{ width: '100%', height: '100%', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', zIndex: 10, boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '0.5rem' }}>

        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#111' }}>Live Telemetry</h2>
      </div>

      {/* Cartesian Pose */}
      <div>
        <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#0066cc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          End Effector Position (m)
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
          <div className="telemetry-box">
            <span className="telemetry-label">X</span>
            <span className="telemetry-value">{pose ? pose.x.toFixed(4) : '0.0000'}</span>
          </div>
          <div className="telemetry-box">
            <span className="telemetry-label">Y</span>
            <span className="telemetry-value">{pose ? pose.y.toFixed(4) : '0.0000'}</span>
          </div>
          <div className="telemetry-box">
            <span className="telemetry-label">Z</span>
            <span className="telemetry-value">{pose ? pose.z.toFixed(4) : '0.0000'}</span>
          </div>
        </div>
      </div>

      {/* Joint Angles Progress Bars */}
      <div>
        <h3 
          onClick={() => setIsJointsExpanded(!isJointsExpanded)}
          style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          {isJointsExpanded ? '▼ ' : '▶ '}
          Joint Angles (rad)
        </h3>
        
        {isJointsExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Object.entries(joints).map(([name, value]) => {
              const limit = urdfLimits[name];
              if (!limit) return null;
              
              // Calculate percentage for progress bar
              const range = limit.max - limit.min;
              const percentage = Math.max(0, Math.min(100, ((value - limit.min) / range) * 100));
              const isNearLimit = percentage < 5 || percentage > 95;

              return (
                <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    <span style={{ color: '#555' }}>{name}</span>
                    <span style={{ color: isNearLimit ? '#cc0000' : '#111', fontWeight: 'bold' }}>{value.toFixed(3)}</span>
                  </div>
                  <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        background: isNearLimit ? '#cc0000' : '#f59e0b',
                        transition: 'width 0.1s linear'
                      }} 
                    />
                  </div>
                </div>
              );
            })}
            {Object.keys(urdfLimits).length === 0 && <div style={{ fontSize: '0.8rem', color: '#666' }}>Waiting for limits...</div>}
          </div>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '0' }} />
      
      {/* Audit Log Terminal */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AuditLog />
      </div>

    </div>
  );
};

export default TelemetryDashboard;
