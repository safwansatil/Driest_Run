# agent.md — Standing instructions for coding agents on this repo

This file is context for any AI coding agent (Cursor, Claude Code, etc.)
working in this repository. Read it before touching any file. It encodes
the architectural rules that must not be violated regardless of how a
specific task is worded.

## Project

Browser-only digital twin + control suite for `stylus_arm`, a 7-actuated-
joint arm (`joint_1..joint_6` revolute + `stylus_pitch`), no gripper, fixed
stylus tip. Full spec lives in `given/problem_statement.txt` and `plans.md`. No
physical hardware is ever involved — this is a simulation proving a
control pipeline is trustworthy enough to eventually run on real hardware.

## Non-negotiable architectural rule

**Every trigger source produces `ArmCommand` objects. Nothing else.**
No source (dashboard, joystick, keyboard, voice, agentic, autonomous) may:
- import or call the IK solver directly
- write to a `THREE.Object3D` joint rotation/position directly
- bypass the Safety Gate

If a task description seems to require breaking this rule, stop and flag
it rather than implementing a workaround. This rule is the entire point of
the project (see `plans.md` §1) — it is what lets Vantage trust the same
software on a real arm later.

## Reference data (do not re-derive, use as-is)

### Robot: `stylus_arm` (from provided URDF)

| Joint | Type | Axis | Limits (rad) | Effort | Velocity |
|---|---|---|---|---|---|
| `joint_1` (base yaw) | revolute | Z | ±3.1416 | 60.0 | 2.5 |
| `joint_2` (shoulder) | revolute | Y | ±2.0944 | 60.0 | 2.5 |
| `joint_3` (elbow) | revolute | Y | ±2.6180 | 40.0 | 3.0 |
| `joint_4` (forearm roll) | revolute | Z | ±3.1416 | 25.0 | 3.5 |
| `joint_5` (wrist pitch) | revolute | Y | ±2.0944 | 15.0 | 4.0 |
| `joint_6` (tool roll) | revolute | Z | ±3.1416 | 10.0 | 4.5 |
| `stylus_pitch` (redundant DOF) | revolute | Y | ±2.0944 | 8.0 | 5.0 |
| `stylus_tip_frame` | fixed | — | — | — | — |

Link lengths: L1–L3 = 0.25 m, L4 = L6 = 0.15 m, stylus = 0.126 m. The arm
has 7 actuated joints solving a 6-DOF (position + point-down orientation)
task — `stylus_pitch` is the redundant DOF. Use it (or full null-space
projection) to hold `approach = [0, 0, -1]` at the tip; don't ignore it and
don't treat this as an unconstrained 7→6 problem without a stated
resolution strategy.

### Test panel: `key.config.json`

Frame: `base_link`. Units: meters. `approach_axis: "-z"` (descend straight
down onto every key). Six fixed keys, each `{x, y, z}`. This file is
provided and must never be hand-edited — read it at runtime, don't hardcode
key coordinates elsewhere in the codebase.

## Repo layout (actual, as of current scaffold — Vite + React + TS)

```
Driest_Run/
  given/                    # organizer-provided originals, read-only, never edited
    6_dof_arm.urdf
    key.config.json
    problem_statement.txt
  public/                    # served as-is by Vite; runtime fetch target for urdf-loader
    6_dof_arm.urdf
    key.config.json
    favicon.svg
    icons.svg
  src/
    main.tsx                  # entry point
    App.tsx / App.css         # root component, layout shell
    index.css
    types.ts                   # ArmCommand + all Layer 0 shared types live ONLY here
    store.ts                    # Layer 0 command bus + Layer 1 state machine
                                  # (IDLE/JOGGING/EXECUTING/ESTOPPED) — the single
                                  # source of truth every trigger source dispatches into
    kinematics/                  # Layer 3 — IK solver
                                  #   damped least-squares Jacobian, uses stylus_pitch
                                  #   as the null-space DOF to hold approach = -z
    safety/                       # Layer 2 — Safety Gate
                                  #   reachability envelope, post-IK joint limit check,
                                  #   vel/accel clamp from URDF limits, self-collision
    components/                    # scene (Three.js + urdf-loader), dashboard, panel
                                     # rendering, AND all trigger-source UI:
                                     # joystick, keyboard handler, voice control,
                                     # autonomous PIN runner, (bonus) agentic panel
    assets/
  dist/                          # build output, do not hand-edit
  README.md
  plans.md
  agent.md
```

