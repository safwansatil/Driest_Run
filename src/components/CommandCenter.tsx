import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { NativeJoystick } from './NativeJoystick';
import { commandBus } from '../bus/commandBus';
import TypedCommandInput from '../triggers/voice/TypedCommandInput';
const JoystickControls = () => {
  const { rpm, setRpm, activeJoint, setActiveJoint } = useStore();
  const rpmRef = useRef(rpm);
  const activeJointRef = useRef(activeJoint);

  useEffect(() => {
    rpmRef.current = rpm;
    activeJointRef.current = activeJoint;
  }, [rpm, activeJoint]);

  // Handle Y-axis (Toggle Joint)
  const lastToggleRef = useRef(0);
  const handleToggleMove = (x: number, y: number) => {
    const now = Date.now();
    if (Math.abs(y) > 0.5 && now - lastToggleRef.current > 300) {
      let next = activeJointRef.current + (y > 0 ? -1 : 1);
      if (next < 1) next = 6;
      if (next > 6) next = 1;
      setActiveJoint(next);
      lastToggleRef.current = now;
    }
  };

  // Handle Speed Stick
  const speedIntervalRef = useRef<number | null>(null);
  const handleSpeedMove = (x: number, y: number) => {
    if (Math.abs(y) > 0.1) {
      if (speedIntervalRef.current === null) {
        speedIntervalRef.current = window.setInterval(() => {
          setRpm(Math.max(0, Math.min(255, rpmRef.current + y * 2)));
        }, 50);
      }
    } else {
      if (speedIntervalRef.current !== null) {
        clearInterval(speedIntervalRef.current);
        speedIntervalRef.current = null;
      }
    }
  };
  const handleSpeedEnd = () => {
    if (speedIntervalRef.current !== null) {
      clearInterval(speedIntervalRef.current);
      speedIntervalRef.current = null;
    }
  };

  // Handle X-axis (Rotate Servo)
  const rotationDirRef = useRef(0);
  const rotationIntervalRef = useRef<number | null>(null);

  const handleRotateMove = (x: number, y: number) => {
    if (x > 0.3) rotationDirRef.current = 1;
    else if (x < -0.3) rotationDirRef.current = -1;
    else rotationDirRef.current = 0;

    if (rotationDirRef.current !== 0 && rotationIntervalRef.current === null) {
      rotationIntervalRef.current = window.setInterval(() => {
        const state = useStore.getState();
        if (state.isEStop || state.mode === 'ERROR' || state.mode === 'EXECUTE') return;
        
        commandBus.submit({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          source: 'joystick',
          type: 'setJoint',
          joint: { name: `joint_${state.activeJoint}`, delta: rotationDirRef.current * state.stepSize }
        });
      }, 100);
    } else if (rotationDirRef.current === 0 && rotationIntervalRef.current !== null) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }
  };

  const handleRotateEnd = () => {
    rotationDirRef.current = 0;
    if (rotationIntervalRef.current !== null) {
      clearInterval(rotationIntervalRef.current);
      rotationIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (rotationIntervalRef.current !== null) clearInterval(rotationIntervalRef.current);
      if (speedIntervalRef.current !== null) clearInterval(speedIntervalRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#111' }}>Tri-Stick Control</h3>
        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#ff3366' }}>{Math.round(rpm)} RPM</span>
      </div>
      
      <div style={{ display: 'flex', gap: '2rem', width: '100%', justifyContent: 'center' }}>
        <NativeJoystick color="#9933ff" label="Toggle Joint (Y)" lockX onMove={handleToggleMove} onEnd={() => {}} />
        <NativeJoystick color="#00ccff" label="Rotate Servo (X)" lockY onMove={handleRotateMove} onEnd={handleRotateEnd} />
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <NativeJoystick color="#ff3366" label="Speed Control (Y)" lockX onMove={handleSpeedMove} onEnd={handleSpeedEnd} />
      </div>
    </div>
  );
};

export const CommandCenter: React.FC = () => {
  const { mode, controlMode, setControlMode, setActiveCommand, addLog, cameraMode, setCameraMode, rpm, setRpm } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Auto State
  const [ikTarget, setIkTarget] = useState({ x: 0.2, y: 0.2, z: 1.0 });
  const [pin, setPin] = useState('');

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const isDisabled = mode === 'STOP' || mode === 'ERROR' || mode === 'EXECUTE';

  // --- Mode 2: Absolute Target & PIN ---
  const handleIKExecute = () => {
    setActiveCommand({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      source: 'dashboard',
      type: 'moveTo',
      target: { ...ikTarget, approach: [0, 0, -1] }
    });
    addLog({ source: 'dashboard', type: 'info', message: `Executing IK to (${ikTarget.x}, ${ikTarget.y}, ${ikTarget.z})` });
  };

  const runPINSequence = async () => {
    if (pin.length !== 6) return;
    
    addLog({ source: 'autonomous', type: 'info', message: `Starting autonomous PIN sequence: ${pin}` });
    
    try {
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
          target: { x: keyData.x, y: keyData.y, z: keyData.z + 0.02, approach: [0, 0, -1] }
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- Mode 3: Voice ---
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      setVoiceTranscript(transcript);
      addLog({ source: 'voice', type: 'info', message: `Recognized: "${transcript}"` });
      
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
      }
    };

    if (isListening && !isDisabled) {
      recognition.start();
    }

    return () => { recognition.stop(); };
  }, [isListening, isDisabled, setActiveCommand, addLog]);

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', zIndex: 10, boxSizing: 'border-box' }}>
      
      {/* Header with Hamburger */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#111', display: 'flex', alignItems: 'center', gap: '0.5rem', lineHeight: 1 }}>
          {controlMode === 'JOYSTICK' && <>Joystick</>}
          {controlMode === 'MOUSE' && <>Mouse Control</>}
          {controlMode === 'Keyboard' && <>Keyboard</>}
          {controlMode === 'VOICE' && <>Voice Control</>}
          {controlMode === 'PIN' && <>Auto / PIN</>}
          {controlMode === 'AGENTIC' && <>Agentic</>}
        </h2>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ width: '32px', height: '32px', padding: 0, background: 'transparent', border: 'none', fontWeight: 'bold', fontSize: '1.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>
          ☰
        </button>
      </div>

      {isMenuOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
          <button 
            onClick={() => { setControlMode('JOYSTICK'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'JOYSTICK' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'JOYSTICK' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Joystick</button>
          
          <button 
            onClick={() => { setControlMode('MOUSE'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'MOUSE' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'MOUSE' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Mouse Control</button>
          
          <button 
            onClick={() => { setControlMode('Keyboard'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'Keyboard' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'Keyboard' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Keyboard</button>
          
          <button 
            onClick={() => { setControlMode('VOICE'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'VOICE' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'VOICE' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Voice Control</button>
          
          <button 
            onClick={() => { setControlMode('PIN'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'PIN' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'PIN' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Auto / PIN</button>
          
          <button 
            onClick={() => { setControlMode('AGENTIC'); setIsMenuOpen(false); }}
            style={{ padding: '1rem', background: controlMode === 'AGENTIC' ? 'rgba(0,102,204,0.1)' : 'transparent', border: 'none', color: controlMode === 'AGENTIC' ? '#0066cc' : '#555', textAlign: 'left', borderRadius: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >Agentic</button>
        </div>
      )}

      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: isDisabled ? 0.5 : 1, pointerEvents: isDisabled ? 'none' : 'auto' }}>
        
        {/* JOYSTICK MODE */}
        {controlMode === 'JOYSTICK' && (
          <JoystickControls />
        )}

        {/* MOUSE MODE */}
        {controlMode === 'MOUSE' && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0', color: '#555' }}>

            <p style={{ margin: 0, fontWeight: 'bold' }}>Mouse Control Active</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
              {!cameraMode ? 'Scroll to change joints. Left/Right click to rotate.' : 'Pan Mode active. OrbitControls enabled.'}
            </p>
            
            {!cameraMode && (
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Speed (RPM):</label>
                <input type="number" min="0" max="255" value={Math.round(rpm)} onChange={(e) => setRpm(parseFloat(e.target.value) || 0)} style={{ width: '80px', padding: '0.25rem', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }} />
              </div>
            )}

            <button 
              onClick={() => setCameraMode(!cameraMode)}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: cameraMode ? '#cc0000' : '#0066cc',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              {cameraMode ? 'Disable Pan Mode (Enable Joint Control)' : 'Enable Pan Mode (Orbit Camera)'}
            </button>
          </div>
        )}

        {/* Keyboard MODE */}
        {controlMode === 'Keyboard' && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0', color: '#555' }}>

            <p style={{ margin: 0, fontWeight: 'bold' }}>Keyboard Control Active</p>
            <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Press <b>1-6</b> to select a joint.<br/>Press <b>A / D</b> to rotate.</p>
            
            <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Speed (RPM):</label>
              <input type="number" min="0" max="255" value={Math.round(rpm)} onChange={(e) => setRpm(parseFloat(e.target.value) || 0)} style={{ width: '80px', padding: '0.25rem', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center' }} />
            </div>
          </div>
        )}

        {/* AUTO / PIN MODE */}
        {controlMode === 'PIN' && (
          <>
            <div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#111', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Absolute Target</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#555' }}>X</label>
                  <input type="number" step="0.01" value={ikTarget.x} onChange={e => setIkTarget(prev => ({...prev, x: parseFloat(e.target.value) || 0}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', color: '#111', borderRadius: '4px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#555' }}>Y</label>
                  <input type="number" step="0.01" value={ikTarget.y} onChange={e => setIkTarget(prev => ({...prev, y: parseFloat(e.target.value) || 0}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', color: '#111', borderRadius: '4px', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.7rem', color: '#555' }}>Z</label>
                  <input type="number" step="0.01" value={ikTarget.z} onChange={e => setIkTarget(prev => ({...prev, z: parseFloat(e.target.value) || 0}))} style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', color: '#111', borderRadius: '4px', boxSizing: 'border-box' }} />
                </div>
              </div>
              <button onClick={handleIKExecute} style={{ width: '100%', padding: '0.85rem', background: 'linear-gradient(135deg, #0066cc, #004c99)', border: 'none', color: '#fff', borderRadius: '50px', fontWeight: 'bold', boxShadow: '0 4px 10px rgba(0, 102, 204, 0.3)', cursor: 'pointer', transition: 'transform 0.1s' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>EXECUTE IK TARGET</button>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.1)', margin: '1.5rem 0' }} />

            <div>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#111' }}>Autonomous Movement</h3>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <input 
                    key={index}
                    id={`pin-input-${index}`}
                    type="text" 
                    maxLength={1} 
                    value={pin[index] || ''} 
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (!val && e.target.value !== '') return;
                      const newPin = pin.split('');
                      newPin[index] = val;
                      setPin(newPin.join(''));
                      if (val && index < 5) {
                        document.getElementById(`pin-input-${index + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !pin[index] && index > 0) {
                        document.getElementById(`pin-input-${index - 1}`)?.focus();
                      }
                    }}
                    style={{ width: '2.2rem', height: '3rem', background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', color: '#111', borderRadius: '8px', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}
                  />
                ))}
                <button 
                  onClick={runPINSequence} 
                  disabled={pin.length !== 6} 
                  style={{ 
                    marginLeft: '0.25rem', width: '3rem', height: '3rem', flexShrink: 0,
                    background: pin.length === 6 ? 'linear-gradient(135deg, #9933ff, #7326bf)' : '#ccc', 
                    border: 'none', color: '#fff', borderRadius: '50%', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontSize: '1.2rem', boxShadow: pin.length === 6 ? '0 4px 10px rgba(153, 51, 255, 0.3)' : 'none', 
                    cursor: pin.length === 6 ? 'pointer' : 'not-allowed'
                  }}
                >
                  ▶
                </button>
              </div>
            </div>
          </>
        )}

        {/* VOICE MODE */}
        {controlMode === 'VOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
            <button 
              onClick={() => setIsListening(!isListening)}
              style={{
                width: '120px', height: '120px', borderRadius: '50%',
                background: isListening ? 'rgba(255,51,51,0.1)' : 'rgba(0,102,204,0.05)',
                border: `2px solid ${isListening ? '#cc0000' : '#0066cc'}`,
                color: isListening ? '#cc0000' : '#0066cc',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: isListening ? '0 0 30px rgba(255,51,51,0.2)' : 'none',
                transition: 'all 0.3s'
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{isListening ? 'LISTENING' : 'TAP TO SPEAK'}</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '24px', justifyContent: 'center', marginTop: '0.5rem' }}>
                {[
                  { h: '60%', d: '0s' },
                  { h: '100%', d: '0.1s' },
                  { h: '70%', d: '0.2s' },
                  { h: '90%', d: '0.3s' },
                  { h: '50%', d: '0.4s' }
                ].map((bar, i) => (
                  <div 
                    key={i} 
                    style={{ 
                      width: '4px', 
                      background: isListening ? '#cc0000' : '#ccc', 
                      height: isListening ? '20%' : '20%',
                      borderRadius: '2px',
                      animation: isListening ? `sound-bounce-${i} 0.5s ease-in-out infinite alternate ${bar.d}` : 'none',
                      transition: 'background 0.3s'
                    }} 
                  />
                ))}
              </div>
            </button>
            
            <div style={{ width: '85%', background: 'rgba(255,255,255,0.8)', padding: '0.5rem 1rem', borderRadius: '8px', minHeight: '40px', border: '1px solid #ddd', textAlign: 'center' }}>
              <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: '0.2rem', textTransform: 'uppercase' }}>Recognized Input</div>
              <div style={{ color: '#111', fontStyle: voiceTranscript ? 'normal' : 'italic', fontSize: '0.9rem' }}>
                {voiceTranscript || 'Waiting for voice command...'}
              </div>
            </div>
          </div>
        )}

        {/* AGENTIC MODE */}
        {controlMode === 'AGENTIC' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
            <TypedCommandInput />
          </div>
        )}

      </div>
    </div>
  );
};

export default CommandCenter;
