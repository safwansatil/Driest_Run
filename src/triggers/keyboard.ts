import { commandBus } from '../bus/commandBus';

export async function handleKeyboardInput(dx: number, dy: number, dz: number): Promise<void> {
  if (dx !== 0 || dy !== 0 || dz !== 0) {
    await commandBus.submit({
      id: crypto.randomUUID(),
      source: 'keyboard',
      type: 'jog',
      delta: { x: dx, y: dy, z: dz },
      timestamp: Date.now()
    });
  }
}
