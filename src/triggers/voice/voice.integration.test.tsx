import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ArmCommand } from '../../types/commands';

// ---------------------------------------------------------------------------
// Synthetic utterance pools — 20 total
// ---------------------------------------------------------------------------
const VALID_UTTERANCES = [
  'jog joint 1 by 30 degrees',
  'jog joint 3 by 45 degrees',
  'jog joint 6 by 15 degrees',
  'press key 1',
  'go to key 2',
  'press key 4',
  'enter pin 123456',
  'enter pin 000000',
  'rotate joint 2 to 90 degrees',
  'rotate joint 5 to 45 degrees',
] as const;

const MALFORMED_UTTERANCES = [
  'garbage text here',
  '',
  'jog joint by degrees',
  'press key',
  'enter pin',
  'random gibberish',
] as const;

const OUT_OF_RANGE_UTTERANCES = [
  'jog joint 9 by 30 degrees',
  'jog joint 0 by 10 degrees',
  'press key 7',
  'press key 0',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createRecognitionMock() {
  const instances: any[] = [];

  const MockRecognition = vi.fn().mockImplementation(function () {
    const instance: any = {
      continuous: false,
      interimResults: false,
      lang: '',
      onstart: null,
      onend: null,
      onerror: null,
      onresult: null,
      start: vi.fn(function (this: any) {
        if (this.onstart) this.onstart();
        instances.push(this);
      }),
      stop: vi.fn(),
      abort: vi.fn(),
    };
    return instance;
  });

  vi.stubGlobal('SpeechRecognition', MockRecognition);
  vi.stubGlobal('webkitSpeechRecognition', MockRecognition);

  return { MockRecognition, get instances() { return instances; } };
}

function fireFinalResult(instance: any, transcript: string) {
  const event = {
    resultIndex: 0,
    results: [{ 0: { transcript }, isFinal: true }],
  };
  if (typeof instance.onresult === 'function') {
    instance.onresult(event);
  }
}

function isArmCommandShape(obj: any): obj is ArmCommand {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'string' &&
    obj.source === 'voice' &&
    typeof obj.timestamp === 'number' &&
    typeof obj.type === 'string'
  );
}

