import { useEffect } from 'react';
import RobotSimulator from './components/RobotSimulator';
import ControlPanel from './components/ControlPanel';
import AuditLog from './components/AuditLog';
import ElectricalSchematic from './components/ElectricalSchematic';
import { useStore } from './store';
import { startExecutor, stopExecutor } from './kinematics/executor';
import './index.css';

function App() {
  const { setActiveCommand, isEStop } = useStore();

  useEffect(() => {
    // Start the physics/kinematics loop
    startExecutor();
    return () => stopExecutor();
  }, []);

  useEffect(() => {
    // Keyboard controls (WASD/QE)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEStop) return;
      // Prevent default scrolling for game keys
      if (['w','a','s','d','q','e'].includes(e.key.toLowerCase())) {
        let dx = 0, dy = 0, dz = 0;
        const speed = 0.05;
        switch(e.key.toLowerCase()) {
          case 'w': dx = speed; break; // Forward
          case 's': dx = -speed; break; // Back
          case 'a': dy = speed; break; // Left
          case 'd': dy = -speed; break; // Right
          case 'q': dz = speed; break; // Up
          case 'e': dz = -speed; break; // Down
        }
        
        if (dx !== 0 || dy !== 0 || dz !== 0) {
          setActiveCommand({
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            source: 'keyboard',
            type: 'jog',
            delta: { x: dx, y: dy, z: dz }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEStop, setActiveCommand]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#111', color: 'white', position: 'relative' }}>
      
      {/* 3D Background */}
      <RobotSimulator />

      {/* UI Overlay */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', padding: '1rem', boxSizing: 'border-box' }}>
        
        {/* Left Side: Controls */}
        <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.8rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Vantage Control Suite</h1>
          <ControlPanel />
          <div style={{ flex: 1, minHeight: 0 }}>
             <AuditLog />
          </div>
        </div>
        
        {/* Right Side: Schematic */}
        <div style={{ pointerEvents: 'auto', marginLeft: 'auto' }}>
          <ElectricalSchematic />
        </div>
        
      </div>
    </div>
  );
}

export default App;
