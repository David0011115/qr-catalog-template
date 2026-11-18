# Server simulation core

This directory contains the rendering-free foundation for the authoritative multiplayer simulation.

## Current modules

- `core/physics.js`: mass-to-radius, movement speed, steering, arena clamping, eating eligibility, bite gain, and mass decay.
- `core/mass-caps.js`: source-exact player/bot/boss merge limits, per-cell caps and shared regular-bot total cap. Numeric rules are extracted from the current game implementation; context-dependent upgrades and mode hooks are supplied through callbacks.
- `core/random.js`: seeded PRNG matching the generator used by the existing two-phone mode, with a serializable seed/counter snapshot.
- `core/viruses.js`: virus movement and collisions, trap ownership/expiry, spike splitting, player forward ejection, bot backward ejection, ejected-mass drag/pickup, feeding a virus, and respawn timers. It exposes complete tick helpers while leaving entity storage and visual effects to the caller.
- `core/abilities.js`: source-derived ability cooldown/power formulas, active timers, shrink-size easing, phase-jump cooldown timing, and decoy movement/collision.
- `core/ability-effects.js`: validated ability casting/cooldowns and source-derived world effects for shield, pulse, slow, push, blink/phase, shrink/cloak, decoy, traps, overload, black hole, anchor, meteors, mirror twin, vampirism, typhoon, ice trail, ghost expiration, Chronos gear wall/rewind/swap, plus serializable effect/history state. Effects are driven by the simulation adapter and injected entity callbacks.
- `modes/territory.js`: server-authoritative territory border movement, circular area-share formula, home-side bot restrictions/spawns for all 24 stable roster slots, foreign-side speed penalty, eaten-player border jumps, 80% early win, 4-minute timer and one 30-second overtime, plus validated network and durable snapshot/restore.
- `simulation/mode-runtime.js` composes DuoBack interaction callbacks: eaten special-boss pieces add source-capped damage; final player losses schedule the source respawn timer; player-eaten bots accelerate a downed partner; player-eaten regular bosses count as defeats and trigger twin-enrage bookkeeping. Regular bosses that time out are removed from the active wave without being counted as player defeats. The room adapter still owns entity lookup/removal, spawn placement and persistent reward delivery.
- `simulation/loop.js` also accepts `createModeRules(world, meta)` before movement and interaction phases. The mode adapter supplies `physicsRules`/`worldRules` for the current tick; `stepAbilities` may return the same two rule objects, which are composed into that tick. This connects source-derived ability effects and Territory/DuoBack modifiers to the generic physics/eating pass without embedding mode assumptions in `world-step.js`.
- `simulation/ability-runtime.js`: server-owned ability-slot resolution, monotonic per-owner activation sequence checks, cooldown and timer ticking, effect stepping, Chronos history, and adapters for `physicsRules`/`worldRules` (active ability flags, player-wide shield and speed effects). Mode cooldown modifiers can be supplied as trusted callbacks.
- `simulation/mode-runtime.js`: adapters that step Territory scoring/eat hooks and DuoBack regular/special bosses, meteor strikes, respawns, wave transitions and result callbacks. `createDuobackRules()` composes source base boss speeds with the DuoBack late-wave/twin modifiers and exposes player speed, armor/eat-block and ability-cooldown rules. Every wave transition returns stable spawn requests; when the room supplies `spawnPositionForBoss`, the runtime creates the authoritative owner/cell entities itself and resolves them by stable IDs on subsequent ticks. Default boss steering uses the shared server physics; chunk allocation, expiry/defeat cleanup and slot recycling are handled by the rendering-free entity helpers. Room callbacks remain available for safe spawn-position selection, virus/food effects, rewards and persistence.
- `modes/duoback.js`: Duoback difficulty, 50-wave progression, boss spawn scaling, 5-wave special cadence, source boss base-speed values, boost choices/effects, shared pair boosts, break/respawn timing, meteor strike damage, phase transitions, boss-defeat hooks and validated mode-state snapshots.
- `modes/duoback-bosses.js`: regular boss target selection, wedge/devourer dashes, leech mass drain, weaver spike spawning, twin enrage and boss life/melt.
- `modes/duoback-entities.js`: stable owner/cell IDs, 3-part regular and 14-part special boss pools, rendering-free spawn/chunk helpers, slot-safe removal/recycling, owner cleanup, world resolution and AI-target steering through `core/physics.js`.
- `modes/duoback-special.js`: special-boss chunk damage/lifetime, shedding, vortex pull, meteor warnings, split/re-split phases, defeat/escape outcomes. The room adapter can now use `modes/duoback-entities.js` for stable boss/cell IDs, source-sized regular/special cell pools, chunk slot allocation, cleanup and source-physics steering.
- `room/lifecycle.js`: two-player room lifecycle, readiness/countdown, five-minute waiting timeout, creator/guest leave rules, invalid-code blocking, reconnect handoff and room snapshot/restore.
- `match/lifecycle.js`: immediate pause on disconnect, 30-second reconnect deadline, resume only after both players reconnect, paused-time accounting and mode-specific timeout result callback.
- `storage/recovery.js`: versioned snapshot envelopes, five-second/critical snapshot policy, sequence-checked event replay and recovery gap detection.
- `storage/world-state.js`: JSON-safe world snapshots with stable owner/cell IDs, restored circular owner↔cell links, cell/decoy target references, defensive hit sets, and validation that rejects dangling or mismatched entity references.

