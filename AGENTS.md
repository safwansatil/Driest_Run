# Vantage Robotics Simulation - Module Guidelines

This document outlines the strict architecture and data flow rules for the browser-based 6-DOF robotic arm control pipeline. Following these rules ensures that multiple teammates can work in parallel without merge conflicts and that the system remains safe and predictable.

## The Module Map & Data Flow

The pipeline is a strict, linear progression. Every motion command must follow this exact route:

**Trigger -> Command Bus -> FSM Check -> Kinematics -> Validation Gate -> Executor -> Audit Log -> Dashboard**

### Single Responsibility Rules

1. **Triggers (`src/triggers/*`)**
   - **Responsibility**: Translate input (keyboard, voice, AI, joystick) into canonical `ArmCommand` objects and send them to the `commandBus`.
   - **MUST NOT**: Directly calculate joint angles, check safety rules, or mutate the arm's state.

2. **Command Bus (`src/bus/commandBus.ts`)**
   - **Responsibility**: Receive commands from triggers and push them through the pipeline stages in order.
   - **MUST NOT**: Perform math, safety logic, or state mutation itself. It is only a coordinator.

3. **FSM Module (`src/fsm/index.ts`)**
   - **Responsibility**: Track the current state (IDLE, JOGGING, EXECUTING, ESTOPPED, FAULT) and decide if a new command can be accepted.
   - **MUST NOT**: Route commands or calculate angles.

4. **Kinematics Module (`src/kinematics/index.ts`)**
   - **Responsibility**: Solve Inverse Kinematics (IK) and Forward Kinematics (FK). Parse the URDF to determine joint limits.
   - **MUST NOT**: Decide if a motion is safe (that's the validation gate's job).

5. **Validation Gate (`src/validation/index.ts`)**
   - **Responsibility**: Take a proposed joint state and verify it against limits, reachability, self-collision, and environment constraints.
   - **MUST NOT**: Alter the proposed angles. It returns a strict pass/fail.

6. **Executor (`src/executor/index.ts`)**
   - **Responsibility**: Take validated joint states and interpolate/drive the simulated joints over time.
   - **CRITICAL**: This is the **ONLY** module allowed to mutate live joint state. No trigger may call this directly.

7. **Audit Module (`src/audit/index.ts`)**
   - **Responsibility**: Keep an append-only log of every command, its verdict, and final error. Provide session reports.

## Command Schema
The single source of truth for all commands is `src/types/commands.ts`. All triggers must emit commands matching this schema.

## Naming & Folder Conventions
To avoid collisions:
- Keep triggers isolated in `src/triggers/`.
- Export a clear API from each module's `index.ts`.
- Use the `ArmCommand` type consistently.
