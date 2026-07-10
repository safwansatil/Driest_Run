<<<<<<< HEAD
import type { JointState, SafetyReport, UrdfLimits, SafetyRejectReason } from '../types';
import { getStylusPose } from '../kinematics/ikSolver';
=======
import * as THREE from 'three';
import { JointState, MotionCommand, SafetyReport } from '../types';
import { forwardKinematics, getStylusPose, JOINT_LIMITS } from '../kinematics/ikSolver';
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235

// Key Panel definition from key.config.json
// Panel is located around x: 0.5 to 0.6, y: -0.05 to 0.05, z: 0.05
export const PANEL_BOUNDS = {
  minX: 0.45,
  maxX: 0.65,
  minY: -0.08,
  maxY: 0.08,
  minZ: 0.0,
  maxZ: 0.06, // Height of the panel
};

<<<<<<< HEAD
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
=======
// Workspace envelope: Max possible extension is about 1.4 meters.
// Safe workspace radius from base is defined here:
export const WORKSPACE = {
  minRadius: 0.15, // Keep away from the self-intersection core
  maxRadius: 1.35, // Near stretch limit
  minZ: 0.01,      // Stay above the floor
  maxZ: 1.30,      // Max vertical reach
};

// Segment radii for capsule-based self-collision check
const LINK_RADII = [
  0.055, // Link 1
  0.050, // Link 2
  0.044, // Link 3
  0.038, // Link 4
  0.034, // Link 5
  0.030, // Link 6
  0.018, // Stylus
];

// Helper to compute the shortest distance between two line segments (P1-Q1) and (P2-Q2)
function getSegmentDistance(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3
): number {
  const d1 = new THREE.Vector3().subVectors(q1, p1); // Direction of segment 1
  const d2 = new THREE.Vector3().subVectors(q2, p2); // Direction of segment 2
  const r = new THREE.Vector3().subVectors(p1, p2);

  const a = d1.dot(d1); // Squared length of segment 1
  const e = d2.dot(d2); // Squared length of segment 2
  const f = d2.dot(r);

  const epsilon = 1e-8;

  let s = 0.0;
  let t = 0.0;

  // Check if either segment degenerates into a point
  if (a <= epsilon && e <= epsilon) {
    return p1.distanceTo(p2);
  }
  if (a <= epsilon) {
    s = 0.0;
    t = THREE.MathUtils.clamp(f / e, 0, 1);
  } else if (e <= epsilon) {
    t = 0.0;
    s = THREE.MathUtils.clamp(-r.dot(d1) / a, 0, 1);
  } else {
    const c = d1.dot(r);
    const b = d1.dot(d2);
    const denom = a * e - b * b;

    // If segments are parallel, choose arbitrary s, solve for t
    if (Math.abs(denom) > epsilon) {
      s = THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1);
    } else {
      s = 0.0;
    }

    t = (b * s + f) / e;

    if (t < 0.0) {
      t = 0.0;
      s = THREE.MathUtils.clamp(-c / a, 0, 1);
    } else if (t > 1.0) {
      t = 1.0;
      s = THREE.MathUtils.clamp((b - c) / a, 0, 1);
    }
  }

  const closestPoint1 = new THREE.Vector3().addScaledVector(d1, s).add(p1);
  const closestPoint2 = new THREE.Vector3().addScaledVector(d2, t).add(p2);

  return closestPoint1.distanceTo(closestPoint2);
}

