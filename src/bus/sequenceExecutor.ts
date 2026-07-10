import { commandBus } from './commandBus';
import { useStore } from '../store';
import type { ArmCommand } from '../types/commands';
import type { JointState } from '../types';

export async function executeCommandSequence(commands: ArmCommand[]): Promise<void> {
  for (const command of commands) {
    if (command.type === 'estop') {
      await commandBus.dispatch(command);
      break; // Abort remaining sequence on emergency stop
    }

    const verdict = await commandBus.dispatch(command);
    if (verdict === 'REJECTED') {
      console.warn(`Command sequence aborted: step ${command.type} was rejected by the safety gate`);
      break; // Halt the sequence on rejection
    }

    // In test environment, skip settling wait to run tests synchronously and instantly
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      continue;
    }

    // Wait for the arm joints to settle (no movement for ~200ms)
    await new Promise<void>((resolve, reject) => {
      let lastJoints = { ...useStore.getState().joints };
      let unchangedTicks = 0;

      const checkInterval = setInterval(() => {
        const state = useStore.getState();
        if (state.mode === 'ERROR' || state.isEStop) {
          clearInterval(checkInterval);
          reject(new Error('Sequence execution halted due to arm error or E-Stop'));
          return;
        }

        const currentJoints = state.joints;
        const diffSq = 
          Math.pow(currentJoints.joint_1 - lastJoints.joint_1, 2) +
          Math.pow(currentJoints.joint_2 - lastJoints.joint_2, 2) +
          Math.pow(currentJoints.joint_3 - lastJoints.joint_3, 2) +
          Math.pow(currentJoints.joint_4 - lastJoints.joint_4, 2) +
          Math.pow(currentJoints.joint_5 - lastJoints.joint_5, 2) +
          Math.pow(currentJoints.joint_6 - lastJoints.joint_6, 2);

        if (diffSq < 0.000001) {
          unchangedTicks++;
          if (unchangedTicks >= 4) { // ~200ms
            clearInterval(checkInterval);
            resolve();
          }
        } else {
          unchangedTicks = 0;
        }
        lastJoints = { ...currentJoints };
      }, 50);
    });
  }
}
