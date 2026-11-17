# Server simulation core

This directory contains the rendering-free foundation for the authoritative multiplayer simulation.

## Current modules

- `core/physics.js`: mass-to-radius, movement speed, steering, arena clamping, eating eligibility, bite gain, and mass decay. Numeric rules are extracted from the current game implementation; context-dependent upgrades and mode hooks are supplied through callbacks.
- `core/random.js`: seeded PRNG matching the generator used by the existing two-phone mode, with a serializable seed/counter snapshot.
- `core/viruses.js`: virus movement and collisions, trap ownership/expiry, spike splitting, ejected-mass launch/drag/pickup, feeding a virus, and respawn timers. It exposes complete tick helpers while leaving entity storage and visual effects to the caller.
- `core/abilities.js`: source-derived ability cooldown/power formulas, active timers, shrink-size easing, phase-jump cooldown timing, and decoy movement/collision.
- `core/ability-effects.js`: source-derived ability casting and world effects for shield, pulse, slow, push, blink/phase, shrink/cloak, decoy, traps, overload, black hole, anchor, meteors, mirror twin, vampirism, typhoon, ice trail, ghost expiration, Chronos gear wall/rewind/swap, plus serializable effect/history state. The module uses injected world/entity callbacks and is not yet wired into the live game loop or Durable Object.

These modules are not wired into a Worker or Durable Object yet. The browser game continues to run exactly as before.

**Balance invariant:** player cells have no per-cell mass cap and may merge even when their combined mass exceeds the old `MAX_MASS` value. Keep the existing bot and boss caps separate; do not reintroduce a player cap.

## Regression tests

From the `kapli-3d/` directory, run:

```sh
node --test tests/physics/*.test.js
```

The tests cover extracted movement/eating formulas, deterministic random restoration, virus collisions/splitting, ejected-mass interactions, ability timing, decoy behavior, ability casting, active world effects, Chronos interactions, and timer ordering.

## Next extraction steps

1. Remaining ability world effects and collision interactions.
2. Territory and DuoBack server-side mode rules.
3. Complete match snapshot/event serialization and recovery.
4. Comparative tests against the browser implementation.
5. Worker/room integration after the core passes those tests.