// Check for self-collisions between all non-adjacent link segments
export function checkSelfCollision(transforms: THREE.Matrix4[]): {
  collision: boolean;
  message: string;
} {
  // Extract positions of joints/links
  // transforms indices correspond to:
  // [0: base_link, 1: j1, 2: j2, 3: j3, 4: j4, 5: j5, 6: j6, 7: stylus, 8: tip]
  const pts: THREE.Vector3[] = [];
  for (let i = 1; i <= 8; i++) {
    pts.push(new THREE.Vector3().setFromMatrixPosition(transforms[i]));
  }

  // We define 7 segments:
  // Segment 0: J1 (pts[0]) to J2 (pts[1]) - Link 1
  // Segment 1: J2 (pts[1]) to J3 (pts[2]) - Link 2
  // Segment 2: J3 (pts[2]) to J4 (pts[3]) - Link 3
  // Segment 3: J4 (pts[3]) to J5 (pts[4]) - Link 4
  // Segment 4: J5 (pts[4]) to J6 (pts[5]) - Link 5
  // Segment 5: J6 (pts[5]) to Stylus (pts[6]) - Link 6
  // Segment 6: Stylus (pts[6]) to Tip (pts[7]) - Stylus

  const numSegments = 7;
  const segments: { p: THREE.Vector3; q: THREE.Vector3; r: number; name: string }[] = [];
  const names = ['Link 1', 'Link 2', 'Link 3', 'Link 4', 'Link 5', 'Link 6', 'Stylus'];

  for (let i = 0; i < numSegments; i++) {
    segments.push({
      p: pts[i],
      q: pts[i + 1],
      r: LINK_RADII[i],
      name: names[i],
    });
  }

  // Check all non-adjacent pairs (i.e. |i - j| > 1)
  for (let i = 0; i < numSegments; i++) {
    for (let j = i + 2; j < numSegments; j++) {
      // Skip adjacent segments since they share a joint and naturally intersect
      const dist = getSegmentDistance(segments[i].p, segments[i].q, segments[j].p, segments[j].q);
      const safeDist = segments[i].r + segments[j].r + 0.005; // 5mm safety buffer

      if (dist < safeDist) {
        return {
          collision: true,
          message: `Self-collision detected between ${segments[i].name} and ${segments[j].name} (dist: ${(dist * 100).toFixed(1)}cm, limit: ${(safeDist * 100).toFixed(1)}cm)`,
        };
      }
    }
  }

  return { collision: false, message: '' };
}

// Check for collision with the ground plane (z = 0.0)
export function checkGroundCollision(transforms: THREE.Matrix4[]): {
  collision: boolean;
  message: string;
} {
  const pts: THREE.Vector3[] = [];
  for (let i = 1; i <= 8; i++) {
    pts.push(new THREE.Vector3().setFromMatrixPosition(transforms[i]));
  }

  // Check each point and segment bottom
  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i];
    const radius = LINK_RADII[Math.min(i, LINK_RADII.length - 1)];
    // Ensure the bottom of the link does not go below ground
    if (pt.z - radius < WORKSPACE.minZ) {
      return {
        collision: true,
        message: `Ground collision warning: Link point at z = ${(pt.z * 100).toFixed(1)}cm is below safety limit of ${(WORKSPACE.minZ * 100).toFixed(1)}cm (radius: ${(radius * 100).toFixed(1)}cm)`,
      };
    }
  }

  return { collision: false, message: '' };
}

