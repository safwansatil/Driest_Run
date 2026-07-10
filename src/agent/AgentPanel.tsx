import { useState, useEffect, useRef, useCallback } from 'react';
import { useAgentStore } from './agentStore';
import { runAgent } from './agent';
import { callLLM } from './llmClient';
import { DEMO_PROMPTS } from './demoPrompts';

const AgentPanel = () => {
  const {
    messages,
    isThinking,
    error,
    speakResult,
    waitingForClarification,
    setSpeakResult,
    clearMessages,
  } = useAgentStore();

  const [text, setText] = useState('');
  const [probeError, setProbeError] = useState<string | null>(null);
  const [probing, setProbing] = useState(true);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Probe LLM Proxy on mount with a trivial request
  useEffect(() => {
    const probe = async () => {
      try {
        await callLLM(
          [{ role: 'user', content: 'Ping' }],
          [],
          { model: 'claude-sonnet-4-20250514' }
        );
        setProbeError(null);
      } catch (err: any) {
        if (err.message === 'server-key-missing') {
          setProbeError('ANTHROPIC_API_KEY missing on server; add it in Vercel env');
        } else {
          // If it's a network error or other API issues, show it but don't disable the whole agent
          setProbeError(err.message || 'Failed to connect to LLM proxy');
        }
      } finally {
        setProbing(false);
      }
    };
    probe();
  }, []);

  // Scroll to bottom when messages list changes
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const handleSubmit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || probing || probeError) return;

    setText('');
    await runAgent(trimmed);
  }, [text, probing, probeError]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const displayError = probeError || error;
  const isInputDisabled = probing || !!probeError || isThinking;

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '12px', opacity: 0.8, fontFamily: 'monospace', color: '#60a5fa' }}>
          🤖 AGENT CONTROL
        </div>
        <button
          onClick={clearMessages}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            fontSize: '10px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
          title="Clear history"
        >
          [Clear]
        </button>
      </div>

      {/* Speak Response Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="checkbox"
          id="speakToggle"
          checked={speakResult}
          onChange={(e) => setSpeakResult(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        <label
          htmlFor="speakToggle"
          style={{ fontSize: '11px', color: '#d1d5db', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          Speak Result (TTS)
        </label>
      </div>

      {/* Probe Error Alert Banner */}
      {displayError && (
        <div
          style={{
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            padding: '6px 8px',
            fontSize: '11px',
            color: '#fca5a5',
            fontFamily: 'monospace',
          }}
        >
          {displayError}
        </div>
      )}

      {/* Messages Stream Container */}
      <div
        style={{
          maxHeight: '180px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '4px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '4px',
        }}
      >
        {messages.length === 0 && !isThinking && (
          <div style={{ opacity: 0.5, fontSize: '11px', textAlign: 'center', padding: '12px 0' }}>
            Ask the robot in plain language...
          </div>
        )}

        {messages.map((msg) => {
          let bg = 'transparent';
          let border = 'none';
          let textColor = '#e5e7eb';
          let prefix = '';

          if (msg.sender === 'user') {
            bg = 'rgba(255,255,255,0.08)';
            prefix = '👤 ';
          } else if (msg.type === 'tool_call') {
            bg = 'rgba(234,179,8,0.1)';
            border = '1px dashed rgba(234,179,8,0.4)';
            textColor = '#fef08a';
            prefix = '🔧 ';
          } else if (msg.type === 'clarify') {
            bg = 'rgba(249,115,22,0.1)';
            border = '1px solid rgba(249,115,22,0.4)';
            textColor = '#ffedd5';
            prefix = '❓ ';
          } else if (msg.type === 'rejection') {
            bg = 'rgba(239,68,68,0.1)';
            border = '1px solid rgba(239,68,68,0.4)';
            textColor = '#fee2e2';
            prefix = '⚠️ ';
          } else if (msg.type === 'confirmation') {
            bg = 'rgba(34,197,94,0.1)';
            border = '1px solid rgba(34,197,94,0.4)';
            textColor = '#dcfce7';
            prefix = '✅ ';
          } else {
            prefix = '🤖 ';
          }

          const formattedText =
            msg.type === 'tool_call' && msg.toolCallArgs
              ? `${msg.text} (${JSON.stringify(msg.toolCallArgs)})`
              : msg.text;

          return (
            <div
              key={msg.id}
              style={{
                background: bg,
                border: border,
                borderRadius: '4px',
                padding: '5px 8px',
                fontSize: '11px',
                lineHeight: '1.4',
                color: textColor,
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                wordBreak: 'break-word',
              }}
            >
              <span style={{ fontWeight: 'bold' }}>{prefix}</span>
              {formattedText}
            </div>
          );
        })}

        {/* Thinking Indicator */}
        {isThinking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              color: '#9ca3af',
              padding: '4px',
            }}
          >
            <span className="spin" style={{ display: 'inline-block' }}>
              ⏳
            </span>
            <span>Agent is thinking...</span>
          </div>
        )}

        {/* Waiting for Clarification Indicator */}
        {waitingForClarification && !isThinking && (
          <div
            style={{
              fontSize: '10px',
              color: '#f97316',
              textAlign: 'center',
              padding: '2px',
              fontStyle: 'italic',
            }}
          >
            Awaiting your clarification...
          </div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Demo Prompt Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', margin: '2px 0' }}>
        {DEMO_PROMPTS.map((dp, idx) => (
          <button
            key={idx}
            onClick={() => setText(dp.text)}
            disabled={isInputDisabled}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '12px',
              padding: '2px 8px',
              fontSize: '9px',
              color: '#9ca3af',
              cursor: isInputDisabled ? 'not-allowed' : 'pointer',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            {dp.label}
          </button>
        ))}
      </div>


      {/* Input Row */}
      <div style={{ display: 'flex', gap: '4px' }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            waitingForClarification
              ? 'Reply to clarify...'
              : 'e.g. Press key 3 then go home'
          }
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
            opacity: isInputDisabled ? 0.5 : 1,
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={isInputDisabled || !text.trim()}
          style={{
            background: '#22c55e',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: 'monospace',
            opacity: isInputDisabled || !text.trim() ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default AgentPanel;
