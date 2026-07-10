import { describe, it, expect } from 'vitest';
import { parseUtterance, parseUtteranceSequence } from './grammar';

describe('parseUtterance', () => {
  // happy path: jog joint
  it('parses "jog joint 3 by 45 degrees"', () => {
    const result = parseUtterance('jog joint 3 by 45 degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(2);
    expect(result.deltaRad).toBeCloseTo(Math.PI / 4, 10);
    expect(result.source).toBe('voice');
    expect(typeof result.id).toBe('string');
    expect(typeof result.timestamp).toBe('number');
  });

  // happy path: go to key
  it('parses "go to key 2"', () => {
    const result = parseUtterance('go to key 2');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('press_key');
    expect(result.keyIndex).toBe(2);
    expect(result.source).toBe('voice');
  });

  // happy path: press key
  it('parses "press key 4"', () => {
    const result = parseUtterance('press key 4');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('press_key');
    expect(result.keyIndex).toBe(4);
    expect(result.source).toBe('voice');
  });

  // happy path: enter pin with digits
  it('parses "enter pin 123456"', () => {
    const result = parseUtterance('enter pin 123456');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('enter_pin');
    expect(result.digits).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.source).toBe('voice');
  });

  // happy path: enter pin with dashes
  it('parses "enter pin 1-2-3-4-5-6"', () => {
    const result = parseUtterance('enter pin 1-2-3-4-5-6');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('enter_pin');
    expect(result.digits).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // happy path: enter pin with spaces
  it('parses "enter pin 1 2 3 4 5 6"', () => {
    const result = parseUtterance('enter pin 1 2 3 4 5 6');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('enter_pin');
    expect(result.digits).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // happy path: press pin with spaces
  it('parses "press pin 1 2 3 4 5 6"', () => {
    const result = parseUtterance('press pin 1 2 3 4 5 6');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('enter_pin');
    expect(result.digits).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // happy path: rotate joint
  it('parses "rotate joint 2 to 90 degrees"', () => {
    const result = parseUtterance('rotate joint 2 to 90 degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('rotate_joint');
    expect(result.jointIndex).toBe(1);
    expect(result.absRad).toBeCloseTo(Math.PI / 2, 10);
    expect(result.source).toBe('voice');
  });

  // happy path: home
  it('parses "home"', () => {
    const result = parseUtterance('home');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('goto');
    expect(result.targetName).toBe('home');
    expect(result.source).toBe('voice');
  });

  // happy path: go home
  it('parses "go home"', () => {
    const result = parseUtterance('go home');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('goto');
    expect(result.targetName).toBe('home');
  });

  // happy path: stop
  it('parses "stop"', () => {
    const result = parseUtterance('stop');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('estop');
    expect(result.source).toBe('voice');
  });

  // happy path: emergency stop
  it('parses "emergency stop"', () => {
    const result = parseUtterance('emergency stop');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('estop');
  });

  // happy path: e stop
  it('parses "e stop"', () => {
    const result = parseUtterance('e stop');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('estop');
  });

  // filler-word tolerance
  it('tolerates filler words in jog command', () => {
    const result = parseUtterance('please jog joint 3 by 45 degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(2);
  });

  it('tolerates "could you" in key command', () => {
    const result = parseUtterance('could you press key 3');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('press_key');
    expect(result.keyIndex).toBe(3);
  });

  it('tolerates "uh" in pin command', () => {
    const result = parseUtterance('uh enter pin 123456');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('enter_pin');
    expect(result.digits).toEqual([1, 2, 3, 4, 5, 6]);
  });

  // word-number vs digit
  it('parses word number "one" for joint', () => {
    const result = parseUtterance('jog joint one by 30 degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(0);
    expect(result.deltaRad).toBeCloseTo(30 * Math.PI / 180, 10);
  });

  it('parses digit "1" for joint', () => {
    const result = parseUtterance('jog joint 1 by 30 degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(0);
  });

  it('parses word number "five" for key', () => {
    const result = parseUtterance('press key five');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('press_key');
    expect(result.keyIndex).toBe(5);
  });

  // rejects out of range
  it('rejects "jog joint 9 by 30 degrees" (out of range)', () => {
    const result = parseUtterance('jog joint 9 by 30 degrees');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('out of range');
    }
  });

  it('rejects "press key 7" (out of range)', () => {
    const result = parseUtterance('press key 7');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('out of range');
    }
  });

  // rejects too short PIN
  it('rejects "enter pin 12345" (too short)', () => {
    const result = parseUtterance('enter pin 12345');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('6 digits');
    }
  });

  it('rejects "enter pin 1234567" (too long)', () => {
    const result = parseUtterance('enter pin 1234567');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('6 digits');
    }
  });

  // rejects garbage utterances
  it('rejects unrecognized utterance', () => {
    const result = parseUtterance('garbage text here');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('Unrecognized command');
    }
  });

  it('rejects empty string', () => {
    const result = parseUtterance('');
    expect(result.ok).toBe(false);
  });

  // case-insensitivity
  it('is case-insensitive', () => {
    const result = parseUtterance('JOG JOINT 3 BY 45 DEGREES');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(2);
  });

  // whitespace tolerance
  it('tolerates extra whitespace', () => {
    const result = parseUtterance('jog   joint   3   by   45   degrees');
    if (result.ok) throw new Error('Expected ok:true');
    expect(result.type).toBe('jog');
    expect(result.jointIndex).toBe(2);
  });

  // punctuation tolerance
  it('tolerates punctuation like periods, exclamation marks, and commas', () => {
    const resultHome = parseUtterance('Go home.');
    if (resultHome.ok) throw new Error('Expected ok:true');
    expect(resultHome.type).toBe('goto');
    expect(resultHome.targetName).toBe('home');

    const resultStop = parseUtterance('Stop!');
    if (resultStop.ok) throw new Error('Expected ok:true');
    expect(resultStop.type).toBe('estop');

    const resultJog = parseUtterance('jog joint 1, by 10 degrees.');
    if (resultJog.ok) throw new Error('Expected ok:true');
    expect(resultJog.type).toBe('jog');
    expect(resultJog.jointIndex).toBe(0);
  });

  // homophone tolerance
  it('parses homophone word numbers correctly', () => {
    const resultTo = parseUtterance('press key to');
    if (resultTo.ok) throw new Error('Expected ok:true');
    expect(resultTo.type).toBe('press_key');
    expect(resultTo.keyIndex).toBe(2);

    const resultToo = parseUtterance('press key too');
    if (resultToo.ok) throw new Error('Expected ok:true');
    expect(resultToo.type).toBe('press_key');
    expect(resultToo.keyIndex).toBe(2);

    const resultFor = parseUtterance('press key for');
    if (resultFor.ok) throw new Error('Expected ok:true');
    expect(resultFor.type).toBe('press_key');
    expect(resultFor.keyIndex).toBe(4);
  });

  // move commands
  it('parses move direction commands with and without distance/units', () => {
    const resultUp = parseUtterance('move up');
    if (resultUp.ok) throw new Error('Expected ok:true');
    expect(resultUp.type).toBe('jog');
    expect(resultUp.delta?.z).toBeCloseTo(0.05, 10);

    const resultLeft = parseUtterance('move left by 10 centimeters');
    if (resultLeft.ok) throw new Error('Expected ok:true');
    expect(resultLeft.type).toBe('jog');
    expect(resultLeft.delta?.y).toBeCloseTo(0.1, 10);

    const resultForward = parseUtterance('move forward 2 inches');
    if (resultForward.ok) throw new Error('Expected ok:true');
    expect(resultForward.type).toBe('jog');
    expect(resultForward.delta?.x).toBeCloseTo(2 * 0.0254, 10);

    const resultDown = parseUtterance('down by 3 m');
    if (resultDown.ok) throw new Error('Expected ok:true');
    expect(resultDown.type).toBe('jog');
    expect(resultDown.delta?.z).toBeCloseTo(-3, 10);
  });

  // rotate base commands
  it('parses rotate base commands correctly', () => {
    const resultRelative = parseUtterance('rotate base 30 degrees');
    if (resultRelative.ok) throw new Error('Expected ok:true');
    expect(resultRelative.type).toBe('jog');
    expect(resultRelative.jointIndex).toBe(0);
    expect(resultRelative.deltaRad).toBeCloseTo(30 * Math.PI / 180, 10);

    const resultAbsolute = parseUtterance('rotate base to 45 degrees');
    if (resultAbsolute.ok) throw new Error('Expected ok:true');
    expect(resultAbsolute.type).toBe('rotate_joint');
    expect(resultAbsolute.jointIndex).toBe(0);
    expect(resultAbsolute.absRad).toBeCloseTo(45 * Math.PI / 180, 10);
  });

  // sequence and repetition parsing
  describe('parseUtteranceSequence', () => {
    it('parses a single command correctly', () => {
      const res = parseUtteranceSequence('press key 3');
      if ('ok' in res && !res.ok) throw new Error('Expected success');
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBe(1);
      expect(res[0].type).toBe('press_key');
      expect(res[0].keyIndex).toBe(3);
    });

    it('parses sequential commands correctly', () => {
      const res = parseUtteranceSequence('press key 3 then press key 2 and then go home');
      if ('ok' in res && !res.ok) throw new Error('Expected success');
      expect(res.length).toBe(3);
      expect(res[0].type).toBe('press_key');
      expect(res[0].keyIndex).toBe(3);
      expect(res[1].type).toBe('press_key');
      expect(res[1].keyIndex).toBe(2);
      expect(res[2].type).toBe('goto');
      expect(res[2].targetName).toBe('home');
    });

    it('parses repeated commands with "twice"', () => {
      const res = parseUtteranceSequence('press key 5 twice');
      if ('ok' in res && !res.ok) throw new Error('Expected success');
      expect(res.length).toBe(2);
      expect(res[0].type).toBe('press_key');
      expect(res[0].keyIndex).toBe(5);
      expect(res[1].type).toBe('press_key');
      expect(res[1].keyIndex).toBe(5);
    });

    it('parses repeated commands with "N times"', () => {
      const res = parseUtteranceSequence('jog joint 1 by 10 degrees three times');
      if ('ok' in res && !res.ok) throw new Error('Expected success');
      expect(res.length).toBe(3);
      for (const cmd of res) {
        expect(cmd.type).toBe('jog');
        expect(cmd.jointIndex).toBe(0);
        expect(cmd.deltaRad).toBeCloseTo(10 * Math.PI / 180, 10);
      }
    });

    it('returns error if any command in sequence is invalid', () => {
      const res = parseUtteranceSequence('press key 3 then garbage command');
      expect('ok' in res && res.ok).toBe(false);
    });
  });
});

