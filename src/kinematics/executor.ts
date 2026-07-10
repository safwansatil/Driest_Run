import { useStore } from '../store';
import { validateMotion } from '../safety/safetyGate';
import { solveIK, getStylusPose } from './ikSolver';
import * as THREE from 'three';

let executorInterval: ReturnType<typeof setInterval> | null = null;
const EXECUTION_RATE_MS = 1000 / 60; 
const MAX_JOINT_SPEED = 1.0; 

export function startExecutor() {
  if (executorInterval) return;

  let lastTime = performance.now();

  executorInterval = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const state = useStore.getState();
    
    if (state.isEStop) {
      if (state.mode !== 'ESTOPPED') state.setMode('ESTOPPED');
      return;
    }

    const cmd = state.activeCommand;
    if (!cmd) return;

    let targetJoints = { ...state.joints };
    let shouldMove = false;
    let ikError = 0;

    if (cmd.type === 'setJoint' && cmd.joint) {
      targetJoints[cmd.joint.name as keyof typeof targetJoints] = cmd.joint.value;
      shouldMove = true;
    } else if (cmd.type === 'jog' && cmd.delta) {
      const pose = getStylusPose(state.joints);
      const targetPos = new THREE.Vector3(
        pose.x + (cmd.delta.x || 0),
        pose.y + (cmd.delta.y || 0),
        pose.z + (cmd.delta.z || 0)
      );
      const targetDir = new THREE.Vector3(pose.nx, pose.ny, pose.nz);
      const ikResult = solveIK(targetPos, targetDir, state.joints, state.urdfLimits);
      
      if (ikResult.converged) {
         targetJoints = ikResult.joints;
         ikError = ikResult.error;
         shouldMove = true;
      } else {
         state.addLog({ 
           source: cmd.source, 
           type: 'error', 
           message: 'Jog target unreachable',
           commandId: cmd.id,
           verdict: 'REJECTED',
           rejectReason: 'UNREACHABLE_TARGET',
           ikError: ikResult.error
         });
         state.setActiveCommand(null);
         return;
      }
    } else if (cmd.type === 'moveTo' && cmd.target) {
      const targetPos = new THREE.Vector3(cmd.target.x, cmd.target.y, cmd.target.z);
      const targetDir = new THREE.Vector3(
        cmd.target.approach?.[0] ?? 0,
        cmd.target.approach?.[1] ?? 0,
        cmd.target.approach?.[2] ?? -1
      );
      
      const ikResult = solveIK(targetPos, targetDir, state.joints, state.urdfLimits);
      if (ikResult.converged) {
         targetJoints = ikResult.joints;
         ikError = ikResult.error;
         shouldMove = true;
      } else {
         state.addLog({ 
           source: cmd.source, 
           type: 'error', 
           message: 'Cartesian target unreachable',
           commandId: cmd.id,
           verdict: 'REJECTED',
           rejectReason: 'UNREACHABLE_TARGET',
           ikError: ikResult.error
         });
         state.setActiveCommand(null);
         return;
      }
    }

    if (shouldMove) {
      const report = validateMotion(targetJoints, state.urdfLimits);
      if (!report.safe) {
        state.addLog({ 
          source: cmd.source, 
          type: 'error', 
          message: `Motion rejected: ${report.reasons.join(', ')}`,
          commandId: cmd.id,
          verdict: 'REJECTED',
          rejectReason: report.reasons[0],
          ikError
        });
        state.setActiveCommand(null);
        return;
      }

      // Interpolate
      const maxDelta = MAX_JOINT_SPEED * dt;
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
        // Calculate final tip error for the session log
        const pose = getStylusPose(newJoints);
        let finalTipError = 0;
        if (cmd.type === 'moveTo' && cmd.target) {
          const dx = pose.x - cmd.target.x;
          const dy = pose.y - cmd.target.y;
          const dz = pose.z - cmd.target.z;
          finalTipError = Math.sqrt(dx*dx + dy*dy + dz*dz);
        }

        state.addLog({ 
          source: cmd.source, 
          type: 'success', 
          message: `Motion completed`,
          commandId: cmd.id,
          verdict: 'ACCEPTED',
          ikError,
          finalTipError,
          target: cmd.type === 'moveTo' ? cmd.target : (cmd.type === 'jog' ? cmd.delta : cmd.joint)
        });
        state.setActiveCommand(null);
        if (state.mode === 'EXECUTING' || state.mode === 'JOGGING') {
           state.setMode('IDLE');
        }
      } else {
        const targetMode = cmd.type === 'jog' ? 'JOGGING' : 'EXECUTING';
        if (state.mode !== targetMode) {
           state.setMode(targetMode);
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
