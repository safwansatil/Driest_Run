import { useStore } from '../store';
import { validateMotion } from '../safety/safetyGate';
import { solveIK, getStylusPose } from './ikSolver';
import * as THREE from 'three';

// 60Hz executor loop
let executorInterval: ReturnType<typeof setInterval> | null = null;
const EXECUTION_RATE_MS = 1000 / 60; 

// Max speed per second (radians)
const MAX_JOINT_SPEED = 1.0; 

export function startExecutor() {
  if (executorInterval) return;

  let lastTime = performance.now();

  executorInterval = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000; // seconds
    lastTime = now;

    const state = useStore.getState();
    
    if (state.isEStop) {
      if (state.mode !== 'ESTOP_TRIGGERED') {
        state.setMode('ESTOP_TRIGGERED');
      }
      return;
    }

    const cmd = state.activeCommand;
    if (!cmd) return;

    let targetJoints = { ...state.joints };
    let shouldMove = false;

    if (cmd.type === 'joint' && cmd.jointTargets) {
      targetJoints = { ...targetJoints, ...cmd.jointTargets };
      shouldMove = true;
    } else if (cmd.type === 'jog' && cmd.jogDelta) {
      const pose = getStylusPose(state.joints);
      const targetPos = new THREE.Vector3(
        pose.x + (cmd.jogDelta.dx || 0),
        pose.y + (cmd.jogDelta.dy || 0),
        pose.z + (cmd.jogDelta.dz || 0)
      );
      // Try to solve IK for jog
      const targetDir = new THREE.Vector3(pose.nx, pose.ny, pose.nz); // Keep current dir
      const ikResult = solveIK(targetPos, targetDir, state.joints);
      
      if (ikResult.converged) {
         targetJoints = ikResult.joints;
         shouldMove = true;
      } else {
         state.addLog({ type: 'warn', source: 'Executor', message: 'Jog target unreachable' });
         state.setActiveCommand(null);
         return;
      }
    } else if (cmd.type === 'cartesian' && cmd.cartesianTarget) {
      const targetPos = new THREE.Vector3(
        cmd.cartesianTarget.x ?? 0,
        cmd.cartesianTarget.y ?? 0,
        cmd.cartesianTarget.z ?? 0
      );
      // For automated tasks (PIN entry), point stylus downwards
      const targetDir = new THREE.Vector3(
        cmd.cartesianTarget.nx ?? 0,
        cmd.cartesianTarget.ny ?? 0,
        cmd.cartesianTarget.nz ?? -1
      );
      
      const ikResult = solveIK(targetPos, targetDir, state.joints);
      if (ikResult.converged) {
         targetJoints = ikResult.joints;
         shouldMove = true;
      } else {
         state.addLog({ type: 'error', source: 'Executor', message: 'Cartesian target unreachable' });
         state.setActiveCommand(null);
         return;
      }
    }

    if (shouldMove) {
      // Validate Safety
      const report = validateMotion(targetJoints);
      if (!report.safe) {
        state.addLog({ type: 'error', source: 'SafetyGate', message: `Motion rejected: ${report.violations.join(', ')}` });
        state.setActiveCommand(null);
        return;
      }

      // Interpolate towards target
      const speedScale = cmd.speedFraction || 0.5;
      const maxDelta = MAX_JOINT_SPEED * speedScale * dt;
      
      const newJoints = { ...state.joints };
      let reached = true;
      const keys = Object.keys(targetJoints) as (keyof typeof targetJoints)[];

      for (const key of keys) {
        const diff = targetJoints[key] - newJoints[key];
        if (Math.abs(diff) > 0.001) {
          reached = false;
          const step = Math.sign(diff) * Math.min(Math.abs(diff), maxDelta);
          newJoints[key] += step;
        }
      }

      state.setJoints(newJoints);

      if (reached) {
        state.setActiveCommand(null);
        if (state.mode === 'MOVING') {
           state.setMode('IDLE');
        }
      } else {
        if (state.mode !== 'MOVING' && state.mode !== 'TAP_DESCENDING' && state.mode !== 'TAP_ASCENDING') {
           state.setMode('MOVING');
        }
      }
    }

  }, EXECUTION_RATE_MS);
}

export function stopExecutor() {
  if (executorInterval) {
    clearInterval(executorInterval);
    executorInterval = null;
  }
}
