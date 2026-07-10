import { JointState, ArmMode } from '../types';
import { commandBus } from '../safety/commandBus';

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

  constructor() {
    this.start();
  }

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
      return;
    }

    const currentJoints = commandBus.getJoints();
    const targetJoints = commandBus.getTargetJoints();

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
    }
  }
}

export const trajectoryExecutor = new TrajectoryExecutor();
