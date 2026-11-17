# Server simulation core

This directory contains the rendering-free foundation for the authoritative multiplayer simulation.

## Current modules

- `core/physics.js`: mass-to-radius, movement speed, steering, arena clamping, eating eligibility, bite gain, and mass decay.
- `core/mass-caps.js`: source-exact player/bot/boss merge limits, per-cell caps and shared regular-bot total cap. Numeric rules are extracted from the current game implementation; context-dependent upgrades and mode hooks are supplied through callbacks.
- `core/random.js`: seeded PRNG matching the generator used by the existing two-phone mode, with a serializable seed/counter snapshot.
- `core/viruses.js`: virus movement and collisions, trap ownership/expiry, spike splitting, player forward ejection, bot backward ejection, ejected-mass drag/pickup, feeding a virus, and respawn timers. It exposes complete tick helpers while leaving entity storage and visual effects to the caller.
- `core/abilities.js`: source-derived ability cooldown/power formulas, active timers, shrink-size easing, phase-jump cooldown timing, and decoy movement/collision.
- `core/ability-effects.js`: validated ability casting/cooldowns and source-derived world effects for shield, pulse, slow, push, blink/phase, shrink/cloak, decoy, traps, overload, black hole, anchor, meteors, mirror twin, vampirism, typhoon, ice trail, ghost expiration, Chronos gear wall/rewind/swap, plus serializable effect/history state. The module uses injected world/entity callbacks and is not yet wired into the live game loop or Durable Object.
- `modes/territory.js`: server-authoritative territory border movement, circular area-share formula, home-side bot restrictions/spawns, foreign-side speed penalty, eaten-player border jumps, 80% early win, 4-minute timer and one 30-second overtime, plus snapshot/restore.
- `modes/duoback.js`: Duoback difficulty, 50-wave progression, boss spawn scaling, 5-wave special cadence, boost choices/effects, shared pair boosts, break/respawn timing, meteor strike damage, phase transitions, boss-defeat hooks and mode-state snapshot.
- `modes/duoback-bosses.js`: regular boss target selection, wedge/devourer dashes, leech mass drain, weaver spike spawning, twin enrage and boss life/melt.
- `modes/duoback-special.js`: special-boss chunk damage/lifetime, shedding, vortex pull, meteor warnings, split/re-split phases, defeat/escape outcomes. World entity creation/removal is injected through callbacks.
- `room/lifecycle.js`: two-player room lifecycle, readiness/countdown, five-minute waiting timeout, creator/guest leave rules, invalid-code blocking, reconnect handoff and room snapshot/restore.
- `match/lifecycle.js`: immediate pause on disconnect, 30-second reconnect deadline, resume only after both players reconnect, paused-time accounting and mode-specific timeout result callback.
- `storage/recovery.js`: versioned snapshot envelopes, five-second/critical snapshot policy, sequence-checked event replay and recovery gap detection.\n- `storage/world-state.js`: JSON-safe world snapshots with stable owner/cell IDs, restored circular owner↔cell links, cell/decoy target references, defensive hit sets, and validation that rejects dangling or mismatched entity references.

These modules are not wired into a Worker or Durable Object yet. The browser game continues to run exactly as before.

**Balance invariant:** player cells have no per-cell mass cap and may merge even when their combined mass exceeds the old `MAX_MASS` value. Keep the existing bot and boss caps separate; do not reintroduce a player cap.

## Regression tests

From the `kapli-3d/` directory, run:

```sh
node --test tests
```

The tests cover extracted movement/eating formulas and differential checks against the browser source, deterministic random restoration, virus collisions/splitting, player and bot ejected-mass interactions, ability timing, decoy behavior, ability casting, active world effects, Chronos interactions, territory scoring, border movement, overtime, Duoback wave scaling, boss AI, special attacks, boosts, room/countdown rules, room snapshot restoration, reconnect lifecycle, snapshot consistency and event replay, world entity serialization and reference restoration.

## Deterministic input loop

- `simulation/loop.js` accepts normalized direction commands with monotonically increasing per-player sequence numbers; malformed and stale commands are rejected.
- Accepted commands are queued and acknowledged only after the authoritative tick processes them. A newer pending command replaces an older unprocessed direction for that player.
- `stepSimulationTick()` advances exactly (1/30) second, applies the current player direction through the source-matched steering function, then invokes an optional world-step adapter for collisions, food, viruses, abilities and mode hooks.
- The loop marks a snapshot as due every second tick (15 Hz) and increments a snapshot sequence; the caller still performs the actual serialization and durable write. Loop state, pending inputs and sequence cursors have validated JSON-safe snapshot/restore helpers.
- The loop is a simulation-core building block, not a running server: no Durable Object scheduler, WebSocket transport, collision/world adapter or browser-client integration has been added. The existing browser game remains unchanged.

## Next implementation steps

1. Define durable serialization for entity references, including owner/cell IDs and reference-based ability hit sets; the current recovery helpers validate snapshots and event replay but are not a SQLite adapter.
2. Build the deterministic simulation orchestrator around the approved 30 Hz server tick, 15 Hz snapshots, input sequence numbers and acknowledgements.
3. Connect the audited physics, mass caps, viruses, abilities and mode hooks through explicit world/entity adapters.
4. Add end-to-end tests for command validation, match recovery and cross-mode state transitions.
5. Only after separate approval, add the Worker/Durable Object entry points and connect the existing Supabase services. No Cloudflare or Supabase resources have been changed.