// ---------------------------------------------------------------------------
// Voice → gate integration
// ---------------------------------------------------------------------------
describe('Voice → gate integration', () => {
  let dispatchSpy: ReturnType<typeof vi.fn>;
  let submitSpy: ReturnType<typeof vi.fn>;
  let voiceTrigger: any;
  let instances: any[];
  let rejections: Array<{ reason: string; raw: string }>;

  beforeEach(async () => {
    vi.resetModules();
    dispatchSpy = vi.fn();
    submitSpy = vi.fn();
    rejections = [];

    const mock = createRecognitionMock();
    instances = mock.instances;

    // dispatch wraps submit in the real commandBus; spy on both to prove no bypass.
    dispatchSpy.mockImplementation((cmd: ArmCommand) => {
      submitSpy(cmd);
    });

    vi.doMock('../../bus/commandBus', () => ({
      commandBus: {
        dispatch: dispatchSpy,
        submit: submitSpy,
      },
    }));

    const mod = await import('./voiceTrigger');
    voiceTrigger = mod.voiceTrigger;

    voiceTrigger.onRejection((r: { reason: string; raw: string }) => {
      rejections.push(r);
    });
  });

  it('dispatches valid utterances with source:"voice" and valid ArmCommand shape', () => {
    voiceTrigger.startVoice();
    expect(instances.length).toBe(1);
    const rec = instances[0];

    for (const utterance of VALID_UTTERANCES) {
      dispatchSpy.mockClear();
      submitSpy.mockClear();
      fireFinalResult(rec, utterance);

      const call = dispatchSpy.mock.calls[0];
      expect(call).toBeDefined();
      const cmd = call![0];
      expect(isArmCommandShape(cmd)).toBe(true);
      expect(cmd.source).toBe('voice');
      expect(submitSpy).toHaveBeenCalledTimes(1);
      expect(submitSpy.mock.calls[0]![0]).toBe(cmd);
    }
  });

  it('never dispatches malformed utterances — only onRejection fires', () => {
    voiceTrigger.startVoice();
    const rec = instances[0];

    for (const utterance of MALFORMED_UTTERANCES) {
      dispatchSpy.mockClear();
      submitSpy.mockClear();
      fireFinalResult(rec, utterance);
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(submitSpy).not.toHaveBeenCalled();
    }

    expect(rejections.length).toBe(MALFORMED_UTTERANCES.length);
    for (const r of rejections) {
      expect(typeof r.reason).toBe('string');
      expect(typeof r.raw).toBe('string');
    }
  });

  it('never dispatches out-of-range utterances', () => {
    voiceTrigger.startVoice();
    const rec = instances[0];

    for (const utterance of OUT_OF_RANGE_UTTERANCES) {
      dispatchSpy.mockClear();
      submitSpy.mockClear();
      fireFinalResult(rec, utterance);
      expect(dispatchSpy).not.toHaveBeenCalled();
      expect(submitSpy).not.toHaveBeenCalled();
    }
  });

  it('confirms no bypass path — voice, keyboard, and joystick all reach submit', async () => {
    // Voice command reaches submit via dispatch wrapper
    voiceTrigger.startVoice();
    const rec = instances[0];
    fireFinalResult(rec, 'jog joint 1 by 10 degrees');

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(submitSpy).toHaveBeenCalledTimes(1);
    const voiceCmd = submitSpy.mock.calls[0]![0];
    expect(voiceCmd.source).toBe('voice');
    expect(voiceCmd.type).toBe('jog');

    // Keyboard and joystick call the same commandBus.submit directly
    const { handleKeyboardInput } = await import('../keyboard');
    const { handleJoystickInput } = await import('../joystick');

    submitSpy.mockClear();
    dispatchSpy.mockClear();

    handleKeyboardInput(0.1, 0, 0);
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    const kbCmd = submitSpy.mock.calls[0]![0];
    expect(kbCmd.source).toBe('keyboard');
    expect(kbCmd.type).toBe('jog');

    handleJoystickInput(0.1, 0, 0);
    expect(submitSpy).toHaveBeenCalledTimes(2);
    const joyCmd = submitSpy.mock.calls[1]![0];
    expect(joyCmd.source).toBe('joystick');
    expect(joyCmd.type).toBe('jog');

    // Voice wraps submit; keyboard/joystick call submit directly.
    // All three paths reach the same validation gate inside commandBus.submit — no bypass.
    expect(voiceCmd).toMatchObject({
      source: 'voice',
      type: 'jog',
      jointIndex: expect.any(Number),
      deltaRad: expect.any(Number),
      timestamp: expect.any(Number),
    });
    expect(kbCmd).toMatchObject({
      source: 'keyboard',
      type: 'jog',
      delta: expect.any(Object),
      timestamp: expect.any(Number),
    });
    expect(joyCmd).toMatchObject({
      source: 'joystick',
      type: 'jog',
      delta: expect.any(Object),
      timestamp: expect.any(Number),
    });
  });
});

// ---------------------------------------------------------------------------
// VoicePanel smoke test
// ---------------------------------------------------------------------------
describe('VoicePanel smoke test', () => {
  it('renders and mic toggle toggles state without real SpeechRecognition', async () => {
    vi.resetModules();

    const MockRecognition = vi.fn().mockImplementation(function () {
      const instance: any = {
        continuous: false,
        interimResults: false,
        lang: '',
        onstart: null,
        onend: null,
        onerror: null,
        onresult: null,
        start: vi.fn(function (this: any) {
          if (this.onstart) this.onstart();
        }),
        stop: vi.fn(),
        abort: vi.fn(),
      };
      return instance;
    });

    vi.stubGlobal('SpeechRecognition', MockRecognition);
    vi.stubGlobal('webkitSpeechRecognition', MockRecognition);

    const { render, screen } = await import('@testing-library/react');
    const { default: userEvent } = await import('@testing-library/user-event');

    const VoicePanel = (await import('./VoicePanel')).default;

    render(<VoicePanel />);

    // The button's accessible name is the emoji text content, not the title.
    const toggleButton = screen.getByRole('button', { name: '🎤' });

    expect(toggleButton.disabled).toBe(false);
    expect(toggleButton.getAttribute('title')).toBe('Start voice');
    expect(screen.getByText(/IDLE/i).textContent).toBeDefined();

    await userEvent.click(toggleButton);
    const stopButton = screen.getByRole('button', { name: '■' });
    expect(stopButton.disabled).toBe(false);
    expect(stopButton.getAttribute('title')).toBe('Stop voice');
    expect(screen.getByText(/LISTENING/i).textContent).toBeDefined();

    await userEvent.click(stopButton);
    expect(screen.getByRole('button', { name: '🎤' }).disabled).toBe(false);
    expect(screen.getByRole('button', { name: '🎤' }).getAttribute('title')).toBe('Start voice');
    expect(screen.getByText(/IDLE/i).textContent).toBeDefined();
  });
});
