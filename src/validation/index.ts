import type { JointState } from '../types';
import type { ArmCommand } from '../types/commands';
import { useStore } from '../store';

export interface ValidationReport {
  pass: boolean;
  reason?: string;
  details?: string[];
}

export function validate(_command: ArmCommand, proposedJointAngles: JointState): ValidationReport {
  const limits = useStore.getState().urdfLimits;
  const details: string[] = [];

  // 1. Joint Limits Check (Real logic, based on URDF parsing)
  const keys: (keyof JointState)[] = [
    'joint_1', 'joint_2', 'joint_3', 
    'joint_4', 'joint_5', 'joint_6'
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

  // 3. Velocity / Accel bounds check
  const currentJoints = useStore.getState().joints;
  const executionDurationSeconds = 0.5; // executor is hardcoded to 500ms
  
  for (const key of keys) {
    const val = proposedJointAngles[key];
    const currentVal = currentJoints[key];
    const limit = limits[key];
    
    if (limit && limit.velocity) {
      const delta = Math.abs(val - currentVal);
      const velocity = delta / executionDurationSeconds;
      
      if (velocity > limit.velocity + 0.001) {
        details.push(`${key} velocity limit violation: proposed velocity ${velocity.toFixed(2)} rad/s exceeds limit ${limit.velocity} rad/s`);
      }
    }
  }

  if (details.length > 0) {
    return {
      pass: false,
      reason: details[0].includes('velocity') ? 'VELOCITY_LIMIT_VIOLATION' : 'JOINT_LIMIT_VIOLATION',
      details
    };
  }

  // 2. Reachability / Workspace envelope check (Real checks for target Cartesian coordinates)
  if (_command.target) {
    const { x, y, z } = _command.target;
    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist > 1.19) {
      return {
        pass: false,
        reason: 'UNREACHABLE_TARGET',
        details: [`Target distance ${dist.toFixed(3)}m is outside the maximum reach of 1.19m`],
      };
    }
    if (z < 0) {
      return {
        pass: false,
        reason: 'OUT_OF_BOUNDS',
        details: [`Target Z coordinate ${z.toFixed(3)}m is below ground limit (0.0m)`],
      };
    }
  }

  // 3. Velocity / Accel bounds check (Stub)
  // TODO: Determine if transition from current to proposed violates velocity max over time dt
  
  // 4. Self-collision check (Stub)
  // TODO: Use capsule distance math between arm links
  
  return {
    pass: true
  };
}
