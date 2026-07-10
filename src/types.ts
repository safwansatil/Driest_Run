export interface JointState {
  joint_1: number;
  joint_2: number;
  joint_3: number;
  joint_4: number;
  joint_5: number;
  joint_6: number;
  stylus_pitch: number;
}

export type CommandSource = 'dashboard' | 'joystick' | 'keyboard' | 'voice' | 'auto_pin' | 'agentic_llm';

export interface CartesianPose {
  x: number;
  y: number;
  z: number;
  nx: number; // Normal vector X (pointing direction)
  ny: number; // Normal vector Y
  nz: number; // Normal vector Z
}

export interface MotionCommand {
  id: string;
  timestamp: number;
  source: CommandSource;
  type: 'joint' | 'cartesian' | 'jog';
  // Target angles (used if type === 'joint')
  jointTargets?: Partial<JointState>;
  // Cartesian target (used if type === 'cartesian')
  cartesianTarget?: Partial<CartesianPose>;
  // Jog offsets (used if type === 'jog')
  jogDelta?: {
    dx?: number;
    dy?: number;
    dz?: number;
  };
  // Trajectory velocity scale (0.1 to 1.0)
  speedFraction?: number;
}

export interface SafetyReport {
  safe: boolean;
  violations: string[];
  selfCollision: boolean;
  groundCollision: boolean;
  jointLimitViolations: string[];
  workspaceViolation: boolean;
}

export type ArmMode = 'IDLE' | 'MOVING' | 'TAP_DESCENDING' | 'TAP_ASCENDING' | 'ESTOP_TRIGGERED' | 'SAFETY_FAULT';

export interface LogEntry {
  id: string;
  timestamp: number;
  source: string;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: any;
}
