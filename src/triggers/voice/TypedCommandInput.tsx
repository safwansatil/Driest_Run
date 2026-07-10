import { useState, useCallback } from 'react';
import { parseUtterance, isParseError } from './grammar';
import { commandBus } from '../../bus/commandBus';

interface HistoryEntry {
  verdict: 'accepted' | 'rejected';
  type?: string;
  reason?: string;
  raw: string;
}

const TypedCommandInput = () => {
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const result = parseUtterance(trimmed);

    if (isParseError(result)) {
      setHistory((prev) => [
        { verdict: 'rejected' as const, reason: result.reason, raw: result.raw },
        ...prev,
      ].slice(0, 3));
      setText('');
      return;
    }

    const typedCmd = { ...result, source: 'typed' as const };
    const verdict = await commandBus.dispatch(typedCmd);

    setHistory((prev) => [
      { verdict: verdict as 'accepted' | 'rejected', type: result.type, raw: trimmed },
      ...prev,
    ].slice(0, 3));
    setText('');
  }, [text]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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
      <div style={{ fontSize: '12px', opacity: 0.8, fontFamily: 'monospace' }}>
        TYPED COMMAND
      </div>

      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. jog joint 1 by 30 degrees"
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '4px',
            padding: '6px 8px',
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSubmit}
          style={{
            background: '#22c55e',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          Send
        </button>
      </div>

      {history.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {history.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                padding: '4px 6px',
                background: entry.verdict === 'accepted' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                borderRadius: '4px',
                border: `1px solid ${entry.verdict === 'accepted' ? '#22c55e' : '#ef4444'}`,
              }}
            >
              <span
                style={{
                  color: entry.verdict === 'accepted' ? '#22c55e' : '#ef4444',
                  fontWeight: 'bold',
                  minWidth: '60px',
                }}
              >
                {entry.verdict.toUpperCase()}
              </span>
              <span style={{ color: '#9ca3af', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.raw}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TypedCommandInput;
