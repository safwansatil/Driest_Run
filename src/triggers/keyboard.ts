import { commandBus } from '../bus/commandBus';

export function handleKeyboardInput(key: string): void {
  // Example mapping
  let dx = 0, dy = 0, dz = 0;
  if (key === 'w') dx = 0.05;
  if (key === 's') dx = -0.05;
  
  if (dx !== 0 || dy !== 0 || dz !== 0) {
    commandBus.submit({
      id: crypto.randomUUID(),
      source: 'keyboard',
      type: 'jog',
      delta: { x: dx, y: dy, z: dz },
      timestamp: Date.now()
    });
  }
}
