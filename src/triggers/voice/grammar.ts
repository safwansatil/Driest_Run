import type { ArmCommand } from '../../types/commands';
import { useStore } from '../../store';


export interface ParseError {
  ok: false;
  reason: string;
  raw: string;
}

const WORD_NUMBERS: Record<string, number> = {
  'one': 1,
  'won': 1,
  'two': 2,
  'to': 2,
  'too': 2,
  'three': 3,
  'four': 4,
  'for': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'ate': 8,
  'nine': 9,
  'ten': 10
};


const FILLER_RE = /\b(?:please|could\s+you|uh)\b/gi;

function stripFillers(text: string): string {
  return text.replace(FILLER_RE, '').replace(/\s+/g, ' ').trim();
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').trim();
}


function parseNumberToken(token: string): number | null {
  const trimmed = token.trim().toLowerCase();
  if (WORD_NUMBERS[trimmed] !== undefined) {
    return WORD_NUMBERS[trimmed];
  }
  const num = parseFloat(trimmed);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }
  return null;
}

export function isParseError(result: ArmCommand | ParseError): result is ParseError {
  return (result as ParseError).ok === false;
}

export function parseUtterance(text: string): ArmCommand | ParseError {
  const raw = text;
  const cleaned = stripFillers(text);
  const normalized = normalize(cleaned);

  const moveMatch = normalized.match(/^(?:move\s+)?(up|down|left|right|forward|backward)(?:\s+by)?(?:\s+(\S+))?(?:\s+(meters|meter|centimeters|centimeter|inches|inch|cms|cm|m))?$/);
  if (moveMatch) {
    const direction = moveMatch[1];
    const valStr = moveMatch[2];
    const unitStr = moveMatch[3];
    
    let distance = 0.05; // default fallback
    try {
      const stepSize = useStore.getState().stepSize;
      if (typeof stepSize === 'number' && !isNaN(stepSize)) {
        distance = stepSize;
      }
    } catch {
      // ignore
    }

    if (valStr) {
      const parsedVal = parseNumberToken(valStr);
      if (parsedVal === null) {
        return { ok: false, reason: `Invalid distance value: ${valStr}`, raw };
      }
      distance = parsedVal;
      const unit = unitStr ? unitStr.toLowerCase() : 'meters';
      if (unit.startsWith('cm') || unit.startsWith('cent')) {
        distance = distance / 100;
      } else if (unit.startsWith('inch')) {
        distance = distance * 0.0254;
      }
    }

    let dx = 0;
    let dy = 0;
    let dz = 0;

    if (direction === 'up') dz = distance;
    else if (direction === 'down') dz = -distance;
    else if (direction === 'left') dy = distance;
    else if (direction === 'right') dy = -distance;
    else if (direction === 'forward') dx = distance;
    else if (direction === 'backward') dx = -distance;

    return {
      type: 'jog',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      delta: { x: dx, y: dy, z: dz }
    };
  }

  const rotateBaseToMatch = normalized.match(/^(?:rotate\s+base|rotate\s+joint\s+1)\s+to\s+(\S+)\s+degrees$/);
  if (rotateBaseToMatch) {
    const deg = parseNumberToken(rotateBaseToMatch[1]);
    if (deg === null) {
      return { ok: false, reason: `Invalid degree value: ${rotateBaseToMatch[1]}`, raw };
    }
    return {
      type: 'rotate_joint',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      jointIndex: 0,
      absRad: deg * Math.PI / 180
    };
  }

  const rotateBaseMatch = normalized.match(/^(?:rotate\s+base|rotate\s+joint\s+1)\s+(?:by\s+)?(\S+)\s+degrees$/);
  if (rotateBaseMatch) {
    const deg = parseNumberToken(rotateBaseMatch[1]);
    if (deg === null) {
      return { ok: false, reason: `Invalid degree value: ${rotateBaseMatch[1]}`, raw };
    }
    return {
      type: 'jog',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      jointIndex: 0,
      deltaRad: deg * Math.PI / 180
    };
  }

  const jogMatch = normalized.match(/^jog\s+joint\s+(\S+)\s+by\s+(\S+)\s+degrees$/);
  if (jogMatch) {
    const jointNum = parseNumberToken(jogMatch[1]);
    const deg = parseNumberToken(jogMatch[2]);
    if (jointNum === null) {
      return { ok: false, reason: `Invalid joint number: ${jogMatch[1]}`, raw };
    }
    if (deg === null) {
      return { ok: false, reason: `Invalid degree value: ${jogMatch[2]}`, raw };
    }
    const jointIndex = Math.round(jointNum) - 1;
    if (jointIndex < 0 || jointIndex > 5) {
      return { ok: false, reason: `Joint index out of range (1-6): ${jointNum}`, raw };
    }
    return {
      type: 'jog',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      jointIndex,
      deltaRad: deg * Math.PI / 180
    };
  }

  const keyMatch = normalized.match(/^(?:go\s+to\s+key|press\s+key)\s+(\S+)$/);
  if (keyMatch) {
    const keyNum = parseNumberToken(keyMatch[1]);
    if (keyNum === null) {
      return { ok: false, reason: `Invalid key number: ${keyMatch[1]}`, raw };
    }
    const keyIndex = Math.round(keyNum);
    if (keyIndex < 1 || keyIndex > 6) {
      return { ok: false, reason: `Key index out of range (1-6): ${keyNum}`, raw };
    }
    return {
      type: 'press_key',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      keyIndex
    };
  }

  const pinMatch = normalized.match(/^(?:enter\s+pin|press\s+pin)\s+(.+)$/);
  if (pinMatch) {
    const digitsStr = pinMatch[1].replace(/[\s-]/g, '');
    if (!/^\d+$/.test(digitsStr)) {
      return { ok: false, reason: 'PIN must contain only digits, spaces, or dashes', raw };
    }
    if (digitsStr.length !== 6) {
      return { ok: false, reason: `PIN must be exactly 6 digits, got ${digitsStr.length}`, raw };
    }
    return {
      type: 'enter_pin',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      digits: digitsStr.split('').map(Number)
    };
  }

  const rotateMatch = normalized.match(/^rotate\s+joint\s+(\S+)\s+to\s+(\S+)\s+degrees$/);
  if (rotateMatch) {
    const jointNum = parseNumberToken(rotateMatch[1]);
    const deg = parseNumberToken(rotateMatch[2]);
    if (jointNum === null) {
      return { ok: false, reason: `Invalid joint number: ${rotateMatch[1]}`, raw };
    }
    if (deg === null) {
      return { ok: false, reason: `Invalid degree value: ${rotateMatch[2]}`, raw };
    }
    const jointIndex = Math.round(jointNum) - 1;
    if (jointIndex < 0 || jointIndex > 5) {
      return { ok: false, reason: `Joint index out of range (1-6): ${jointNum}`, raw };
    }
    return {
      type: 'rotate_joint',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      jointIndex,
      absRad: deg * Math.PI / 180
    };
  }

  if (/^(?:go\s+)?home$/.test(normalized)) {
    return {
      type: 'goto',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      targetName: 'home'
    };
  }

  if (/^(?:emergency\s+)?(?:e\s+)?stop$/.test(normalized)) {
    return {
      type: 'estop',
      source: 'voice',
      id: crypto.randomUUID(),
      timestamp: Date.now()
    };
  }

  return { ok: false, reason: 'Unrecognized command', raw };
}

