# Server simulation core

This directory contains the rendering-free foundation for the authoritative multiplayer simulation.

## Current modules

- `core/physics.js`: mass-to-radius, movement speed, steering, arena clamping, eating eligibility, bite gain, and mass decay. Numeric rules are extracted from the current game implementation; context-dependent upgrades and mode hooks are supplied through callbacks.
- `core/random.js`: seeded PRNG matching the generator used by the existing two-phone mode, with a serializable seed/counter snapshot.

These modules are not wired into a Worker or Durable Object yet. The browser game continues to run exactly as before.

**Balance invariant:** player cells have no per-cell mass cap and may merge even when their combined mass exceeds the old `MAX_MASS` value. Keep the existing bot and boss caps separate; do not reintroduce a player cap.

## Regression tests

From the `kapli-3d/` directory, run:

```sh
node --test tests/physics/*.test.js
```

The tests cover the extracted formulas and deterministic random restoration.

## Next extraction steps

1. Ejected mass and virus/spike state transitions.
2. Ability effects, timers, and cooldown validation.
3. Territory and DuoBack server-side mode rules.
4. Complete match snapshot/event serialization and recovery.
5. Worker/room integration after the core passes comparative tests against the browser implementation.
