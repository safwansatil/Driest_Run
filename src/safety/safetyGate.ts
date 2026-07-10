import type { JointState, SafetyReport, UrdfLimits, SafetyRejectReason } from '../types';
import { getStylusPose } from '../kinematics/ikSolver';

// Bounding box for reachability (approximate robot reach in meters)
const WORKSPACE_BOUNDS = {
  xMin: -0.6, xMax: 0.6,
  yMin: -0.6, yMax: 0.6,
  zMin: 0.005, zMax: 0.8 // Don't let it crash into the floor
};

export function checkJointLimits(joints: JointState, limits: UrdfLimits): { safe: boolean, details: string[] } {
  const details: string[] = [];
  const keys = Object.keys(joints) as (keyof JointState)[];
  
  for (const key of keys) {
    const val = joints[key];
    const limit = limits[key];
    if (!limit) continue; // If limits aren't loaded yet, we can't check
    
    if (val < limit.min - 0.01 || val > limit.max + 0.01) { // 0.01 rad tolerance
      details.push(`${key} out of bounds: ${val.toFixed(2)} (Limit: [${limit.min.toFixed(2)}, ${limit.max.toFixed(2)}])`);
    }
  }
  return { safe: details.length === 0, details };
}

export function validateMotion(targetJoints: JointState, limits: UrdfLimits): SafetyReport {
  const jointCheck = checkJointLimits(targetJoints, limits);
  const reasons: SafetyRejectReason[] = [];
  const details: string[] = [...jointCheck.details];
  
  if (!jointCheck.safe) {
    reasons.push('JOINT_LIMIT_VIOLATION');
  }

  const pose = getStylusPose(targetJoints);
  
  if (pose.x < WORKSPACE_BOUNDS.xMin || pose.x > WORKSPACE_BOUNDS.xMax || pose.y < WORKSPACE_BOUNDS.yMin || pose.y > WORKSPACE_BOUNDS.yMax) {
    reasons.push('OUT_OF_BOUNDS');
    details.push(`Pose (x:${pose.x.toFixed(3)}, y:${pose.y.toFixed(3)}) outside workspace bounds.`);
  }

  if (pose.z < WORKSPACE_BOUNDS.zMin) {
    reasons.push('Z_COLLISION');
    details.push(`Z below ground level (${pose.z.toFixed(3)})`);
  }
  
  return {
    safe: reasons.length === 0,
    reasons,
    details
  };
}
