import type { JointState, SafetyReport } from '../types';
import { JOINT_LIMITS, getStylusPose } from '../kinematics/ikSolver';

// Bounding box for reachability (approximate robot reach in meters)
const WORKSPACE_BOUNDS = {
  xMin: -0.6, xMax: 0.6,
  yMin: -0.6, yMax: 0.6,
  zMin: 0.005, zMax: 0.8 // Don't let it crash into the floor
};

export function checkJointLimits(joints: JointState): string[] {
  const violations: string[] = [];
  const keys = Object.keys(joints) as (keyof JointState)[];
  
  for (const key of keys) {
    const val = joints[key];
    const limits = JOINT_LIMITS[key];
    if (val < limits.min - 0.01 || val > limits.max + 0.01) { // 0.01 rad tolerance
      violations.push(`${key} out of bounds: ${val.toFixed(2)} (Limit: [${limits.min}, ${limits.max}])`);
    }
  }
  return violations;
}

export function validateMotion(targetJoints: JointState): SafetyReport {
  const jointViolations = checkJointLimits(targetJoints);
  
  const pose = getStylusPose(targetJoints);
  
  let workspaceViolation = false;
  const wsViolations: string[] = [];
  if (pose.x < WORKSPACE_BOUNDS.xMin || pose.x > WORKSPACE_BOUNDS.xMax) { workspaceViolation = true; wsViolations.push(`X out of bounds (${pose.x.toFixed(3)})`); }
  if (pose.y < WORKSPACE_BOUNDS.yMin || pose.y > WORKSPACE_BOUNDS.yMax) { workspaceViolation = true; wsViolations.push(`Y out of bounds (${pose.y.toFixed(3)})`); }
  if (pose.z < WORKSPACE_BOUNDS.zMin) { workspaceViolation = true; wsViolations.push(`Z below ground level (${pose.z.toFixed(3)})`); }
  
  // Very simplified self-collision (we can expand if needed)
  const selfCollision = false; 

  const groundCollision = pose.z < WORKSPACE_BOUNDS.zMin;
  
  const allViolations = [...jointViolations, ...wsViolations];

  return {
    safe: allViolations.length === 0,
    violations: allViolations,
    selfCollision,
    groundCollision,
    jointLimitViolations: jointViolations,
    workspaceViolation
  };
}
