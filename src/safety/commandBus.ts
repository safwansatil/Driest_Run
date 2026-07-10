import { MotionCommand, ArmMode, LogEntry, JointState, SafetyReport } from '../types';
import { validateSafety } from './safetyGate';
import { solveIK, getStylusPose } from '../kinematics/ikSolver';
import * as THREE from 'three';

// Observers/Subscribers list for state changes
type StateChangeCallback = (state: ArmMode) => void;
type LogCallback = (log: LogEntry) => void;
type JointUpdateCallback = (joints: JointState) => void;

class CommandBus {
  private currentState: ArmMode = 'IDLE';
  private logs: LogEntry[] = [];
  private stateSubscribers: StateChangeCallback[] = [];
  private logSubscribers: LogCallback[] = [];
  private jointSubscribers: JointUpdateCallback[] = [];

  // Current physical joint state of the simulated arm
  private currentJointState: JointState = {
    joint_1: 0,
    joint_2: 0,
    joint_3: 0,
    joint_4: 0,
    joint_5: 0,
    joint_6: 0,
    stylus_pitch: 0,
  };

  // Trajectory target joint state
  private targetJointState: JointState = { ...this.currentJointState };
  private isTappingActive = false; // Flag to bypass stylus tip panel collision checks during automated taps

  constructor() {
    this.addLog('info', 'System', 'Motion Control Pipeline initialized. Robot state: IDLE.');
  }

  // Subscribe to state transitions
  public subscribeToState(callback: StateChangeCallback) {
    this.stateSubscribers.push(callback);
    callback(this.currentState);
    return () => {
      this.stateSubscribers = this.stateSubscribers.filter(cb => cb !== callback);
    };
  }

  // Subscribe to system logs
  public subscribeToLogs(callback: LogCallback) {
    this.logSubscribers.push(callback);
    return () => {
      this.logSubscribers = this.logSubscribers.filter(cb => cb !== callback);
    };
  }

  // Subscribe to joint updates
  public subscribeToJoints(callback: JointUpdateCallback) {
    this.jointSubscribers.push(callback);
    callback(this.currentJointState);
    return () => {
      this.jointSubscribers = this.jointSubscribers.filter(cb => cb !== callback);
    };
  }

  public getState(): ArmMode {
    return this.currentState;
  }

