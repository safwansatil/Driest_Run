import { create } from 'zustand';

export interface AgentMessage {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  type?: 'text' | 'tool_call' | 'clarify' | 'rejection' | 'confirmation';
  toolCallName?: string;
  toolCallArgs?: any;
}

interface AgentState {
  messages: AgentMessage[];
  isThinking: boolean;
  error: string | null;
  speakResult: boolean;
  waitingForClarification: boolean;
  addMessage: (msg: Omit<AgentMessage, 'id'>) => void;
  setThinking: (thinking: boolean) => void;
  setError: (err: string | null) => void;
  setSpeakResult: (speak: boolean) => void;
  setWaitingForClarification: (waiting: boolean) => void;
  clearMessages: () => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  messages: [],
  isThinking: false,
  error: null,
  speakResult: true,
  waitingForClarification: false,
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, { ...msg, id: crypto.randomUUID() }],
    })),
  setThinking: (isThinking) => set({ isThinking }),
  setError: (error) => set({ error }),
  setSpeakResult: (speakResult) => set({ speakResult }),
  setWaitingForClarification: (waitingForClarification) => set({ waitingForClarification }),
  clearMessages: () => set({ messages: [] }),
}));
