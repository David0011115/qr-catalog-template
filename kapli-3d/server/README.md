# Server simulation core

This directory contains the rendering-free foundation for the authoritative multiplayer simulation.

## Current modules

- `core/physics.js`: mass-to-radius, movement speed, steering, arena clamping, eating eligibility, bite gain, and mass decay.
- `core/mass-caps.js`: source-exact player/bot/boss merge limits, per-cell caps and shared regular-bot total cap. Numeric rules are extracted from the current game implementation; context-dependent upgrades and mode hooks are supplied through callbacks.
- `core/random.js`: seeded PRNG matching the generator used by the existing two-phone mode, with a serializable seed/counter snapshot.
- `core/viruses.js`: virus movement and collisions, trap ownership/expiry, spike splitting, player forward ejection, bot backward ejection, ejected-mass drag/pickup, feeding a virus, and respawn timers. It exposes complete tick helpers while leaving entity storage and visual effects to the caller.
- `core/abilities.js`: source-derived ability cooldown/power formulas, active timers, shrink-size easing, phase-jump cooldown timing, and decoy movement/collision.
- `core/ability-effects.js`: validated ability casting/cooldowns and source-derived world effects for shield, pulse, slow, push, blink/phase, shrink/cloak, decoy, traps, overload, black hole, anchor, meteors, mirror twin, vampirism, typhoon, ice trail, ghost expiration, Chronos gear wall/rewind/swap, plus serializable effect/history state. Effects are driven by the simulation adapter and injected entity callbacks.
- `modes/territory.js`: server-authoritative territory border movement, circular area-share formula, home-side bot restrictions/spawns, foreign-side speed penalty, eaten-player border jumps, 80% early win, 4-minute timer and one 30-second overtime, plus snapshot/restore.
- `simulation/ability-runtime.js`: server-owned ability-slot resolution, monotonic per-owner activation sequence checks, cooldown and timer ticking, effect stepping, Chronos history, and world adapters.
- `simulation/mode-runtime.js`: adapters that step Territory scoring/eat hooks and DuoBack regular/special bosses, meteor strikes, respawns, wave transitions and result callbacks. Entity creation, spawn positions, boss steering and reward side effects remain explicit callbacks.
- `modes/duoback.js`: Duoback difficulty, 50-wave progression, boss spawn scaling, 5-wave special cadence, boost choices/effects, shared pair boosts, break/respawn timing, meteor strike damage, phase transitions, boss-defeat hooks and mode-state snapshot.
- `modes/duoback-bosses.js`: regular boss target selection, wedge/devourer dashes, leech mass drain, weaver spike spawning, twin enrage and boss life/melt.
- `modes/duoback-special.js`: special-boss chunk damage/lifetime, shedding, vortex pull, meteor warnings, split/re-split phases, defeat/escape outcomes. World entity creation/removal is injected through callbacks.
- `room/lifecycle.js`: two-player room lifecycle, readiness/countdown, five-minute waiting timeout, creator/guest leave rules, invalid-code blocking, reconnect handoff and room snapshot/restore.
- `match/lifecycle.js`: immediate pause on disconnect, 30-second reconnect deadline, resume only after both players reconnect, paused-time accounting and mode-specific timeout result callback.
- `storage/recovery.js`: versioned snapshot envelopes, five-second/critical snapshot policy, sequence-checked event replay and recovery gap detection.
- `storage/world-state.js`: JSON-safe world snapshots with stable owner/cell IDs, restored circular owner↔cell links, cell/decoy target references, defensive hit sets, and validation that rejects dangling or mismatched entity references.

These modules are now callable from the fixed simulation tick through `stepAbilities` and `stepMode` adapters. They are not yet wired into a Worker or Durable Object, and the browser game continues to run exactly as before. A room host must still provide authoritative slot/build resolution, entity spawn/remove callbacks, mode-specific steering, and reward/stat persistence.

**Balance invariant:** player cells have no per-cell mass cap and may merge even when their combined mass exceeds the old `MAX_MASS` value. Keep the existing bot and boss caps separate; do not reintroduce a player cap.

## Regression tests

From the `kapli-3d/` directory, run:

```sh
node --test tests
```

The tests cover extracted movement/eating formulas and differential checks against the browser source, deterministic random restoration, virus collisions/splitting, player and bot ejected-mass interactions, ability timing, decoy behavior, ability casting, active world effects, Chronos interactions, territory scoring, border movement, overtime, Duoback wave scaling, boss AI, special attacks, boosts, room/countdown rules, room snapshot restoration, reconnect lifecycle, snapshot consistency and event replay, world entity serialization and reference restoration.