## Online transport and browser integration

The Cloudflare adapter now lives in `cloudflare/`:

- `src/worker.js` validates the Supabase access token, loads the signed-in player's profile/save through the user's own session, applies origin checks, and routes room operations to a named Durable Object.
- `src/room-object.js` implements the two-player room, one-time WebSocket tickets, WebSocket command intake, the fixed 30 Hz simulation scheduler, 15 Hz world snapshots, SQLite snapshots/event log, reconnect alarms and retryable result persistence.
- `src/index.js` exports the Worker and SQLite-backed `GameRoom` Durable Object. `cloudflare.config.ts` declares the SQLite Durable Object and secret bindings.
- `js/game/14g-online-server.js` is loaded by `js/loader.js` after the existing game runtime. The normal round loop delegates to `DuoM.serverTick()` in server mode; the client sends normalized direction, ability-slot, action and offered-boost commands, then renders server snapshots.
- `ONLINE-SERVER-RESULTS-MIGRATION.sql` adds an idempotency ledger and service-role-only RPCs that write authoritative Territory/DuoBack results into the existing statistics tables.

The Worker does not accept client coordinates or a client-declared match result. The server reads player profile/build data from the authenticated Supabase session and uses the Durable Object as the match authority. The browser module is wired into the source loader, but live two-account operation still requires the owner's Cloudflare/Supabase configuration and an end-to-end test after deployment.

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

- `simulation/loop.js` accepts normalized direction commands and ability-slot commands with separate monotonically increasing per-player sequence numbers; malformed and stale commands are rejected.
- Accepted direction and ability commands are queued and acknowledged only after the authoritative tick processes them. A newer pending command replaces an older unprocessed command of the same type for that player.
- `submitAbilityCommand()` accepts only a sequence number and slot index; the ability ID is resolved by the trusted `stepAbilities` adapter. The loop passes the stable server owner ID, sequence and slot into that adapter and acknowledges only after it returns successfully.
- `stepSimulationTick()` advances exactly (1/30) second, processes queued abilities, applies the current player direction through the source-matched steering function, then runs world interactions and the optional mode adapter.
- The loop marks a snapshot as due every second tick (15 Hz) and increments a snapshot sequence; the caller still performs the actual serialization and durable write. Loop state, pending movement/ability commands and both sequence cursors have validated JSON-safe snapshot/restore helpers.
- The loop is a simulation-core building block, not a running server: no Durable Object scheduler, WebSocket transport, full room-owned entity adapter or browser-client integration has been added. The existing browser game remains unchanged.

## Ability runtime
- `stepAbilityRuntime(world, state, dt, commands, options)` accepts only owner IDs, monotonically increasing activation sequence numbers and a slot number. The slot is resolved server-side by `resolveAbilityId`; client-supplied ability IDs are ignored.
- Cooldowns and active ability timers advance once per fixed tick before persistent world effects are applied. A successful cast starts its cooldown; failed casts do not.
- `state.lastCommandSeq` must be included in the world snapshot so activation replay is rejected after recovery. `world.abilityState` stores decoys, effect timers and Chronos history state for serialization.
- Mode/build-dependent facts (slot contents, levels, Chronos arena state, player-specific effects) are supplied by trusted server callbacks. Do not accept those values from the client.

## Mode runtime
- `createTerritoryRules(state)` provides the territory-aware movement multiplier, bot eat restriction, stable-index bot home/spawn helpers and an `onCellLost` hook that moves the border only when a player is eliminated by the opponent. Network snapshots are checked against the 90%-of-radius border and 240/270-second limits; durable snapshots validate role, radius, flags and state bounds. `stepTerritoryRuntime` updates the border, evaluates early win/time/overtime and reports results.
- `createDuobackRules(state)` supplies the movement, armor and cooldown modifiers to the generic simulation and ability adapters. `stepDuobackRuntime` advances regular and special boss rules, meteor damage, player respawn timers and wave/break progression. It requires a persisted deterministic random function. The room adapter must resolve boss entities and implement spawn/remove, steering, food/virus and reward callbacks.
- These are server-side rule adapters, not a completed online mode. Their callbacks still need to be bound to the actual room entity model and validated against full source-level gameplay parity.

## Remaining owner-side setup and verification

1. Apply `ONLINE-SERVER-RESULTS-MIGRATION.sql` in the intended Supabase project after the existing Duo records migration.
2. Configure the four Worker secrets from `.env.example` and set the exact game-site origin.
3. Build and deploy the Worker from `cloudflare/`; this creates/updates the Cloudflare Worker and SQLite Durable Object only when the owner runs the deploy command.
4. Test with two real signed-in accounts: create/join, ready/countdown, both game modes, ability/action/boost commands, reconnect within 30 seconds, and final result persistence.
5. Check real device/browser behavior and load/latency before public release.

Automated tests cover the extracted game rules, Worker request validation, room lifecycle, client-loader wiring, snapshot recovery and Supabase result adapter. They do not substitute for a live Cloudflare/Supabase deployment test. No Cloudflare or Supabase resources are changed by repository edits.
