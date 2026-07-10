import type { ArmCommand } from '../types/commands';
import { fsm } from '../fsm';
import { solveIK, getEndEffectorPose } from '../kinematics';
import { validate } from '../validation';
import { execute } from '../executor';
import { auditLog } from '../audit';
import { useStore } from '../store';
import type { JointState } from '../types';

class CommandBus {
  public submit(command: ArmCommand): void {
    // 1. FSM Check
    if (!fsm.canAccept(command)) {
      const reason = 'FSM_REJECTED';
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'REJECTED',
        reason
      });
      useStore.getState().setError(`Command Rejected: ${reason}`);
      return;
    }

    const currentJoints: JointState = useStore.getState().joints;
    let proposedJoints: JointState;
    let ikError = 0;

    // 2. Kinematics
    if (command.type === 'setJoint' && command.joint) {
      proposedJoints = { ...currentJoints, [command.joint.name]: command.joint.value };
    } else if (command.type === 'moveTo' && command.target) {
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
        return;
      }
    } else if (command.type === 'jog' && command.delta) {
      const currentPose = getEndEffectorPose(currentJoints);
      const target = {
        x: currentPose.x + (command.delta.x || 0),
        y: currentPose.y + (command.delta.y || 0),
        z: currentPose.z + (command.delta.z || 0)
      };
      const ikResult = solveIK(target, currentJoints);
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
        return;
      }
    } else {
      // Invalid command structure
      return;
    }

    // 3. Validation Gate
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
      useStore.getState().setError(`Validation Failed: ${validationReport.reason}`);
      return;
    }

    // 4. Executor
    fsm.transitionTo(command.type === 'jog' ? 'JOGGING' : 'EXECUTE');
    
    execute(proposedJoints);

    // 5. Audit Log
    auditLog.append({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      command,
      verdict: 'ACCEPTED',
      ikError
    });
  }

  public dispatch(command: ArmCommand): void {
    this.submit(command);
  }
}

export const commandBus = new CommandBus();
