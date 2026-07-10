export type CommandSource = 'dashboard' | 'joystick' | 'keyboard' | 'voice' | 'agentic' | 'autonomous' | 'typed' | 'agent';

export type CommandType = 'moveTo' | 'jog' | 'setJoint' | 'press_key' | 'enter_pin' | 'rotate_joint' | 'goto' | 'estop';

export interface ArmCommand {
  id: string;
  source: CommandSource;
  type: CommandType;
  target?: { x: number; y: number; z: number; approach?: [number, number, number]; quat?: [number, number, number, number] };
  targetName?: 'home';
  delta?: { x: number; y: number; z: number; rx?: number; ry?: number; rz?: number };
  joint?: { name: string; value?: number; delta?: number };
  keyIndex?: number;
  digits?: number[];
  jointIndex?: number;
  absRad?: number;
  deltaRad?: number;
  timestamp: number;
}
