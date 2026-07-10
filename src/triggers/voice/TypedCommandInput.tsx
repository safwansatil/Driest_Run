import { useState, useEffect, useRef, useCallback } from 'react';
import { commandBus } from '../../bus/commandBus';
import { parseUtterance, isParseError } from './grammar';
import { auditLog } from '../../audit';

interface HistoryEntry {
  id: string;
  raw: string;
  verdict: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  reason?: string;
}

export const TypedCommandInput = () => {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pendingRef = useRef<Set<string>>(new Set());

  const poll = useCallback(() => {
    const logs = auditLog.getLog();
    setHistory(prev => {
      const next = [...prev];
      let changed = false;
      for (const entry of logs) {
        if (pendingRef.current.has(entry.command.id)) {
          const idx = next.findIndex(h => h.id === entry.command.id);
          if (idx !== -1) {
            next[idx] = {
              id: entry.command.id,
              raw: next[idx].raw,
              verdict: entry.verdict,
              reason: entry.reason
            };
            changed = true;
          }
          pendingRef.current.delete(entry.command.id);
        }
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [poll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    const result = parseUtterance(trimmed);
    if (isParseError(result)) {
      const entryId = crypto.randomUUID();
      setHistory(prev => [
        { id: entryId, raw: trimmed, verdict: 'REJECTED', reason: result.reason } as HistoryEntry,
        ...prev
      ].slice(0, 3));
      setText('');
      return;
    }

    const cmd = { ...result, source: 'typed' as const };
    pendingRef.current.add(cmd.id);
    setHistory(prev => [
      { id: cmd.id, raw: trimmed, verdict: 'PENDING' } as HistoryEntry,
      ...prev
    ].slice(0, 3));
    setText('');
    commandBus.dispatch(cmd);
  };

  return (
    <div
      style={{
        background: 'rgba(0,0,0,0.7)',
        borderRadius: '8px',
        padding: '12px',
        minWidth: '260px',
        maxWidth: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        fontFamily: 'sans-serif',
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type command..."
          style={{
            flex: 1,
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #444',
            background: '#222',
            color: 'white',
            fontSize: '14px',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            background: '#3b82f6',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Send
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {history.length === 0 && (
          <div style={{ opacity: 0.5, fontSize: '12px' }}>No commands yet</div>
        )}
        {history.map(entry => (
          <div
            key={entry.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 8px',
              borderRadius: '4px',
              background: entry.verdict === 'ACCEPTED' ? 'rgba(0,200,0,0.1)' :
                         entry.verdict === 'REJECTED' ? 'rgba(255,0,0,0.1)' :
                         'rgba(255,255,0,0.1)',
              border: `1px solid ${
                entry.verdict === 'ACCEPTED' ? '#00cc44' :
                entry.verdict === 'REJECTED' ? '#ef4444' :
                '#eab308'
              }`,
              fontSize: '12px',
            }}
          >
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 'bold',
                background: entry.verdict === 'ACCEPTED' ? '#00cc44' :
                           entry.verdict === 'REJECTED' ? '#ef4444' :
                           '#eab308',
                color: 'white',
              }}
            >
              {entry.verdict}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.raw}
            </span>
            {entry.reason && (
              <span style={{ opacity: 0.7, fontSize: '11px' }}>{entry.reason}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
