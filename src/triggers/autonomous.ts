import { commandBus } from '../bus/commandBus';
import { fsm } from '../fsm';
import { useStore } from '../store';
import { getEndEffectorPose } from '../kinematics';

export type SequencePhase = 'hovering' | 'descending' | 'pressed' | 'retracting';

export interface SequenceStatus {
  pin: string;
  activeDigitIndex: number;
  phase: SequencePhase;
  status: 'IDLE' | 'EXECUTING' | 'SUCCESS' | 'FAULT';
}

function dist(p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number}) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2) + Math.pow(p1.z - p2.z, 2));
}

export async function runPinSequence(
  pin: string, 
  onUpdate: (status: SequenceStatus) => void
): Promise<void> {
  if (pin.length === 0) return;

  // Auto-recover from any previous errors/stops
  if (fsm.getState() === 'ERROR' || fsm.getState() === 'STOP' || fsm.getState() === 'AUTONOMOUS_PAUSED') {
    fsm.reset();
  }

  if (!fsm.transitionTo('AUTONOMOUS_SEQUENCE')) {
    onUpdate({ pin, activeDigitIndex: -1, phase: 'hovering', status: 'FAULT' });
    return;
  }

  onUpdate({ pin, activeDigitIndex: 0, phase: 'hovering', status: 'EXECUTING' });

  try {
    const resp = await fetch('/key.config.json');
    const config = await resp.json();
    const keys = config.keys;

    for (let i = 0; i < pin.length; i++) {
      const digit = pin[i];
      const keyData = keys[digit];
      if (!keyData) {
        throw new Error(`Key ${digit} not found in config`);
      }

      // 1. Hover
      onUpdate({ pin, activeDigitIndex: i, phase: 'hovering', status: 'EXECUTING' });
      await executeMoveAndWait(keyData.x, keyData.y, keyData.z + 0.05, 0.01);

      // 2. Descend & Press
      onUpdate({ pin, activeDigitIndex: i, phase: 'descending', status: 'EXECUTING' });
      await executeMoveAndWait(keyData.x, keyData.y, keyData.z, 0.005);

      onUpdate({ pin, activeDigitIndex: i, phase: 'pressed', status: 'EXECUTING' });
      await new Promise(resolve => setTimeout(resolve, 200));

      // 3. Retract
      onUpdate({ pin, activeDigitIndex: i, phase: 'retracting', status: 'EXECUTING' });
      await executeMoveAndWait(keyData.x, keyData.y, keyData.z + 0.05, 0.01);
    }

    onUpdate({ pin, activeDigitIndex: pin.length - 1, phase: 'retracting', status: 'SUCCESS' });
    fsm.transitionTo('REST');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useStore.getState().addLog({ source: 'autonomous', type: 'error', message: `Autonomous sequence failed: ${msg}` });
    fsm.fault();
    onUpdate({ pin, activeDigitIndex: -1, phase: 'hovering', status: 'FAULT' });
  }
}

function executeMoveAndWait(x: number, y: number, z: number, _tolerance: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clear any previous errors
    useStore.getState().setError(null);
    
    commandBus.submit({
      id: crypto.randomUUID(),
      source: 'autonomous',
      type: 'moveTo',
      target: { x, y, z, approach: [0, 0, -1] },
      timestamp: Date.now()
    });

    // Check immediately if it was rejected
    if (useStore.getState().mode === 'ERROR') {
      reject(new Error(useStore.getState().backendError || 'Command rejected'));
      return;
    }

    let lastJoints = useStore.getState().joints;
    let unchangedTicks = 0;

    const checkInterval = setInterval(() => {
      const state = useStore.getState();
      
      if (state.mode === 'ERROR' || fsm.getState() === 'STOP' || fsm.getState() === 'ERROR' || fsm.getState() === 'REST') {
        clearInterval(checkInterval);
        reject(new Error(state.backendError || 'FSM halted or reset'));
        return;
      }

      if (fsm.getState() === 'AUTONOMOUS_PAUSED') {
        // Just wait while paused, don't accumulate unchanged ticks
        unchangedTicks = 0;
        lastJoints = state.joints;
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
        if (unchangedTicks >= 4) { // ~200ms of no movement = settled
          clearInterval(checkInterval);
          resolve();
        }
      } else {
        unchangedTicks = 0;
      }
      
      lastJoints = currentJoints;
    }, 50);
  });
}
