import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Terminal, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

export default function AuditLog() {
  const logs = useStore(state => state.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', padding: '1rem', zIndex: 10 }}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Terminal size={20} /> Session Log (Layer 6)
      </h2>
      
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          background: 'rgba(0,0,0,0.5)', 
          borderRadius: '8px', 
          padding: '0.5rem',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {[...logs].reverse().map(log => {
          let color = '#ccc';
          let Icon = null;
          if (log.type === 'error' || log.verdict === 'REJECTED') {
             color = '#ff4444';
             Icon = XCircle;
          } else if (log.type === 'warn') {
             color = '#ffcc00';
             Icon = AlertCircle;
          } else if (log.type === 'success' || log.verdict === 'ACCEPTED') {
             color = '#00cc44';
             Icon = CheckCircle2;
          }

          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1);

          return (
            <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#555', minWidth: '85px' }}>[{time}]</span>
                <span style={{ color: '#888', minWidth: '70px', fontWeight: 'bold' }}>[{log.source}]</span>
                <span style={{ color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {Icon && <Icon size={12}/>}
                  {log.message}
                </span>
              </div>
              
              {/* Structured Audit Details */}
              {log.verdict && (
                <div style={{ marginLeft: '100px', color: '#999', fontSize: '0.7rem', display: 'flex', flexDirection: 'column' }}>
                   {log.verdict === 'REJECTED' && <span>Reason: <strong style={{color:'#ff4444'}}>{log.rejectReason}</strong></span>}
                   {log.ikError !== undefined && <span>IK Error: {log.ikError.toFixed(4)}</span>}
                   {log.finalTipError !== undefined && <span>Tip Error: {(log.finalTipError * 1000).toFixed(2)} mm</span>}
                   {log.target && <span>Target: {JSON.stringify(log.target)}</span>}
                </div>
              )}
            </div>
          );
        })}
        {logs.length === 0 && <div style={{ color: '#666', textAlign: 'center', marginTop: '1rem' }}>No commands audited yet...</div>}
      </div>
    </div>
  );
}
