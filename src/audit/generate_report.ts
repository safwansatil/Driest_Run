import type { AuditEntry } from './index';

export function generateHTMLReport(logs: AuditEntry[], controlMode: string, startTime: number): string {
  const total = logs.length;
  const accepted = logs.filter(l => l.verdict === 'ACCEPTED').length;
  const rejected = total - accepted;
  
  const successRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  
  const startTimeStr = new Date(startTime).toLocaleString();
  const endTimeStr = new Date().toLocaleString();

  const rowsHtml = logs.map(l => {
    const time = new Date(l.timestamp).toISOString().split('T')[1].slice(0, -1);
    const badgeColor = l.verdict === 'ACCEPTED' ? '#059669' : '#dc2626';
    const badgeBg = l.verdict === 'ACCEPTED' ? '#d1fae5' : '#fee2e2';
    
    return `
      <tr>
        <td>${time}</td>
        <td><span class="source-badge">${l.command.source}</span></td>
        <td><strong>${l.command.type}</strong></td>
        <td><span class="verdict-badge" style="color: ${badgeColor}; background: ${badgeBg};">${l.verdict}</span></td>
        <td>${l.reason || '-'}</td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vantage Robotics - Session Report</title>
  <style>
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background-color: #f8fafc;
      color: #334155;
      margin: 0;
      padding: 40px;
      line-height: 1.6;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    h1 {
      color: #0f172a;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 15px;
      margin-top: 0;
    }
    .header-info {
      display: flex;
      justify-content: space-between;
      color: #64748b;
      margin-bottom: 30px;
      font-size: 0.95rem;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 40px;
    }
    .metric-card {
      background: #f1f5f9;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .metric-card.success { background: #d1fae5; color: #065f46; }
    .metric-card.error { background: #fee2e2; color: #991b1b; }
    .metric-value {
      font-size: 2rem;
      font-weight: bold;
      margin-top: 5px;
    }
    .metric-label {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
      font-size: 0.9rem;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
    }
    tr:hover { background: #f8fafc; }
    .verdict-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: bold;
    }
    .source-badge {
      background: #e2e8f0;
      color: #475569;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Vantage Robotics Executive Summary</h1>
    
    <div class="header-info">
      <div><strong>Control Mode:</strong> ${controlMode.toUpperCase()}</div>
      <div><strong>Session Timeline:</strong> ${startTimeStr} &mdash; ${endTimeStr}</div>
    </div>

    <div class="metrics">
      <div class="metric-card">
        <div class="metric-label">Total Commands</div>
        <div class="metric-value">${total}</div>
      </div>
      <div class="metric-card success">
        <div class="metric-label">Accepted</div>
        <div class="metric-value">${accepted}</div>
      </div>
      <div class="metric-card error">
        <div class="metric-label">Rejected</div>
        <div class="metric-value">${rejected}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value">${successRate}%</div>
      </div>
    </div>

    <h2>Detailed Command Log</h2>
    <table>
      <thead>
        <tr>
          <th>Time</th>
          <th>Source</th>
          <th>Command Type</th>
          <th>Verdict</th>
          <th>Details / Reason</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:30px;">No commands recorded in this session.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;
}

export function generateCSVReport(logs: AuditEntry[], controlMode: string): string {
  const header = ['Timestamp', 'Control Mode', 'Command Source', 'Command Type', 'Verdict', 'Reason'];
  const rows = logs.map(l => {
    const time = new Date(l.timestamp).toISOString();
    return [
      time, 
      controlMode, 
      l.command.source, 
      l.command.type, 
      l.verdict, 
      `"${l.reason?.replace(/"/g, '""') || ''}"`
    ].join(',');
  });
  
  return [header.join(','), ...rows].join('\n');
}