// Check for collision with the key panel fixture
export function checkPanelCollision(
  transforms: THREE.Matrix4[],
  isTapping: boolean
): { collision: boolean; message: string } {
  // If we are actively performing a touch sequence, we bypass the stylus tip panel collision
  // check to allow it to touch the keys. However, other links must not crash into the panel!
  const pts: THREE.Vector3[] = [];
  for (let i = 1; i <= 8; i++) {
    pts.push(new THREE.Vector3().setFromMatrixPosition(transforms[i]));
  }

  // We check if any link segment (other than the stylus tip during tapping) intersects the panel bounding box
  const numLinksToCheck = isTapping ? 6 : 7; // If tapping, skip the stylus link (index 6) from crashing checks, but verify others

  for (let i = 0; i < numLinksToCheck; i++) {
    const p = pts[i];
    const q = pts[i + 1];
    const r = LINK_RADII[i];

    // Simple box-segment intersection approximation: check if segment points or midpoints are inside expanded panel bounds
    const steps = 5;
    for (let k = 0; k <= steps; k++) {
      const alpha = k / steps;
      const testPt = new THREE.Vector3().lerpVectors(p, q, alpha);

      // Check if test point + radius is inside the panel box
      if (
        testPt.x + r >= PANEL_BOUNDS.minX &&
        testPt.x - r <= PANEL_BOUNDS.maxX &&
        testPt.y + r >= PANEL_BOUNDS.minY &&
        testPt.y - r <= PANEL_BOUNDS.maxY &&
        testPt.z + r >= PANEL_BOUNDS.minZ &&
        testPt.z - r <= PANEL_BOUNDS.maxZ
      ) {
        return {
          collision: true,
          message: `Panel collision: ${i === 6 ? 'Stylus' : 'Link ' + (i + 1)} would crash into the key panel fixture`,
        };
      }
    }
  }

  return { collision: false, message: '' };
}

// The main safety validation gate
export function validateSafety(
  joints: JointState,
  isTapping = false
): SafetyReport {
  const violations: string[] = [];
  const jointLimitViolations: string[] = [];
  let selfCollision = false;
  let groundCollision = false;
  let workspaceViolation = false;

  // 1. Joint limit checks
  const keys: (keyof JointState)[] = [
    'joint_1',
    'joint_2',
    'joint_3',
    'joint_4',
    'joint_5',
    'joint_6',
    'stylus_pitch',
  ];

  for (const key of keys) {
    const val = joints[key];
    const limits = JOINT_LIMITS[key];
    if (val < limits.min - 0.001 || val > limits.max + 0.001) {
      const msg = `${key} limit violation: value ${val.toFixed(3)} rad is outside [${limits.min}, ${limits.max}]`;
      jointLimitViolations.push(msg);
      violations.push(msg);
    }
  }

  // Compute FK transforms to perform geometric checks
  const transforms = forwardKinematics(joints);
  const pose = getStylusPose(joints);
  const tipPos = new THREE.Vector3(pose.x, pose.y, pose.z);

  // 2. Workspace check (Tip position)
  const distFromBase = new THREE.Vector3(tipPos.x, tipPos.y, tipPos.z - 0.06).length(); // z-offset of base J1
  if (distFromBase > WORKSPACE.maxRadius) {
    const msg = `Workspace violation: Reach distance ${distFromBase.toFixed(3)}m exceeds maximum reach envelope of ${WORKSPACE.maxRadius}m`;
    workspaceViolation = true;
    violations.push(msg);
  }
  if (distFromBase < WORKSPACE.minRadius) {
    const msg = `Workspace violation: Target coordinate is in base collision core (dist: ${distFromBase.toFixed(3)}m < min: ${WORKSPACE.minRadius}m)`;
    workspaceViolation = true;
    violations.push(msg);
  }
  if (tipPos.z < WORKSPACE.minZ) {
    const msg = `Workspace violation: Stylus tip z-coordinate ${tipPos.z.toFixed(3)}m is below ground safety plane ${WORKSPACE.minZ}m`;
    workspaceViolation = true;
    violations.push(msg);
  }

  // 3. Ground collision check (all links)
  const groundCheck = checkGroundCollision(transforms);
  if (groundCheck.collision) {
    groundCollision = true;
    violations.push(groundCheck.message);
  }

  // 4. Self-collision check
  const selfCheck = checkSelfCollision(transforms);
  if (selfCheck.collision) {
    selfCollision = true;
    violations.push(selfCheck.message);
  }

  // 5. Panel collision check
  const panelCheck = checkPanelCollision(transforms, isTapping);
  if (panelCheck.collision) {
    violations.push(panelCheck.message);
  }

  return {
    safe: violations.length === 0,
    violations,
    selfCollision,
    groundCollision,
    jointLimitViolations,
    workspaceViolation,
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
  };
}
