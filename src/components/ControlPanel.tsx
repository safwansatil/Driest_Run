import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Play, Mic, MicOff, AlertOctagon, RefreshCw, Hand, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MousePointerClick } from 'lucide-react';

export default function ControlPanel() {
  const { joints, urdfLimits, mode, isEStop, triggerEStop, resetEStop, setActiveCommand, addLog } = useStore();
  const [pin, setPin] = useState('');
  const [isListening, setIsListening] = useState(false);

  // Auto PIN sequence runner
  const runSequence = async () => {
    if (isEStop) return;
    if (pin.length !== 6) {
      addLog({ source: 'SYSTEM', type: 'warn', message: 'PIN must be 6 digits' });
      return;
    }

    addLog({ source: 'SYSTEM', type: 'info', message: `Running sequence: ${pin}` });
    
    // For MVP, just queue the first digit. A full sequence would use a generator or state machine.
    const resp = await fetch('/key.config.json');
    const config = await resp.json();
    const keys = config.keys;

    const firstDigit = pin[0];
    const keyData = keys[firstDigit];
    if (keyData) {
      setActiveCommand({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        source: 'autonomous',
        type: 'moveTo',
        target: { x: keyData.x, y: keyData.y, z: keyData.z + 0.01, approach: [0, 0, -1] }
      });
      addLog({ source: 'SYSTEM', type: 'info', message: `Moving to key ${firstDigit}` });
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
      addLog({ source: 'SYSTEM', type: 'info', message: `Heard: "${transcript}"` });
      
      let delta = { x: 0, y: 0, z: 0 };
      if (transcript.includes('up')) delta.z = 0.05;
      if (transcript.includes('down')) delta.z = -0.05;
      if (transcript.includes('left')) delta.y = 0.05;
      if (transcript.includes('right')) delta.y = -0.05;
      if (transcript.includes('forward')) delta.x = 0.05;
      if (transcript.includes('back')) delta.x = -0.05;

      if (delta.x !== 0 || delta.y !== 0 || delta.z !== 0) {
        setActiveCommand({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'voice',
          type: 'jog',
          delta
        });
      } else {
         addLog({ source: 'SYSTEM', type: 'warn', message: 'Command not recognized' });
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
      delta: { x: dx, y: dy, z: dz }
    });
  };
  
  const setJoint = (name: string, value: number) => {
    setActiveCommand({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'dashboard',
      type: 'setJoint',
      joint: { name, value }
    });
  };

  return (
    <div className="glass-panel" style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', zIndex: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} className={mode === 'EXECUTING' || mode === 'JOGGING' ? 'spin' : ''} /> Control Panel
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
        {Object.keys(urdfLimits).map((key) => {
          const limit = urdfLimits[key];
          return (
            <div key={key} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '4px', fontSize: '0.8rem' }}>
              <span style={{ width: '70px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</span>
              <input 
                type="range" 
                min={limit.min} 
                max={limit.max} 
                step={0.01} 
                value={joints[key as keyof typeof joints] || 0}
                onChange={(e) => setJoint(key, parseFloat(e.target.value))}
                disabled={isEStop}
                style={{ flex: 1 }}
              />
              <span style={{ width: '40px', textAlign: 'right' }}>{(joints[key as keyof typeof joints] || 0).toFixed(2)}</span>
            </div>
          );
        })}
        {Object.keys(urdfLimits).length === 0 && <div style={{fontSize:'0.8rem', color:'#666'}}>Loading URDF limits...</div>}
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
