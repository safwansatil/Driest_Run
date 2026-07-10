import { create } from 'zustand';
import type { JointState, ArmMode, LogEntry, ArmCommand, UrdfLimits } from './types';
import { commandBus } from './bus/commandBus';

// Hardcoded fallback HOME_JOINTS if URDF hasn't loaded
export const HOME_JOINTS: JointState = {
  joint_1: 0,
  joint_2: 0,
  joint_3: 0,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
};

interface AppState {
  joints: JointState;
  setJoints: (joints: Partial<JointState>) => void;
  
  urdfLimits: UrdfLimits;
  setUrdfLimits: (limits: UrdfLimits) => void;

  mode: ArmMode;
  setMode: (mode: ArmMode) => void;
  
  isEStop: boolean;
  triggerEStop: () => void;
  resetEStop: () => void;

  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  
  activeCommand: ArmCommand | null;
  setActiveCommand: (cmd: ArmCommand | null) => void;
}

export const useStore = create<AppState>((set) => ({
  joints: HOME_JOINTS,
  setJoints: (jointsUpdate) => set((state) => ({ joints: { ...state.joints, ...jointsUpdate } })),
  
  urdfLimits: {},
  setUrdfLimits: (urdfLimits) => set({ urdfLimits }),

  mode: 'IDLE',
  setMode: (mode) => set({ mode }),
  
  isEStop: false,
  triggerEStop: () => set({ isEStop: true, mode: 'ESTOPPED', activeCommand: null }),
  resetEStop: () => set({ isEStop: false, mode: 'IDLE' }),
  
  logs: [],
  addLog: (logInfo) => set((state) => ({
    logs: [{ id: crypto.randomUUID(), timestamp: Date.now(), ...logInfo }, ...state.logs].slice(0, 100)
  })),
  
  activeCommand: null,
  setActiveCommand: (cmd) => {
    set({ activeCommand: cmd });
    if (cmd) {
      commandBus.submit(cmd);
    }
  },
}));