  public getJoints(): JointState {
    return { ...this.currentJointState };
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // Trigger global Emergency Stop
  public triggerEStop() {
    this.currentState = 'ESTOPPED';
    this.targetJointState = { ...this.currentJointState }; // Freeze motion
    this.isTappingActive = false;
    this.addLog('error', 'SAFETY_BUS', 'EMERGENCY STOP (E-STOP) ACTIVATED! All motion halted, joints locked.');
    this.notifyState();
  }

  // Reset from FAULT or ESTOPPED
  public resetSystem() {
    if (this.currentState !== 'ESTOPPED' && this.currentState !== 'FAULT') {
      this.addLog('warn', 'System', 'System is not in a fault state. No reset required.');
      return;
    }
    this.currentState = 'IDLE';
    this.targetJointState = { ...this.currentJointState };
    this.isTappingActive = false;
    this.addLog('success', 'System', 'Safety system reset. System returned to IDLE.');
    this.notifyState();
  }

  // Submit command to the motion pipeline
  public submit(command: MotionCommand): boolean {
    // 1. E-Stop commands bypass state restrictions
    if (command.type === 'joint' && command.source === 'dashboard' && command.id === 'estop') {
      this.triggerEStop();
      return true;
    }

    // 2. Reject commands if Estop or Fault is active
    if (this.currentState === 'ESTOPPED') {
      this.addLog('warn', command.source, `Command rejected: System in ESTOPPED state.`);
      return false;
    }
    if (this.currentState === 'FAULT') {
      this.addLog('warn', command.source, `Command rejected: System in FAULT state. Clear safety faults first.`);
      return false;
    }

    // 3. Prevent manual interruptions during active autonomous execution
    if (this.currentState === 'EXECUTING' && command.source !== 'auto_pin') {
      this.addLog('warn', command.source, `Command rejected: Autonomous PIN sequence in progress.`);
      return false;
    }

    this.addLog('info', command.source, `Processing ${command.type} command...`);

    let targetJoints: JointState = { ...this.currentJointState };
    this.isTappingActive = (command.source === 'auto_pin');

    // 4. Handle Joint Targets directly
    if (command.type === 'joint' && command.jointTargets) {
      targetJoints = {
        ...this.currentJointState,
        ...command.jointTargets,
      } as JointState;
    } 
    // 5. Handle Cartesian Targets via custom IK solver
    else if (command.type === 'cartesian' && command.cartesianTarget) {
      const targetPos = new THREE.Vector3(
        command.cartesianTarget.x ?? 0.5,
        command.cartesianTarget.y ?? 0.05,
        command.cartesianTarget.z ?? 0.05
      );
      
      const targetDir = new THREE.Vector3(
        command.cartesianTarget.nx ?? 0,
        command.cartesianTarget.ny ?? 0,
        command.cartesianTarget.nz ?? -1
      ).normalize();

      // Run DLS Solver
      // We check the user configuration for stylus_pitch (J7) active vs. locked.
      // If we want it vantage specific (problem statement specific), the URDF has J7,
      // so by default we run the solver with all joints active (true for all).
      const solverResult = solveIK(targetPos, targetDir, this.currentJointState);
      
      if (!solverResult.converged) {
        this.addLog(
          'warn',
          'IK_SOLVER',
          `IK failed to converge to target ${targetPos.x}, ${targetPos.y}, ${targetPos.z} (error: ${solverResult.error.toFixed(4)})`
        );
        return false;
      }
      targetJoints = solverResult.joints;
      this.addLog('success', 'IK_SOLVER', `IK converged in ${solverResult.iterations} iterations (error: ${solverResult.error.toExponential(2)})`);
    } 
    // 6. Handle Cartesian Jogs (Incremental Joystick/Keyboard adjustments)
    else if (command.type === 'jog' && command.jogDelta) {
      const pose = getStylusPose(this.currentJointState);
      const currPos = new THREE.Vector3(pose.x, pose.y, pose.z);
      const targetPos = new THREE.Vector3(
        currPos.x + (command.jogDelta.dx ?? 0),
        currPos.y + (command.jogDelta.dy ?? 0),
        currPos.z + (command.jogDelta.dz ?? 0)
      );
      const targetDir = new THREE.Vector3(pose.nx, pose.ny, pose.nz);

      const solverResult = solveIK(targetPos, targetDir, this.currentJointState);
      if (!solverResult.converged) {
        this.addLog('warn', 'IK_SOLVER', 'Jog target out of workspace bounds.');
        return false;
      }
      targetJoints = solverResult.joints;
    }

    // 7. Verify safety check in advance
    const safetyReport = validateSafety(targetJoints, this.isTappingActive);
    if (!safetyReport.safe) {
      this.addLog('error', 'SAFETY_GATE', `Command REJECTED due to safety violations: ${safetyReport.violations.join('; ')}`);
      return false;
    }

    // 8. Execute state transition and update targets
    this.targetJointState = targetJoints;
    if (command.source === 'auto_pin') {
      this.currentState = 'EXECUTING';
    } else {
      this.currentState = command.type === 'jog' ? 'JOGGING' : 'MOVING';
    }
    
    this.notifyState();
    this.addLog('success', 'SAFETY_GATE', `Safety check PASSED. Executing command.`);
    return true;
  }

  // Update current joints directly (called by the Executor loop)
  public updateCurrentJoints(newJoints: JointState) {
    this.currentJointState = { ...newJoints };
    
    // Safety check during motion execution to handle unexpected faults/drifts
    const safetyReport = validateSafety(this.currentJointState, this.isTappingActive);
    if (!safetyReport.safe) {
      this.currentState = 'FAULT';
      this.targetJointState = { ...this.currentJointState }; // Freeze
      this.addLog('error', 'SAFETY_GATE', `CRITICAL FAULT: Safety violation during active movement! Halted. Violations: ${safetyReport.violations.join('; ')}`);
      this.notifyState();
      return;
    }

    this.notifyJoints();

    // Check if we arrived at target
    if (this.isAtTarget()) {
      if (this.currentState === 'MOVING' || this.currentState === 'JOGGING') {
        this.currentState = 'IDLE';
        this.notifyState();
      }
    }
  }

  public getTargetJoints(): JointState {
    return { ...this.targetJointState };
  }

  private isAtTarget(): boolean {
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
      if (Math.abs(this.currentJointState[key] - this.targetJointState[key]) > 0.001) {
        return false;
      }
    }
    return true;
  }

  // Helper log utility
  public addLog(type: 'info' | 'warn' | 'error' | 'success', source: string, message: string, data?: any) {
    const log: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      source,
      type,
      message,
      data,
    };
    this.logs.push(log);
    // Keep log buffer capped at 300 entries
    if (this.logs.length > 300) {
      this.logs.shift();
    }
    this.notifyLogs(log);
  }

  // Subscriptions notifications
  private notifyState() {
    this.stateSubscribers.forEach(cb => cb(this.currentState));
  }

  private notifyLogs(log: LogEntry) {
    this.logSubscribers.forEach(cb => cb(log));
  }

  private notifyJoints() {
    this.jointSubscribers.forEach(cb => cb(this.currentJointState));
  }
}

export const commandBus = new CommandBus();