## Authoritative world interactions
- The same phase now also advances ejected blobs and viruses in the original order: ejected blobs feed spikes or are picked up first; viruses then move, expire traps, pop eligible cells, and advance respawn timers.
- Virus splits create stable-ID, rendering-free cells in both the owner and world entity lists. Free split capacity is supplied by `owner.freeCount` or `worldRules.virusRules.ownerStateFor`; progression-specific limits and merge times can be supplied through the virus rules. Respawn positions and split angles use the persisted PRNG state.
- Virus-pop side effects that depend on mode/UI (for example boss food bursts, statistics and notifications) are exposed through `worldRules.onVirusPop`. They are deliberately not guessed by the generic simulation core.



- Each simulation tick now runs the extracted world-interaction phase after player steering: own-cell separation/merging, food pickup, mass decay, player-vs-player/NPC eating, and non-player mass caps.
- The rules preserve the source ordering in `js/game/07-round.js`: cell-pair interactions, food and decay, eating pass, then mass caps. Eating uses the stable cell snapshot, 48-unit broad-phase buckets, source radius threshold, 1.25 mass ratio and 80% mass transfer.
- Food respawn uses the persisted `world.randomState` PRNG stream. A world that can consume food must be initialized with a valid random-state snapshot, or supply a deterministic `worldRules.placeFood` callback.
- Mode- and progression-specific differences are injected through explicit `worldRules` callbacks (for example guard, magnet, food multipliers, ability checks, mode mass caps and eat hooks); no mode-specific result/stat handling is guessed by the generic core.
- The `stepSimulationTick()` result includes interaction summaries and optional ability/mode results. `stepAbilities` runs at the start of the fixed tick; `stepMode` runs after generic world interactions. `simulateWorld` remains a final extension hook.

## Deterministic input loop

- `simulation/loop.js` accepts normalized direction commands with monotonically increasing per-player sequence numbers; malformed and stale commands are rejected.
- Accepted commands are queued and acknowledged only after the authoritative tick processes them. A newer pending command replaces an older unprocessed direction for that player.
- `stepSimulationTick()` advances exactly (1/30) second, applies the current player direction through the source-matched steering function, then invokes an optional world-step adapter for collisions, food, viruses, abilities and mode hooks.
- The loop marks a snapshot as due every second tick (15 Hz) and increments a snapshot sequence; the caller still performs the actual serialization and durable write. Loop state, pending inputs and sequence cursors have validated JSON-safe snapshot/restore helpers.
- The loop is a simulation-core building block, not a running server: no Durable Object scheduler, WebSocket transport, full room-owned entity adapter or browser-client integration has been added. The existing browser game remains unchanged.

## Ability runtime
- `stepAbilityRuntime(world, state, dt, commands, options)` accepts only owner IDs, monotonically increasing activation sequence numbers and a slot number. The slot is resolved server-side by `resolveAbilityId`; client-supplied ability IDs are ignored.
- Cooldowns and active ability timers advance once per fixed tick before persistent world effects are applied. A successful cast starts its cooldown; failed casts do not.
- `state.lastCommandSeq` must be included in the world snapshot so activation replay is rejected after recovery. `world.abilityState` stores decoys, effect timers and Chronos history state for serialization.
- Mode/build-dependent facts (slot contents, levels, Chronos arena state, player-specific effects) are supplied by trusted server callbacks. Do not accept those values from the client.

## Mode runtime
- `createTerritoryRules(state)` provides the territory-aware movement multiplier, bot eat restriction and the player-eaten border-jump hook. `stepTerritoryRuntime` updates the border, evaluates early win/time/overtime and reports results.
- `stepDuobackRuntime` advances regular and special boss rules, meteor damage, player respawn timers and wave/break progression. The room adapter must resolve boss entities and implement spawn/remove, steering, food/virus and reward callbacks.
- These are server-side rule adapters, not a completed online mode. Their callbacks still need to be bound to the actual room entity model and validated against full source-level gameplay parity.

## Next implementation steps

1. Define durable serialization for entity references, including owner/cell IDs and reference-based ability hit sets; the current recovery helpers validate snapshots and event replay but are not a SQLite adapter.
2. Build the deterministic simulation orchestrator around the approved 30 Hz server tick, 15 Hz snapshots, input sequence numbers and acknowledgements.
3. Connect the audited physics, mass caps, viruses, abilities and mode hooks through explicit world/entity adapters.
4. Add end-to-end tests for command validation, match recovery and cross-mode state transitions.
5. Only after separate approval, add the Worker/Durable Object entry points and connect the existing Supabase services. No Cloudflare or Supabase resources have been changed.
