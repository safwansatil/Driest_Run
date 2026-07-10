import { useStore } from '../store';
import { commandBus } from './commandBus';
import type { ArmCommand } from '../types/commands';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function executeCommandSequence(commands: ArmCommand[]): Promise<void> {
  for (const cmd of commands) {
    const verdict = await commandBus.dispatch(cmd);
    
    if (verdict === 'ACCEPTED' && import.meta.env.MODE !== 'test') {
      let settledCount = 0;
      let lastJointsStr = JSON.stringify(useStore.getState().joints);

      // Wait until joints settle (no change for 4 ticks @ 50ms = 200ms)
      while (settledCount < 4) {
        await delay(50);
        const currentJointsStr = JSON.stringify(useStore.getState().joints);
        if (currentJointsStr === lastJointsStr) {
          settledCount++;
        } else {
          settledCount = 0;
          lastJointsStr = currentJointsStr;
        }
      }
    }
  }
}
