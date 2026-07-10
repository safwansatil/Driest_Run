import { JointState, ArmMode } from '../types';
import { commandBus } from '../safety/commandBus';

<<<<<<< HEAD
let executorInterval: ReturnType<typeof setInterval> | null = null;
const EXECUTION_RATE_MS = 1000 / 60; 
const MAX_JOINT_SPEED = 1.0; 
=======
// Max joint velocities from URDF (rad/s)
const JOINT_VEL_LIMITS = {
  joint_1: 2.5,
  joint_2: 2.5,
  joint_3: 3.0,
  joint_4: 3.5,
  joint_5: 4.0,
  joint_6: 4.5,
  stylus_pitch: 5.0,
};

class TrajectoryExecutor {
  private timerId: number | null = null;
  private lastTickTime: number = Date.now();
  private speedFraction = 0.5; // Max out at 50% of URDF limits for safety margin
  private kp = 8.0; // Proportional feedback gain for smooth interpolation
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235

  constructor() {
    this.start();
  }

<<<<<<< HEAD
  let lastTime = performance.now();

  executorInterval = setInterval(() => {
    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const state = useStore.getState();
    
    if (state.isEStop) {
      if (state.mode !== 'ESTOPPED') state.setMode('ESTOPPED');
=======
  // Start the 60Hz executor loop
  public start() {
    if (this.timerId !== null) return;
    this.lastTickTime = Date.now();
    
    // 60Hz is ~16.67ms per tick
    this.timerId = window.setInterval(() => this.tick(), 16);
  }

  // Stop the loop
  public stop() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public setSpeedFraction(fraction: number) {
    this.speedFraction = Math.max(0.1, Math.min(1.0, fraction));
  }

  private tick() {
    const state = commandBus.getState();
    
    // Freeze movement completely if emergency stopped or in critical fault
    if (state === 'ESTOPPED' || state === 'FAULT') {
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
      return;
    }

    const currentJoints = commandBus.getJoints();
    const targetJoints = commandBus.getTargetJoints();

<<<<<<< HEAD
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
=======
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000.0, 0.05); // Clamp dt to max 50ms to prevent huge jumps
    this.lastTickTime = now;

    if (dt <= 0) return;

    const keys: (keyof JointState)[] = [
      'joint_1',
      'joint_2',
      'joint_3',
      'joint_4',
      'joint_5',
      'joint_6',
      'stylus_pitch',
    ];

    let hasMoved = false;
    const newJoints = { ...currentJoints };

    for (const key of keys) {
      const error = targetJoints[key] - currentJoints[key];
      
      if (Math.abs(error) > 0.0005) {
        // P-Controller: required velocity is proportional to error
        const reqVel = error * this.kp;

        // Clamp velocity to safety limits
        const maxVel = JOINT_VEL_LIMITS[key] * this.speedFraction;
        const clampedVel = Math.max(-maxVel, Math.min(maxVel, reqVel));

        // Integrate joint position
        let delta = clampedVel * dt;
        
        // Prevent overshoot: clamp delta to error
        if (Math.abs(delta) > Math.abs(error)) {
          delta = error;
        }

        newJoints[key] += delta;
        hasMoved = true;
      } else {
        // Snap to target if extremely close
        newJoints[key] = targetJoints[key];
      }
    }

    if (hasMoved) {
      commandBus.updateCurrentJoints(newJoints);
>>>>>>> c214de1ade568fa4d88306258da45a25d2ee9235
    }
  }
}

export const trajectoryExecutor = new TrajectoryExecutor();
