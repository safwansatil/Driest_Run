export type CommandSource = 'dashboard' | 'joystick' | 'keyboard' | 'voice' | 'agentic' | 'autonomous';

export type CommandType = 'moveTo' | 'jog' | 'setJoint';

export interface ArmCommand {
  id: string;
  source: CommandSource;
  type: CommandType;
  target?: { x: number; y: number; z: number; approach?: [number, number, number]; quat?: [number, number, number, number] };
  delta?: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number };
  joint?: { name: string; value?: number; delta?: number };
  timestamp: number;
}
