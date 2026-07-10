import nipplejs from 'nipplejs';
import { commandBus } from '../bus/commandBus';
import { useStore } from '../store';

let leftManager: nipplejs.JoystickManager | null = null;
let rightManager: nipplejs.JoystickManager | null = null;
let speedManager: nipplejs.JoystickManager | null = null;
let rotationIntervalRef: number | null = null;

export function initDualJoystickGUI(
  leftContainer: HTMLDivElement,
  rightContainer: HTMLDivElement,
  speedContainer: HTMLDivElement
): () => void {
  // Clean up existing instances if any
  if (leftManager) leftManager.destroy();
  if (rightManager) rightManager.destroy();
  if (speedManager) speedManager.destroy();
  if (rotationIntervalRef !== null) clearInterval(rotationIntervalRef);

  // --- Left Stick (Joint Toggle) ---
  leftManager = nipplejs.create({
    zone: leftContainer,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#9933ff', // Robitic purple/blue vibe
    size: 100,
    lockY: true
  });

  let lastCycleTime = 0;
  leftManager.on('move', ((_: any, data: any) => {
    const state = useStore.getState();
    if (state.isEStop || state.mode === 'ERROR' || state.mode === 'EXECUTE' || state.controlMode !== 'JOYSTICK') return;

    const threshold = 30;
    const now = Date.now();
    
    if (data.distance > threshold && now - lastCycleTime > 300) {
      const angle = data.angle.degree;
      if (angle > 45 && angle < 135) {
        let next = state.activeJoint - 1;
        if (next < 1) next = 6;
        state.setActiveJoint(next);
        lastCycleTime = now;
      } else if (angle > 225 && angle < 315) {
        let next = state.activeJoint + 1;
        if (next > 6) next = 1;
        state.setActiveJoint(next);
        lastCycleTime = now;
      }
    }
  }) as any);

  // --- Right Stick (Joint Rotation) ---
  rightManager = nipplejs.create({
    zone: rightContainer,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#00ccff',
    size: 100,
    lockX: true
  });

  let currentDirection = 0;

  rightManager.on('move', ((_: any, data: any) => {
    const state = useStore.getState();
    if (state.isEStop || state.mode === 'ERROR' || state.mode === 'EXECUTE' || state.controlMode !== 'JOYSTICK') return;

    const threshold = 10;
    if (data.distance > threshold) {
      const angle = data.angle.degree;
      if (angle < 45 || angle > 315) {
        currentDirection = 1;
      } else if (angle > 135 && angle < 225) {
        currentDirection = -1;
      } else {
        currentDirection = 0;
      }
    } else {
      currentDirection = 0;
    }
  }) as any);

  rightManager.on('end', () => {
    currentDirection = 0;
  });

  // --- Speed Stick (RPM Control) ---
  speedManager = nipplejs.create({
    zone: speedContainer,
    mode: 'static',
    position: { left: '50%', top: '50%' },
    color: '#ff3366', // distinct color for speed
    size: 100,
    lockY: true
  });

  let speedInterval: number | null = null;
  speedManager.on('move', ((_: any, data: any) => {
    if (speedInterval === null) {
      speedInterval = window.setInterval(() => {
        const state = useStore.getState();
        const angle = data.angle.degree;
        let deltaRpm = 0;
        
        // Map distance to rate of RPM change
        const rate = (data.distance / 50); 
        
        if (angle > 45 && angle < 135) deltaRpm = rate * 2; // Up increases RPM
        else if (angle > 225 && angle < 315) deltaRpm = -rate * 2; // Down decreases RPM
        
        if (deltaRpm !== 0) {
          const newRpm = Math.max(0, Math.min(255, state.rpm + deltaRpm));
          state.setRpm(newRpm);
        }
      }, 50);
    }
  }) as any);

  speedManager.on('end', () => {
    if (speedInterval !== null) {
      clearInterval(speedInterval);
      speedInterval = null;
    }
  });

  // Emitting commands at a fixed rate
  rotationIntervalRef = window.setInterval(() => {
    if (currentDirection !== 0) {
      const state = useStore.getState();
      if (state.isEStop || state.mode === 'ERROR' || state.mode === 'EXECUTE') return;

      const { activeJoint, stepSize } = state;
      console.log(`[Joystick] Emitting setJoint for joint_${activeJoint} with delta ${currentDirection * stepSize}`);
      commandBus.dispatch({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        source: 'joystick',
        type: 'setJoint',
        joint: { name: `joint_${activeJoint}`, delta: currentDirection * stepSize }
      });
    }
  }, 100); // 10Hz stream

  return () => {
    if (leftManager) leftManager.destroy();
    if (rightManager) rightManager.destroy();
    if (speedManager) speedManager.destroy();
    if (rotationIntervalRef !== null) clearInterval(rotationIntervalRef);
    if (speedInterval !== null) clearInterval(speedInterval);
    leftManager = null;
    rightManager = null;
    speedManager = null;
  };
}
