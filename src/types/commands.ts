export type CommandSource = 'dashboard' | 'joystick' | 'keyboard' | 'voice' | 'agentic' | 'autonomous';

export type CommandType = 'moveTo' | 'jog' | 'setJoint';

export interface ArmCommand {
  id: string; // UUID
  source: CommandSource;
  type: CommandType;
  
  // Used for 'moveTo' commands (absolute cartesian coordinates)
  target?: {
    x: number;
    y: number;
    z: number;
    approach?: [number, number, number]; // Vector indicating approach direction, usually [0, 0, -1]
  };
  
  // Used for 'jog' commands (relative cartesian offsets)
  delta?: {
    x: number;
    y: number;
    z: number;
  };
  
  // Used for 'setJoint' commands (direct joint angle manipulation)
  joint?: {
    name: string;
    value: number; // In radians
  };
  
  timestamp: number;
}
