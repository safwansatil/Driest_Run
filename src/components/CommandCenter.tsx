import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { NativeJoystick } from './NativeJoystick';
import { commandBus } from '../bus/commandBus';
import { runPinSequence, type SequenceStatus } from '../triggers/autonomous';
import { fsm } from '../fsm';
import TypedCommandInput from '../triggers/voice/TypedCommandInput';
import { voiceTrigger, type VoiceState } from '../triggers/voice/voiceTrigger';

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
  const handleToggleMove = (_x: number, y: number) => {
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
  const handleSpeedMove = (_x: number, y: number) => {
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

  const handleRotateMove = (x: number, _y: number) => {
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
  
  const joystickRef = useRef<HTMLDivElement>(null);
  const zSliderRef = useRef<HTMLInputElement>(null);

  // Auto State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPin, setAuthPin] = useState('');
  const [pin, setPin] = useState('');
  const [seqStatus, setSeqStatus] = useState<SequenceStatus | null>(null);
  const [seqError, setSeqError] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  // Voice State
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const isDisabled = mode === 'STOP' || mode === 'ERROR' || mode === 'EXECUTE';

  const handleRunPin = () => {
    if (pin.length !== 6) return;
    setSeqError('');
    
    if (/[7890]/.test(pin)) {
      setSeqError('Error: Physical keypad only contains keys 1-6');
      return;
    }

    setIsPaused(false);
    addLog({ source: 'autonomous', type: 'info', message: `Starting autonomous sequence: ${pin}` });
    
    runPinSequence(pin, (status) => {
      setSeqStatus({...status});
      if (status.status === 'SUCCESS') {
        addLog({ source: 'autonomous', type: 'success', message: 'PIN sequence completed successfully' });
      }
    });
  };

  // --- Mode 3: Voice ---
  useEffect(() => {
    const unsubTranscript = voiceTrigger.onTranscript((_partial, final) => {
      if (final) {
        setVoiceTranscript(final);
        addLog({ source: 'voice', type: 'info', message: `Recognized: "${final}"` });
      }
    });

    const unsubState = voiceTrigger.onState((state: VoiceState) => {
      setVoiceState(state);
    });

    const unsubRejection = voiceTrigger.onRejection((rejection) => {
      addLog({ source: 'voice', type: 'error', message: `Rejected: ${rejection.reason} (${rejection.raw})` });
    });

    return () => {
      unsubTranscript();
      unsubState();
      unsubRejection();
    };
  }, [addLog]);

  const toggleVoice = useCallback(() => {
    if (voiceState === 'transcribing') return;
    if (voiceState === 'listening') {
      voiceTrigger.stopVoice();
    } else {
      voiceTrigger.startVoice();
    }
  }, [voiceState]);

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
            {!isAuthenticated ? (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#111' }}>🔒 System Locked</h3>
                <p style={{ fontSize: '0.8rem', color: '#555', marginBottom: '1rem' }}>Enter secret PIN to unlock physical command execution.</p>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '1rem' }}>
                  <input 
                    type="password" 
                    value={authPin} 
                    onChange={e => setAuthPin(e.target.value)} 
                    placeholder="Secret PIN"
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', textAlign: 'center', width: '150px' }}
                  />
                </div>
                <button 
                  onClick={() => {
                    if (authPin === (import.meta.env.VITE_SECRET_PIN || '117117')) {
                      setIsAuthenticated(true);
                      setAuthPin('');
                    } else {
                      alert('Access Denied');
                    }
                  }}
                  style={{ padding: '0.5rem 1.5rem', background: 'linear-gradient(135deg, #0066cc, #004c99)', color: '#fff', border: 'none', borderRadius: '50px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Authenticate
                </button>
              </div>
            ) : (
              <div>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#111' }}>🔓 Execute Physical Sequence</h3>
                <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>Enter a 6-digit sequence to press (keys 1-6 only).</p>

                {seqError && (
                  <div style={{ color: 'red', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
                    {seqError}
                  </div>
                )}
                
                {seqStatus && seqStatus.status !== 'IDLE' && (
                  <div style={{ marginBottom: '1rem', background: seqStatus.status === 'FAULT' ? '#ffcccc' : (seqStatus.status === 'SUCCESS' ? '#ccffcc' : '#e6f7ff'), padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      Status: <span style={{ color: seqStatus.status === 'FAULT' ? 'red' : (seqStatus.status === 'SUCCESS' ? 'green' : 'blue') }}>{seqStatus.status}</span>
                    </div>
                    {seqStatus.status === 'EXECUTING' && seqStatus.activeDigitIndex >= 0 && (
                      <>
                        <div>Active Digit: <b>{seqStatus.pin[seqStatus.activeDigitIndex]}</b> (Index {seqStatus.activeDigitIndex + 1}/6)</div>
                        <div>Phase: <b>{seqStatus.phase}</b></div>
                        
                        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button 
                            onClick={() => {
                              if (isPaused) {
                                fsm.resume();
                                setIsPaused(false);
                              } else {
                                fsm.pause();
                                setIsPaused(true);
                              }
                            }} 
                            style={{ padding: '0.35rem 1rem', cursor: 'pointer', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold' }}
                          >
                            {isPaused ? '▶ Play' : '⏸ Pause'}
                          </button>
                          <button 
                            onClick={() => { 
                              fsm.reset(); 
                              setSeqStatus({...seqStatus, status: 'FAULT'}); 
                              setIsPaused(false);
                            }} 
                            style={{ padding: '0.35rem 1rem', cursor: 'pointer', color: 'red', background: '#fff', border: '1px solid #f99', borderRadius: '4px', fontWeight: 'bold' }}
                          >
                            ⏹ Reset
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
                    disabled={seqStatus?.status === 'EXECUTING'}
                    style={{ width: '2.2rem', height: '3rem', background: 'rgba(255,255,255,0.8)', border: '1px solid #ccc', color: '#111', borderRadius: '8px', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}
                  />
                ))}
                <button 
                  onClick={handleRunPin} 
                  disabled={pin.length !== 6 || seqStatus?.status === 'EXECUTING'} 
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
            )}
          </>
        )}

        {/* VOICE MODE */}
        {controlMode === 'VOICE' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '0.5rem 0' }}>
            <button 
              onClick={toggleVoice}
              disabled={voiceState === 'transcribing'}
              className={
                voiceState === 'listening' 
                  ? 'pulse-listening' 
                  : (voiceState === 'transcribing' ? 'pulse-transcribing' : '')
              }
              style={{
                width: '120px', height: '120px', borderRadius: '50%',
                background: voiceState === 'listening' 
                  ? 'rgba(255,51,51,0.1)' 
                  : (voiceState === 'transcribing' ? 'rgba(234,179,8,0.1)' : 'rgba(0,102,204,0.05)'),
                border: `2px solid ${
                  voiceState === 'listening' 
                    ? '#cc0000' 
                    : (voiceState === 'transcribing' ? '#d97706' : '#0066cc')
                }`,
                color: voiceState === 'listening' 
                  ? '#cc0000' 
                  : (voiceState === 'transcribing' ? '#d97706' : '#0066cc'),
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                boxShadow: voiceState === 'listening' ? '0 0 30px rgba(255,51,51,0.2)' : 'none',
                transition: 'all 0.3s',
                cursor: voiceState === 'transcribing' ? 'not-allowed' : 'pointer'
              }}
            >
              <span style={{ fontWeight: 'bold' }}>
                {voiceState === 'listening' && 'LISTENING'}
                {voiceState === 'transcribing' && 'TRANSCRIBING...'}
                {voiceState !== 'listening' && voiceState !== 'transcribing' && 'TAP TO SPEAK'}
              </span>
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
                      background: voiceState === 'listening' ? '#cc0000' : '#ccc', 
                      height: voiceState === 'listening' ? '20%' : '20%',
                      borderRadius: '2px',
                      animation: voiceState === 'listening' ? `sound-bounce-${i} 0.5s ease-in-out infinite alternate ${bar.d}` : 'none',
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
