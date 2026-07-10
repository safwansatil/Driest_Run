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
      auditLog.append({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        command,
        verdict: 'REJECTED',
        reason: 'FSM_REJECTED'
      });
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
      return;
    }

    // 4. Executor
    fsm.transitionTo(command.type === 'jog' ? 'JOGGING' : 'EXECUTING');
    execute(proposedJoints);
    fsm.transitionTo('IDLE'); // Instantly transition back for now since execute is instantaneous stub

    // 5. Audit Log
    auditLog.append({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      command,
      verdict: 'ACCEPTED',
      ikError
    });
  }
}

export const commandBus = new CommandBus();
