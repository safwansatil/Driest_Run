import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Terminal } from 'lucide-react';

export default function AuditLog() {
  const logs = useStore(state => state.logs);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // We reverse the render order so new logs are at bottom, autoscroll down
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="glass-panel" style={{ width: '400px', display: 'flex', flexDirection: 'column', padding: '1rem', zIndex: 10 }}>
      <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Terminal size={20} /> Audit Log
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
          gap: '4px'
        }}
      >
        {/* Render in reverse since logs array has newest at index 0 */}
        {[...logs].reverse().map(log => {
          let color = '#ccc';
          if (log.type === 'error') color = '#ff4444';
          if (log.type === 'warn') color = '#ffcc00';
          if (log.type === 'success') color = '#00cc44';

          const time = new Date(log.timestamp).toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm

          return (
            <div key={log.id} style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#555', minWidth: '85px' }}>[{time}]</span>
              <span style={{ color: '#888', minWidth: '70px' }}>[{log.source}]</span>
              <span style={{ color }}>{log.message}</span>
            </div>
          );
        })}
        {logs.length === 0 && <div style={{ color: '#666', textAlign: 'center', marginTop: '1rem' }}>No logs yet...</div>}
      </div>
    </div>
  );
}
