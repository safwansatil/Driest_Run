import { commandBus } from '../bus/commandBus';

export function handleJoystickInput(dx: number, dy: number, dz: number): void {
  // Translate raw joystick input into a jog command
  commandBus.submit({
    id: crypto.randomUUID(),
    source: 'joystick',
    type: 'jog',
    delta: { x: dx, y: dy, z: dz },
    timestamp: Date.now()
  });
}
