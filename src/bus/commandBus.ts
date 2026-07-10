import * as THREE from 'three';
import type { ArmCommand } from '../types/commands';
import { fsm } from '../fsm';
import { solveIK, getEndEffectorPose } from '../kinematics';
import { validate } from '../validation';
import { execute } from '../executor';
import { auditLog } from '../audit';
import { useStore, HOME_JOINTS } from '../store';
import type { JointState } from '../types';

let keyConfigCache: Record<string, { x: number; y: number; z: number }> | null = null;

async function loadKeyConfig(): Promise<Record<string, { x: number; y: number; z: number }>> {
  if (keyConfigCache) return keyConfigCache;
  const resp = await fetch('/key.config.json');
  const data = await resp.json();
  keyConfigCache = data.keys;
  return keyConfigCache!;
}

class CommandBus {
  public async submit(command: ArmCommand): Promise<string> {
    if (!fsm.canAccept(command)) {
      const reason = 'FSM_REJECTED';
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'REJECTED',
        reason
      });
      return 'REJECTED';
    }

    if (command.type === 'estop') {
      useStore.getState().triggerEStop();
      fsm.eStop();
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'ACCEPTED',
        reason: 'E-STOP ACTIVATED'
      });
      return 'ACCEPTED';
    }

    if (command.type === 'goto' && command.targetName === 'home') {
      const proposedJoints = HOME_JOINTS;
      const validationReport = validate(command, proposedJoints);
      if (!validationReport.pass) {
        auditLog.append({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          command,
          verdict: 'REJECTED',
          reason: validationReport.reason
        });
        return 'REJECTED';
      }
      fsm.transitionTo('EXECUTE');
      execute(proposedJoints);
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'ACCEPTED'
      });
      return 'ACCEPTED';
    }

    if (command.type === 'enter_pin') {
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'ACCEPTED',
        reason: 'PIN_ENTERED'
      });
      return 'ACCEPTED';
    }

    let proposedJoints: JointState;
    let ikError = 0;

    if (command.type === 'press_key' && command.keyIndex !== undefined) {
      const keyConfig = await loadKeyConfig();
      const keyData = keyConfig[String(command.keyIndex)];
      if (!keyData) {
        auditLog.append({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          command,
          verdict: 'REJECTED',
          reason: 'INVALID_KEY_INDEX'
        });
        return 'REJECTED';
      }
      const currentJoints = useStore.getState().joints;
      const target = { x: keyData.x, y: keyData.y, z: keyData.z, approach: [0, 0, -1] as [number, number, number] };
      const ikResult = solveIK(target, currentJoints);
      proposedJoints = ikResult.jointAngles;
      ikError = ikResult.error;
    } else if (command.type === 'setJoint' && command.joint) {
      proposedJoints = { ...useStore.getState().joints, [command.joint.name]: command.joint.value };
    } else if (command.type === 'moveTo' && command.target) {
      const currentJoints = useStore.getState().joints;
      const ikResult = solveIK(command.target, currentJoints);
      proposedJoints = ikResult.jointAngles;
      ikError = ikResult.error;
      
      if (ikError > 0.8) {
        const reason = `IK_FAILED_TO_CONVERGE (Error: ${ikError.toFixed(4)})`;
        auditLog.append({
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          command,
          verdict: 'REJECTED',
          reason,
          ikError
        });
        useStore.getState().setError(`Command Rejected: Target unreachable / IK Failed`);
        return 'REJECTED';
      }
    } else if (command.type === 'jog' && command.delta) {
      const currentJoints = useStore.getState().joints;
      const currentPose = getEndEffectorPose(currentJoints);
      const targetPos = {
        x: currentPose.x + (command.delta.x || 0),
        y: currentPose.y + (command.delta.y || 0),
        z: currentPose.z + (command.delta.z || 0)
      };
      
      let targetQuatArray: [number, number, number, number] | undefined = undefined;
      
      if ((command.delta.rx || command.delta.ry || command.delta.rz) && currentPose.quat) {
         const q = currentPose.quat.clone();
         const euler = new THREE.Euler(command.delta.rx || 0, command.delta.ry || 0, command.delta.rz || 0, 'XYZ');
         const dq = new THREE.Quaternion().setFromEuler(euler);
         q.multiply(dq);
         targetQuatArray = [q.x, q.y, q.z, q.w];
      }

      const target = { ...targetPos, quat: targetQuatArray };
      const ikResult = solveIK(target, currentJoints);
      proposedJoints = ikResult.jointAngles;
      ikError = ikResult.error;
    } else if (command.type === 'jog' && command.jointIndex !== undefined && command.deltaRad !== undefined) {
      const currentJoints = useStore.getState().joints;
      const keys: (keyof JointState)[] = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
      const jointName = keys[command.jointIndex];
      proposedJoints = { ...currentJoints, [jointName]: currentJoints[jointName] + command.deltaRad };
    } else if (command.type === 'rotate_joint' && command.jointIndex !== undefined && command.absRad !== undefined) {
      const currentJoints = useStore.getState().joints;
      const keys: (keyof JointState)[] = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
      const jointName = keys[command.jointIndex];
      proposedJoints = { ...currentJoints, [jointName]: command.absRad };
    } else {
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'REJECTED',
        reason: 'UNSUPPORTED_COMMAND_TYPE'
      });
      return 'REJECTED';
    }

    const validationReport = validate(command, proposedJoints);
    if (!validationReport.pass) {
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'REJECTED',
        reason: validationReport.reason,
        ikError
      });
      return 'REJECTED';
    }

    // 4. Executor
    if (fsm.getState() !== 'AUTONOMOUS_SEQUENCE') {
      fsm.transitionTo((command.type === 'jog' || (command.type === 'setJoint' && command.joint?.delta !== undefined)) ? 'JOGGING' : 'EXECUTE');
    }
    
    execute(proposedJoints);

    auditLog.append({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      command,
      verdict: 'ACCEPTED',
      ikError
    });
    return 'ACCEPTED';
  }

  public async dispatch(command: ArmCommand): Promise<string> {
    return this.submit(command);
  }
}

export const commandBus = new CommandBus();
