import type { ArmCommand } from '../types/commands';

export type ArmState = 'IDLE' | 'JOGGING' | 'EXECUTING' | 'ESTOPPED' | 'FAULT';

class ArmFSM {
  private currentState: ArmState = 'IDLE';

  public getState(): ArmState {
    return this.currentState;
  }

  public eStop(): void {
    this.currentState = 'ESTOPPED';
  }

  public fault(): void {
    this.currentState = 'FAULT';
  }

  public reset(): void {
    if (this.currentState === 'ESTOPPED' || this.currentState === 'FAULT') {
      this.currentState = 'IDLE';
    }
  }

  public transitionTo(newState: ArmState): boolean {
    // E-stops and faults can happen from anywhere
    if (newState === 'ESTOPPED' || newState === 'FAULT') {
      this.currentState = newState;
      return true;
    }

    if (this.currentState === 'ESTOPPED' || this.currentState === 'FAULT') {
      return false; // Must explicitly call reset() first
    }

    this.currentState = newState;
    return true;
  }

  public canAccept(command: ArmCommand): boolean {
    if (this.currentState === 'ESTOPPED' || this.currentState === 'FAULT') {
      return false;
    }

    if (this.currentState === 'EXECUTING') {
      // Reject manual overrides during autonomous execution, unless it's another auto command
      if (command.source !== 'autonomous') {
        return false;
      }
    }

    if (this.currentState === 'JOGGING') {
      // Reject autonomous commands if the operator is actively jogging the arm manually
      if (command.source === 'autonomous') {
        return false;
      }
    }

    return true;
  }
}

export const fsm = new ArmFSM();
