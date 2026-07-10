import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import RobotSimulator from './components/RobotSimulator';
import CommandCenter from './components/CommandCenter';
import ControlPanel from './components/ControlPanel';
import VoicePanel from './triggers/voice/VoicePanel';
import TypedCommandInput from './triggers/voice/TypedCommandInput';
import AgentPanel from './agent/AgentPanel';
import AuditLog from './components/AuditLog';
import TelemetryDashboard from './components/TelemetryDashboard';
import StatusBar from './components/StatusBar';
import { useStore } from './store';
import { handleKeyboardInput } from './triggers/keyboard';
import './index.css';

function App() {
  const { mode, isEStop, controlMode } = useStore();

  useEffect(() => {
    // Keyboard controls (Keyboard/QE) for Cartesian jogging
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEStop || mode === 'ERROR' || mode === 'EXECUTE' || controlMode !== 'Keyboard') return;
      
      if (['w','a','s','d','q','e',' ',"shift"].includes(e.key.toLowerCase())) {
        let dx = 0, dy = 0, dz = 0;
        const speed = 0.05;
        switch(e.key.toLowerCase()) {
          case 'w': dy = speed; break;
          case 's': dy = -speed; break;
          case 'a': dx = -speed; break;
          case 'd': dx = speed; break;
          case ' ': dz = speed; break;
          case 'shift': dz = -speed; break;
        }
        if (dx !== 0 || dy !== 0 || dz !== 0) handleKeyboardInput(dx, dy, dz);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEStop, mode, controlMode]);

  useEffect(() => {
    if (controlMode !== 'MOUSE') return;
    let isDragging = false;
    const handlePointerDown = () => { isDragging = true; };
    const handlePointerUp = () => { isDragging = false; };
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging || isEStop || mode === 'ERROR' || mode === 'EXECUTE') return;
      const dx = e.movementX * 0.001;
      const dy = -e.movementY * 0.001;
      if (dx !== 0 || dy !== 0) handleKeyboardInput(dx, dy, 0);
    };
    const handleWheel = (e: WheelEvent) => {
      if (isEStop || mode === 'ERROR' || mode === 'EXECUTE') return;
      const dz = e.deltaY * -0.0005;
      if (dz !== 0) handleKeyboardInput(0, 0, dz);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isEStop, mode, controlMode]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#e2e8f0', color: '#111', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <StatusBar />
      <div style={{ flex: 1, position: 'relative', marginTop: '60px', display: 'flex' }}>

        {/* 3D Background Canvas */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
          <Canvas camera={{ position: [1.2, 1.0, 1.2], fov: 55 }}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[2, 4, 3]} intensity={1} castShadow />
            <RobotSimulator />
            <OrbitControls enabled={controlMode !== 'MOUSE'} />
          </Canvas>
        </div>

        {/* UI Overlay */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', display: 'flex', padding: '1rem', boxSizing: 'border-box', zIndex: 10 }}>

          {/* Left Sidebar Stack */}
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', width: '380px', overflowY: 'auto', paddingRight: '0.5rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.8rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Vantage Control Suite</h1>
            <CommandCenter />
            <ControlPanel />
            <VoicePanel />
            <TypedCommandInput />
            <AgentPanel />
            <TelemetryDashboard />
            <div style={{ flex: 1, minHeight: 0 }}>
              <AuditLog />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;