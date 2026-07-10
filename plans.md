# plans.md — Vantage Dry Run Simulation Suite

## 0. Project summary

Browser-based digital twin of Vantage's `stylus_arm` (7 actuated revolute
joints: `joint_1..joint_6` + `stylus_pitch`, i.e. 6-DOF arm + 1 redundant
wrist DOF). One motion pipeline, five trigger surfaces (dashboard read-out,
GUI joystick, keyboard, deterministic voice, autonomous PIN entry), plus an
optional agentic voice extension. No physical hardware — everything must be
provable and trustworthy in simulation before it's allowed near a real arm.

This document is the delivery plan. `agent.md` is the standing instruction
set for whichever coding agent (Cursor / Claude Code) implements it.

## 1. Architecture recap (source of truth)

```
[Dashboard] [Joystick] [Keyboard] [Voice] [Agentic] [Autonomous PIN]
        \        |          |        |        |         /
         \       |          |        |        |        /
          v-------v----------v--------v--------v-------v
                    Layer 0 — Command Schema
                              |
                    Layer 1 — Arm State Machine
                    (IDLE / JOGGING / EXECUTING / ESTOPPED)
                              |
                    Layer 2 — Safety Gate
                    (reachability, joint limits, vel/accel clamp,
                     self-collision) -> ACCEPT or REJECT+reason
                              |
                    Layer 3 — IK Solver
                    (damped least-squares Jacobian, 7 DOF)
                              |
                    Layer 4 — Executor
                    (trajectory interpolation, writes joint state,
                     drives Three.js URDF, updates dashboard)
                              |
                    Layer 6 — Session Log / Audit
                    (every command: source, target, verdict, IK error,
                     final tip error vs. target)
```

Hard rule for every phase below: **no trigger source is ever allowed to
write to a joint value or call the IK solver directly.** If a feature can't
be implemented as "emit a Layer 0 command," the feature isn't done — it's
built the wrong way.

## 2. Command schema (frozen early, changed only by consensus)

```ts
type ArmCommand = {
  id: string;                // uuid
  source: "dashboard" | "joystick" | "keyboard" | "voice" | "agentic" | "autonomous";
  type: "moveTo" | "jog" | "setJoint";
  target?: { x: number; y: number; z: number; approach?: [number, number, number] };
  delta?: { x: number; y: number; z: number };
  joint?: { name: string; value: number }; // only for type "setJoint"
  timestamp: number;
};
```

Locking this in Week 1 is the single highest-leverage decision in the
project — every subsequent phase is just "a new producer of this type."

## 3. Milestones (maps directly to the rubric's phases)

| # | Milestone | Rubric tie-in | Exit criteria |
|---|-----------|---------------|----------------|
| M0 | Repo scaffold, command schema frozen, URDF loads in Three.js via `urdf-loader` | Visualization (15%) | Arm renders with correct joint tree; joint sliders in a debug panel move the real URDF joints |
| M1 | Live dashboard: joint angles + FK end-effector pose, updating every tick; 6-key panel rendered from `key.config.json` | Visualization (15%) | Panel boxes sit at the exact coordinates in the config, labeled 1–6 |
| M2 | Layer 0–1 scaffolding: command bus + state machine, no-op executor | Architecture (15%) | Can log a fake command through IDLE→JOGGING→IDLE with correct rejects when EXECUTING |
| M3 | IK solver (damped least-squares Jacobian, null-space use of `stylus_pitch` to hold approach = -z) | Inverse Kinematics (15%) | Converges to <2mm tip error within a fixed iteration budget for all 6 key positions; logs error + iteration count |
| M4 | Safety Gate: reachability (precomputed workspace envelope), post-IK joint limit check, velocity/accel clamp from URDF `<limit>` tags, simple capsule self-collision | Architecture & Safety (part of 15%) | Out-of-envelope target is rejected with a machine-readable reason, never silently clamped |
| M5 | Executor: min-jerk trajectory interpolation, drives joints per tick, live dashboard reflects it | IK + Visualization | Smooth motion, no visible joint teleporting, 60fps target |
| M6 | Joystick GUI + keyboard jog, both emitting `jog` commands only | Manual Control (10%) | Both feel responsive (<100ms perceived latency), both go through the same gate/executor path |
| M7 | Deterministic voice control (keyword → command map) | Voice Control (15%) | "move up," "move left," "rotate base 30 degrees" reliably map to correct `jog`/`setJoint` commands |
| M8 | Autonomous PIN entry: per digit → hover above key → descend → confirm within ±5mm tolerance → retract → next digit | Autonomous PIN Entry (20%) — highest single weight, prioritize accordingly | 6-digit PIN completes unattended, session log shows per-key success/fail |
| M9 | Session log / audit report generator (pass/fail summary for judges) | Architecture & Presentation | One-click exportable report: source, target, verdict, IK error, final tip error, per command |
| M10 | Electrical schematic (PoC): power stage, MCU, servo driver, Wi-Fi link, pin-mapping table | Electrical Schematic (5%) | Logically consistent, labeled, buildable from the diagram alone |
| M11 (bonus) | Agentic voice layer: NL → same Layer 0 schema, gated identically, spoken/text confirmation + failure explanation | Agentic Bonus (+10%) | Never bypasses Layer 2; ambiguous input triggers a clarifying question instead of a guess |
| M12 | Polish pass: UI/UX consistency, code cleanup, demo script, README | Polish & Presentation (5%) | Demo runs start-to-finish without manual intervention |

