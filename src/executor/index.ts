import type { JointState } from '../types';
import { useStore } from '../store';

// This module is the ONLY place allowed to mutate the live joint state of the arm.

export function execute(validatedJointAngles: JointState): void {
  // Currently a stub that snaps directly to the target.
  // TODO: Implement trajectory interpolation (e.g., lerp) over time 
  // to smoothly move from current joints to target joints based on velocity limits.
  
  // Actually update the store which drives the 3D visualization.
  useStore.getState().setJoints(validatedJointAngles);
}
