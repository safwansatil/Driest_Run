import type { JointState } from '../types';

export interface IKResult {
  jointAngles: JointState;
  converged: boolean;
  error: number;
  iterations: number;
}

export interface CartesianPose {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
}

export interface JointLimit {
  min: number;
  max: number;
  velocity?: number;
  effort?: number;
}

import { solveIK as realSolveIK, getStylusPose } from './ikSolver';
import * as THREE from 'three';

// Stub implementation for URDF parsing.
// In reality, this would fetch '6_dof_arm.urdf', parse the XML, and extract limits.
export function parseUrdfLimits(): Record<string, JointLimit> {
  return {
    joint_1: { min: -3.14, max: 3.14, velocity: 2.5 },
    joint_2: { min: -1.57, max: 1.57, velocity: 2.5 },
    joint_3: { min: -2.0, max: 2.0, velocity: 3.0 },
    joint_4: { min: -3.14, max: 3.14, velocity: 3.5 },
    joint_5: { min: -1.57, max: 1.57, velocity: 4.0 },
    joint_6: { min: -3.14, max: 3.14, velocity: 4.5 },
    stylus_pitch: { min: -1.0, max: 1.0, velocity: 5.0 },
  };
}

export function solveIK(
  target: { x: number; y: number; z: number; approach?: [number, number, number] },
  currentJoints: JointState
): IKResult {
  const targetPos = new THREE.Vector3(target.x, target.y, target.z);
  const approach = target.approach || [0, 0, -1];
  const targetDir = new THREE.Vector3(approach[0], approach[1], approach[2]).normalize();
  const limits = parseUrdfLimits();

  const result = realSolveIK(targetPos, targetDir, currentJoints, limits);
  return {
    jointAngles: result.joints,
    converged: result.converged,
    error: result.error,
    iterations: result.iterations
  };
}

export function getEndEffectorPose(jointAngles: JointState): CartesianPose {
  return getStylusPose(jointAngles);
}
