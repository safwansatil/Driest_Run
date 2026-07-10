import type { JointState } from '../types';
import { useStore } from '../store';

import { fsm } from '../fsm';

// This module is the ONLY place allowed to mutate the live joint state of the arm.

let currentAnimation: number | null = null;

export function execute(validatedJointAngles: JointState): void {
  const store = useStore.getState();
  const startJoints = { ...store.joints };
  
  if (currentAnimation !== null) {
    cancelAnimationFrame(currentAnimation);
  }

  const duration = 500; // 500ms interpolation
  const startTime = performance.now();

  function animate(time: number) {
    if (fsm.getState() === 'ESTOPPED' || fsm.getState() === 'FAULT') {
      currentAnimation = null;
      return; // Stop moving immediately on E-Stop
    }

    const elapsed = time - startTime;
    const t = Math.min(elapsed / duration, 1.0);
    
    // Simple ease-in-out or linear lerp
    const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 

    const newJoints = { ...startJoints };
    let keys: (keyof JointState)[] = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6', 'stylus_pitch'];
    
    for (const key of keys) {
      if (validatedJointAngles[key] !== undefined) {
         newJoints[key] = startJoints[key] + (validatedJointAngles[key] - startJoints[key]) * easeT;
      }
    }

    useStore.getState().setJoints(newJoints);

    if (t < 1.0) {
      currentAnimation = requestAnimationFrame(animate);
    } else {
      currentAnimation = null;
      // Movement complete, transition back to IDLE
      if (fsm.getState() === 'EXECUTING' || fsm.getState() === 'JOGGING') {
         fsm.transitionTo('IDLE');
      }
    }
  }

  currentAnimation = requestAnimationFrame(animate);
}
