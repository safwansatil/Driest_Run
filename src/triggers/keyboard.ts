import { commandBus } from '../bus/commandBus';

export function handleKeyboardInput(dx: number, dy: number, dz: number): void {
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
