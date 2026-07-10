import { commandBus } from '../bus/commandBus';

export async function handleJoystickInput(dx: number, dy: number, dz: number): Promise<void> {
  await commandBus.submit({
    id: crypto.randomUUID(),
    source: 'joystick',
    type: 'jog',
    delta: { x: dx, y: dy, z: dz },
    timestamp: Date.now()
  });
}
