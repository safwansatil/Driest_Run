<<<<<<< HEAD
import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Terminal, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
=======
import React, { useState, useEffect, useRef } from 'react';
import { commandBus } from '../safety/commandBus';
import { LogEntry } from '../types';
import { Terminal, Shield, Download, FileSpreadsheet, RefreshCw, ClipboardCheck } from 'lucide-react';
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235

export const AuditLog: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
<<<<<<< HEAD
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
=======
    // Populate initial logs
    setLogs(commandBus.getLogs());

    // Subscribe to new logs
    const unsubscribe = commandBus.subscribeToLogs((newLog) => {
      setLogs((prev) => [...prev, newLog].slice(-300));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Scroll to bottom of terminal
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
  }, [logs]);

  // Compute Session Statistics for the Audit Report
  const totalCommands = logs.filter(l => l.message.includes('Processing')).length;
  const safetyPasses = logs.filter(l => l.source === 'SAFETY_GATE' && l.type === 'success').length;
  const safetyViolations = logs.filter(l => l.source === 'SAFETY_GATE' && l.type === 'error').length;
  const ikSuccesses = logs.filter(l => l.source === 'IK_SOLVER' && l.type === 'success').length;
  const estops = logs.filter(l => l.message.includes('E-STOP')).length;

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.type === filter;
  });

  const getLogClass = (type: string) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'warn': return 'text-amber-400';
      case 'error': return 'text-red-400 font-bold';
      default: return 'text-gray-300';
    }
  };

  const exportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Vantage_Audit_Trail_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
<<<<<<< HEAD
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
=======
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[480px]">
      
      {/* 1. Terminal Console */}
      <div className="lg:col-span-2 flex flex-col h-full bg-[#131518]/95 border border-white/5 rounded-xl shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="flex items-center justify-between bg-white/5 px-4 py-2.5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-500" />
            <span className="text-white/80 font-mono text-xs font-bold uppercase tracking-wider">
              Safety Gate Audit Terminal
            </span>
          </div>
          
          {/* Filters */}
          <div className="flex gap-1">
            {(['all', 'info', 'success', 'warn', 'error'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                  filter === type
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Terminal logs list */}
        <div className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed space-y-1.5 h-[340px] max-h-[340px]">
          {filteredLogs.length === 0 ? (
            <div className="text-white/30 text-center py-12 italic">
              No audit logs recorded for filter: {filter}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-1">
                <span className="text-white/30 shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span className="text-amber-500/70 font-bold shrink-0">
                  {log.source}:
                </span>
                <span className={getLogClass(log.type)}>
                  {log.message}
                </span>
              </div>
            ))
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Terminal Action Footer */}
        <div className="bg-white/5 px-4 py-2 border-t border-white/5 flex justify-between items-center">
          <span className="text-[10px] text-white/30 font-mono">
            LOG CAPACITY: {logs.length}/300 ENTRIES
          </span>
          <button
            onClick={exportLogs}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-mono font-bold text-xs px-3 py-1 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            EXPORT AUDIT JSON
          </button>
        </div>
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
      </div>

      {/* 2. End-of-Session Audit Report */}
      <div className="bg-white/[0.02] border border-white/5 rounded-xl p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-amber-500" />
            <h3 className="text-white font-mono font-bold text-sm uppercase tracking-wider">
              Safety Verification Report
            </h3>
          </div>

          <p className="text-white/60 font-mono text-xs mb-4 leading-relaxed">
            This live report validates that Vantage’s motion-control safety pipeline remains 100% compliant with hardware protection rules.
          </p>

          <div className="space-y-3 font-mono">
            {/* Stat Row */}
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40 text-xs">Total Commands Submitted</span>
              <span className="text-white font-bold text-xs">{totalCommands}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40 text-xs">Safety Gate Clearances</span>
              <span className="text-emerald-400 font-bold text-xs">{safetyPasses}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40 text-xs">Safety Gate Violations Blocked</span>
              <span className={`text-xs font-bold ${safetyViolations > 0 ? 'text-red-400 animate-pulse' : 'text-white/40'}`}>
                {safetyViolations}
              </span>
            </div>

            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40 text-xs">IK Convergences</span>
              <span className="text-cyan-400 font-bold text-xs">{ikSuccesses}</span>
            </div>

            <div className="flex justify-between border-b border-white/5 pb-2">
              <span className="text-white/40 text-xs">Hardware E-Stops Tripped</span>
              <span className={`text-xs font-bold ${estops > 0 ? 'text-red-400 animate-pulse' : 'text-white/40'}`}>
                {estops}
              </span>
            </div>
          </div>
        </div>

        {/* Integrity status check */}
        <div className="mt-6 bg-white/5 p-4 rounded-xl border border-white/5 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className={`w-4 h-4 ${safetyViolations === 0 && estops === 0 ? 'text-emerald-400' : 'text-amber-500'}`} />
            <span className="text-white font-mono text-xs font-bold uppercase tracking-wide">
              Pipeline Verdict
            </span>
          </div>
          <div className="font-mono text-xs">
            {safetyViolations === 0 && estops === 0 ? (
              <span className="text-emerald-400">
                ● COMPLIANT: 0 safety violations allowed to reach simulated hardware.
              </span>
            ) : (
              <span className="text-amber-400">
                ▲ ATTENTION: {safetyViolations} validation violations intercepted. E-Stop triggered {estops} times. Hardware protected.
              </span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