export function parseUtteranceSequence(text: string): ArmCommand[] | ParseError {
  const parts = text.split(/\b(?:then|and\s+then)\b|,/gi);
  const commands: ArmCommand[] = [];

  for (const part of parts) {
    let cleanPart = part.trim();
    if (!cleanPart) continue;

    let multiplier = 1;

    // Detect repetition keywords (e.g. "twice", "double", "three times")
    const twiceMatch = cleanPart.match(/\b(?:twice|double)\b$/i);
    const timesMatch = cleanPart.match(/\b(\S+)\s+times\b$/i);

    if (twiceMatch) {
      multiplier = 2;
      cleanPart = cleanPart.replace(/\b(?:twice|double)\b$/i, '').trim();
    } else if (timesMatch) {
      const parsedTimes = parseNumberToken(timesMatch[1]);
      if (parsedTimes !== null) {
        multiplier = Math.round(parsedTimes);
      }
      cleanPart = cleanPart.replace(/\b\S+\s+times\b$/i, '').trim();
    }

    const cmd = parseUtterance(cleanPart);
    if (isParseError(cmd)) {
      return cmd; // Abort entire sequence on any syntax error
    }

    for (let m = 0; m < multiplier; m++) {
      commands.push({ ...cmd, id: crypto.randomUUID() });
    }
  }

  if (commands.length === 0) {
    return { ok: false, reason: 'Empty command sequence', raw: text };
  }

  return commands;
}

