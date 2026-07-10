import type { JointState } from '../types';
import type { ArmCommand } from '../types/commands';
import { parseUrdfLimits } from '../kinematics';

export interface ValidationReport {
  pass: boolean;
  reason?: string;
  details?: string[];
}

export function validate(_command: ArmCommand, proposedJointAngles: JointState): ValidationReport {
  const limits = parseUrdfLimits();
  const details: string[] = [];

  // 1. Joint Limits Check (Real logic, based on URDF parsing)
  const keys: (keyof JointState)[] = [
    'joint_1', 'joint_2', 'joint_3', 
    'joint_4', 'joint_5', 'joint_6', 'stylus_pitch'
  ];

  for (const key of keys) {
    const val = proposedJointAngles[key];
    const limit = limits[key];
    
    if (limit) {
      if (val < limit.min - 0.001 || val > limit.max + 0.001) {
        details.push(`${key} limit violation: value ${val.toFixed(3)} rad is outside [${limit.min}, ${limit.max}]`);
      }
    }
  }

  if (details.length > 0) {
    return {
      pass: false,
      reason: 'JOINT_LIMIT_VIOLATION',
      details
    };
  }

  // 2. Reachability / Workspace envelope check (Stub)
  // TODO: Implement check against max reach radius and min Z (ground collision)
  
  // 3. Velocity / Accel bounds check (Stub)
  // TODO: Determine if transition from current to proposed violates velocity max over time dt
  
  // 4. Self-collision check (Stub)
  // TODO: Use capsule distance math between arm links
  
  return {
    pass: true
  };
}
