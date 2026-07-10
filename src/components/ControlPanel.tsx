import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { JOINT_LIMITS } from '../kinematics/ikSolver';
import { Play, Mic, MicOff, AlertOctagon, RefreshCw, Hand, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MousePointerClick } from 'lucide-react';

export default function ControlPanel() {
  const { joints, setJoints, mode, isEStop, triggerEStop, resetEStop, setActiveCommand, addLog } = useStore();
  const [pin, setPin] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Auto PIN sequence runner
  const runSequence = async () => {
    if (isEStop) return;
    if (pin.length !== 6) {
      addLog({ type: 'warn', source: 'Sequencer', message: 'PIN must be 6 digits' });
      return;
    }

    addLog({ type: 'info', source: 'Sequencer', message: `Running sequence: ${pin}` });
    
    // Fetch key coords
    const resp = await fetch('/key.config.json');
    const config = await resp.json();
    const keys = config.keys;

    // A very simple sequence loop (in a real app, this would be a state machine or async generator hooked into the executor)
    // For MVP, we'll queue them as activeCommands by waiting for IDLE state between commands, but since we are running 
    // inside a simple React component, let's just trigger the first one to prove the pipeline.
    // In a full implementation, we'd add an array of commands to the store and executor drains it.
    
    // Simple implementation: Just move to the first digit for MVP demonstration
    const firstDigit = pin[0];
    const keyData = keys[firstDigit];
    if (keyData) {
      setActiveCommand({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        source: 'auto_pin',
        type: 'cartesian',
        cartesianTarget: { x: keyData.x, y: keyData.y, z: keyData.z + 0.01, nx: 0, ny: 0, nz: -1 },
        speedFraction: 0.5
      });
      addLog({ type: 'info', source: 'Sequencer', message: `Moving to key ${firstDigit}` });
    }
  };

  // Voice Control
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      addLog({ type: 'info', source: 'Voice', message: `Heard: "${transcript}"` });
      
      let jogDelta = { dx: 0, dy: 0, dz: 0 };
      if (transcript.includes('up')) jogDelta.dz = 0.05;
      if (transcript.includes('down')) jogDelta.dz = -0.05;
      if (transcript.includes('left')) jogDelta.dy = 0.05;
      if (transcript.includes('right')) jogDelta.dy = -0.05;
      if (transcript.includes('forward')) jogDelta.dx = 0.05;
      if (transcript.includes('back')) jogDelta.dx = -0.05;

      if (jogDelta.dx !== 0 || jogDelta.dy !== 0 || jogDelta.dz !== 0) {
        setActiveCommand({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'voice',
          type: 'jog',
          jogDelta,
          speedFraction: 0.3
        });
      } else {
         addLog({ type: 'warn', source: 'Voice', message: 'Command not recognized' });
      }
    };

    if (isListening) {
      recognition.start();
    }

    return () => { recognition.stop(); };
  }, [isListening, setActiveCommand, addLog]);

  const jog = (dx: number, dy: number, dz: number) => {
    setActiveCommand({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'joystick',
      type: 'jog',
      jogDelta: { dx, dy, dz },
      speedFraction: 0.4
    });
  };

  return (
    <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', zIndex: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} className={mode === 'MOVING' ? 'spin' : ''} /> Control Panel
        </h2>
        <div style={{ padding: '4px 8px', borderRadius: '4px', background: isEStop ? 'red' : (mode === 'IDLE' ? 'green' : 'orange'), fontSize: '0.8rem', fontWeight: 'bold' }}>
          {isEStop ? 'E-STOP' : mode}
        </div>
      </div>

      <button 
        onClick={isEStop ? resetEStop : triggerEStop}
        style={{ background: isEStop ? '#ffcc00' : '#ff3333', color: '#000', padding: '1rem', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
      >
        <AlertOctagon /> {isEStop ? 'RESET E-STOP' : 'EMERGENCY STOP'}
      </button>

      {/* Manual Joint Sliders */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Hand size={14}/> Joint Control</h3>
        {Object.keys(JOINT_LIMITS).map((k) => {
          const key = k as keyof typeof JOINT_LIMITS;
          return (
            <div key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span style={{ width: '70px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</span>
              <input 
                type="range" 
                min={JOINT_LIMITS[key].min} 
                max={JOINT_LIMITS[key].max} 
                step={0.01} 
                value={joints[key]}
                onChange={(e) => setJoints({ [key]: parseFloat(e.target.value) })}
                disabled={isEStop}
                style={{ flex: 1 }}
              />
              <span style={{ width: '40px', textAlign: 'right' }}>{joints[key].toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      {/* Cartesian Joystick */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#aaa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MousePointerClick size={14}/> Cartesian Jog</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
          <button onClick={() => jog(-0.02, 0, 0)} disabled={isEStop}><ArrowLeft size={16}/> -X</button>
          <button onClick={() => jog(0.02, 0, 0)} disabled={isEStop}>+X <ArrowRight size={16}/></button>
          <button onClick={() => jog(0, 0, 0.02)} disabled={isEStop}><ArrowUp size={16}/> +Z</button>
          <button onClick={() => jog(0, -0.02, 0)} disabled={isEStop}>-Y</button>
          <button onClick={() => jog(0, 0.02, 0)} disabled={isEStop}>+Y</button>
          <button onClick={() => jog(0, 0, -0.02)} disabled={isEStop}><ArrowDown size={16}/> -Z</button>
        </div>
      </div>

      {/* Autonomous / Voice */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#aaa' }}>Auto PIN</h3>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input 
              type="text" 
              maxLength={6} 
              value={pin} 
              onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="123456" 
              style={{ width: '100%', padding: '4px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid #444', borderRadius: '4px' }}
            />
            <button onClick={runSequence} disabled={isEStop || pin.length !== 6} style={{ padding: '4px', display: 'flex', alignItems: 'center' }}>
              <Play size={16}/>
            </button>
          </div>
        </div>

        <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#aaa' }}>Voice</h3>
          <button 
            onClick={() => setIsListening(!isListening)} 
            disabled={isEStop}
            style={{ width: '100%', padding: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', background: isListening ? '#cc3333' : '#333' }}
          >
            {isListening ? <MicOff size={16}/> : <Mic size={16}/>}
            {isListening ? 'Stop' : 'Listen'}
          </button>
        </div>
      </div>

    </div>
  );
}