Note on `store.ts`: this project collapses Layer 0 (command bus) and
Layer 1 (state machine) into one file by convention. That's fine as long
as the module boundary rule below still holds — components dispatch
`ArmCommand`s into `store.ts`, they never call `kinematics/` or mutate
joint state directly. If `store.ts` grows past that scope (e.g. Layer 4
executor logic creeping in), split it — flag this rather than letting it
happen silently.

There is currently no dedicated `executor.ts` or `sessionLog.ts` — if
they don't exist yet under `components/` or `store.ts`, they need to be
created as part of M2/M9 (see `plans.md`). Layer 4 (the only code allowed
to write Three.js joint values) and Layer 6 (session log) should each get
their own module rather than being folded into `components/`, since both
are shared infrastructure, not UI.

## Definition of done, per task

Before marking any pipeline-related task complete:
1. Does the new code emit/consume `ArmCommand` — never a raw joint value —
   at every module boundary except inside `executor.ts`?
2. Does every command pass through `safetyGate.ts` before `ik.ts` or
   `executor.ts` sees it?
3. Is a rejection surfaced with a machine-readable reason (not swallowed,
   not silently clamped)?
4. Is the event appended to the session log (source, target, verdict, IK
   error, final tip error)?
5. Does it work when driven by at least two different trigger sources
   (proves it's actually shared pipeline, not source-specific logic)?

If any answer is "no," the task isn't done regardless of whether the demo
looks right.

## Coding conventions

- TypeScript preferred throughout (already `strict`-configured via
  `tsconfig.app.json` / `tsconfig.node.json` — don't relax it).
- No trigger-source component under `src/components/` (joystick, keyboard
  handler, voice control, autonomous PIN runner, agentic panel) may import
  from `src/kinematics/` directly, or write to a Three.js joint object
  directly. They only ever dispatch an `ArmCommand` (defined in
  `types.ts`) into `store.ts`.
- `store.ts` is the only place allowed to call into `src/safety/` and then
  `src/kinematics/`. The executor step (writing the resolved joint values
  into the Three.js scene) must live in a clearly identifiable function/
  module — either inside `store.ts` behind a named `executeCommand`-style
  export, or split into its own `src/executor.ts` once `store.ts` gets
  large. Either is acceptable; silently mixing it into scene-rendering
  components under `components/` is not.
- Prefer small, testable pure functions for IK math (`kinematics/`) and
  the safety gate checks (`safety/`); keep Three.js scene-graph mutation
  isolated, don't scatter joint writes across multiple components.
- Every rejection reason from `src/safety/` is a stable string enum, not a
  free-text message — the dashboard and the (bonus) agentic layer both
  need to pattern-match on it.
- No hardcoded magic numbers for joint limits/effort/velocity — read from
  the parsed URDF (`public/6_dof_arm.urdf`) at load time, not from the
  reference table above (that table is for human sanity-checking only).
- `given/` is read-only reference material, never imported from or
  modified — `public/` holds the actual runtime copies fetched by the app.

## What NOT to do

- Don't let the autonomous PIN sequencer or the (bonus) agentic component
  write joint state or call `src/kinematics/` directly "just this once for
  a demo shortcut." It goes through `store.ts` → `src/safety/` →
  `src/kinematics/` like every other source, no exceptions, even under
  time pressure before a demo.
- Don't silently clamp an out-of-bounds target into range — reject and
  report per `plans.md` §1/§6.
- Don't treat the agentic (Phase 3B) extension as a replacement for
  deterministic voice control (Phase 3) — both must work independently.
- Don't invent key coordinates or panel geometry beyond what's in
  `key.config.json` / `public/key.config.json`.
- Don't hand-edit anything in `dist/` — it's build output.

## When requirements are ambiguous

State the assumption you're making inline in a code comment or PR
description and proceed — don't block implementation waiting for
clarification unless the ambiguity is about the command schema itself
(Layer 0), the safety gate's reject/accept semantics, or anything that
would be expensive to reverse later. Those get flagged before writing
code.
