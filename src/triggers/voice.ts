import { commandBus } from '../bus/commandBus';

export function handleVoiceCommand(_spokenText: string): void {
  // Parse text into structured command
  // e.g. "move up" -> delta z = 0.1
  
  commandBus.submit({
    id: crypto.randomUUID(),
    source: 'voice',
    type: 'jog',
    delta: { x: 0, y: 0, z: 0.1 },
    timestamp: Date.now()
  });
}
