import { useEffect, useRef, useState } from 'react';

import { auditLog } from '../audit';
import type { AuditEntry } from '../audit';

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Quick hack to poll for new logs since we don't have an event emitter in the stub
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs(auditLog.getLog().slice(-3));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '1rem', zIndex: 10, boxSizing: 'border-box' }}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#111' }}>
        Session Log
      </h2>
      
      <div 
        ref={scrollRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          background: 'rgba(255,255,255,0.8)', 
          border: '1px solid #ccc',
          borderRadius: '8px', 
          padding: '0.5rem',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {[...logs].map(log => {
          let color = '#333';
          if (log.verdict === 'REJECTED') {
             color = '#cc0000';
          } else if (log.verdict === 'ACCEPTED') {
             color = '#008800';
          }

          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1);

          return (
            <div key={log.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: '#888', minWidth: '85px' }}>[{time}]</span>
                <span style={{ color: '#555', minWidth: '70px', fontWeight: 'bold' }}>[{log.command.source}]</span>
                <span style={{ color, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {log.command.type} - {log.verdict}
                </span>
              </div>
            </div>
          );
        })}
        {logs.length === 0 && <div style={{ color: '#666', textAlign: 'center', marginTop: '1rem' }}>No commands audited yet...</div>}
      </div>
    </div>
  );
};

export default AuditLog;