Suggested ordering priority if time runs short: **M0→M3→M4→M5→M8** first
(these cover Visualization + IK + Autonomous PIN Entry = 50% of the
rubric), then M6/M7 (manual + voice = 25%), then M9/M10/M12, then M11 last
since it's bonus-only and explicitly optional.

## 4. Tech stack (locked — matches current scaffold)

- **Build/frontend:** Vite + React + TypeScript (`strict`), Three.js +
  `urdf-loader` for the 3D scene. State managed in `src/store.ts`,
  independent of the Three.js render loop — don't couple React re-renders
  to physics ticks.
- **Module map onto the layers (see `agent.md` for the authoritative repo
  layout):**
  - Layer 0/1 (command bus + state machine) → `src/store.ts`
  - Layer 2 (safety gate) → `src/safety/`
  - Layer 3 (IK solver) → `src/kinematics/`
  - Layer 4 (executor, joint writes) → a named export inside `store.ts`,
    or split to `src/executor.ts` once it outgrows `store.ts` (not yet
    created — part of M2)
  - Layer 5 (trigger sources: scene, dashboard, joystick, keyboard, voice,
    autonomous, agentic) → `src/components/`
  - Layer 6 (session log) → not yet created — part of M9, same rule as
    the executor: shared infra, own module, not folded into `components/`
  - Shared types (`ArmCommand`, etc.) → `src/types.ts`
- **Provided assets:** `given/` holds the organizer originals read-only;
  `public/` holds the runtime copies (`6_dof_arm.urdf`, `key.config.json`)
  actually fetched by the app at load time.
- **IK/backend:** stays entirely client-side (no separate backend) since
  the arm is small (7 joints) and damped least-squares Jacobian IK is
  cheap. Only justified to add a backend if the agentic bonus layer needs
  server-side API-key handling for LLM calls.
- **Voice (deterministic):** Web Speech API for STT is the fastest path;
  fallback to a hosted STT if browser support is inconsistent during
  judging.
- **Agentic (bonus):** any LLM/agent framework — must still emit
  `ArmCommand` JSON via the same `store.ts` entry point and pass through
  `src/safety/` identically to every other source.

## 5. Testing / validation approach

- **Unit:** IK solver correctness against all 6 known key coordinates
  (closed-loop: solve → FK → compare to target, assert <2mm error).
- **Unit:** Safety Gate rejects a hand-picked set of known-unreachable and
  known-out-of-joint-limit targets.
- **Integration:** full command → gate → IK → executor round trip for each
  of the five trigger sources, asserting the dashboard state matches the
  executor's final joint state.
- **End-to-end (manual, pre-demo):** run the full PIN-entry sequence for at
  least 3 different 6-digit PINs including edge cases (repeated digits,
  digits requiring large joint swings) and confirm the session log shows
  6/6 successful key touches.
- **Regression guard:** every trigger source must fail to compile/link if
  it imports the IK solver or executor module directly — enforce via
  module boundaries (e.g. only `executor.ts` imports the joint-writing
  API), not just convention.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| IK doesn't converge near singularities (e.g. arm near full extension for outer keys) | Precompute workspace envelope during M4, warn/reject at the gate before attempting IK, don't discover this live during the demo |
| Voice recognition unreliable in a noisy demo room | Always have keyboard/GUI as a guaranteed fallback path in the live demo script |
| Agentic bonus layer eats time better spent on core rubric | Time-boxed, attempted only after M0–M10 are demo-solid |
| Redundant DOF (`stylus_pitch`) mismanaged, causing tip to not point straight down at contact | Explicitly resolve via null-space projection against the `approach = [0,0,-1]` constraint in M3, add an FK sanity check for tip orientation, not just position |

## 7. Deliverables checklist (from problem statement §8)

- [ ] Working web app, Phases 1–5
- [ ] Source repo incl. diagrams + electrical schematic
- [ ] Deployed URL (bonus)
- [ ] Live demo video (bonus): visualize → manual (joystick+keyboard) →
      voice → PIN autonomous run, in one continuous take
