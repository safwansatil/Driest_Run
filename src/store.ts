import { create } from 'zustand';
import type { JointState, ArmMode, LogEntry, MotionCommand } from './types';
import { HOME_JOINTS } from './kinematics/ikSolver';

interface AppState {
  // Current real state of the arm
  joints: JointState;
  setJoints: (joints: Partial<JointState>) => void;
  
  // Application mode
  mode: ArmMode;
  setMode: (mode: ArmMode) => void;
  
  // E-Stop
  isEStop: boolean;
  triggerEStop: () => void;
  resetEStop: () => void;

  // Logs
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  
  // Active Command
  activeCommand: MotionCommand | null;
  setActiveCommand: (cmd: MotionCommand | null) => void;
}

export const useStore = create<AppState>((set) => ({
  joints: HOME_JOINTS,
  setJoints: (jointsUpdate) => set((state) => ({ joints: { ...state.joints, ...jointsUpdate } })),
  
  mode: 'IDLE',
  setMode: (mode) => set({ mode }),
  
  isEStop: false,
  triggerEStop: () => set({ isEStop: true, mode: 'ESTOP_TRIGGERED', activeCommand: null }),
  resetEStop: () => set({ isEStop: false, mode: 'IDLE' }),
  
  logs: [],
  addLog: (logInfo) => set((state) => ({
    logs: [{ id: crypto.randomUUID(), timestamp: Date.now(), ...logInfo }, ...state.logs].slice(0, 100) // Keep last 100 logs
  })),
  
  activeCommand: null,
  setActiveCommand: (cmd) => set({ activeCommand: cmd }),
}));
