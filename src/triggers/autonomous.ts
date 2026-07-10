import { commandBus } from '../bus/commandBus';

export async function runPinSequence(_pin: string): Promise<void> {
  // Iterate through PIN digits and send moveTo commands
  // This would read from key.config.json
  
  // Example for first digit
  await commandBus.submit({
    id: crypto.randomUUID(),
    source: 'autonomous',
    type: 'moveTo',
    target: { x: 0.5, y: 0.0, z: 0.05, approach: [0, 0, -1] },
    timestamp: Date.now()
  });
}
