import type { ArmCommand } from '../../types/commands';

export interface ParseError {
  ok: false;
  reason: string;
  raw: string;
}

const WORD_NUMBERS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
};

const FILLER_RE = /\b(?:please|could\s+you|uh)\b/gi;

function stripFillers(text: string): string {
  return text.replace(FILLER_RE, '').replace(/\s+/g, ' ').trim();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

function parseNumberToken(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (WORD_NUMBERS[trimmed] !== undefined) return WORD_NUMBERS[trimmed];
  const num = parseFloat(trimmed);
  if (!isNaN(num) && isFinite(num)) return num;
  return null;
}

export function isParseError(result: ArmCommand | ParseError): result is ParseError {
  return (result as ParseError).ok === false;
}

export function parseUtterance(text: string): ArmCommand | ParseError {
  const raw = text;
  const cleaned = stripFillers(text);
  const normalized = normalize(cleaned);

  const jogMatch = normalized.match(/^jog\s+joint\s+(\S+)\s+by\s+(\S+)\s+degrees$/);
  if (jogMatch) {
    const jointNum = parseNumberToken(jogMatch[1]);
    const deg = parseNumberToken(jogMatch[2]);
    if (jointNum === null) return { ok: false, reason: `Invalid joint number: ${jogMatch[1]}`, raw };
    if (deg === null) return { ok: false, reason: `Invalid degree value: ${jogMatch[2]}`, raw };
    const jointIndex = Math.round(jointNum);
    if (jointIndex < 1 || jointIndex > 6) return { ok: false, reason: `Joint index out of range (1-6): ${jointNum}`, raw };
    
    return {
      type: 'setJoint',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      joint: { name: `joint_${jointIndex}`, delta: deg * Math.PI / 180 }
    };
  }

  const rotateMatch = normalized.match(/^rotate\s+joint\s+(\S+)\s+to\s+(\S+)\s+degrees$/);
  if (rotateMatch) {
    const jointNum = parseNumberToken(rotateMatch[1]);
    const deg = parseNumberToken(rotateMatch[2]);
    if (jointNum === null) return { ok: false, reason: `Invalid joint number: ${rotateMatch[1]}`, raw };
    if (deg === null) return { ok: false, reason: `Invalid degree value: ${rotateMatch[2]}`, raw };
    const jointIndex = Math.round(jointNum);
    if (jointIndex < 1 || jointIndex > 6) return { ok: false, reason: `Joint index out of range (1-6): ${jointNum}`, raw };
    
    return {
      type: 'setJoint',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      joint: { name: `joint_${jointIndex}`, value: deg * Math.PI / 180 }
    };
  }

  return { ok: false, reason: 'Unrecognized command. Only joint jog and rotate are supported in strict mode.', raw };
}
