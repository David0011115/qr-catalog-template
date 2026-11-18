# Kapli 3D — authoritative online server

This directory contains the rendering-free game simulation and the Cloudflare adapter used by the online browser client. All repository work is kept on branch `kapli-3d-online-test`; this package does not deploy or modify remote Cloudflare or Supabase resources by itself.

## Runtime architecture

- `cloudflare/src/worker.js` authenticates Supabase access tokens, checks the privacy-consent RPC and allowed origins, loads the player's profile/save using that player's session, and routes room operations to a named Durable Object.
- `cloudflare/src/room-object.js` implements room HTTP operations, one-time WebSocket tickets, command intake, the 30 Hz authoritative match scheduler, 15 Hz snapshots, SQLite persistence/recovery, reconnect alarms and retryable result writes.
- `cloudflare/src/index.js` exports the Worker and SQLite-backed `GameRoom` Durable Object. `cloudflare.config.ts` declares the Durable Object binding and deployment settings.
- `js/game/14g-online-server.js` connects the browser game to the Worker. In server mode the normal round loop delegates simulation to server snapshots; the client sends normalized movement, ability-slot, action and offered-boost commands rather than authoritative coordinates or results.
- `supabase/results.js` writes authoritative Territory/DuoBack results through the service-role-only RPCs defined in `../ONLINE-SERVER-RESULTS-MIGRATION.sql`.

## Simulation modules

- `core/physics.js`, `core/mass-caps.js`, `core/random.js`, `core/viruses.js` and `core/world-step.js` implement shared movement, eating, decay, deterministic randomness, viruses, ejected mass and world interactions.
- `core/abilities.js`, `core/ability-effects.js` and `core/utility-abilities.js` implement ability formulas, casting, cooldowns and persistent world effects, including Chronos interactions.
- `match/` owns match creation, spawn, lifecycle and world runtime.
- `modes/territory.js` and `modes/duoback*.js` implement Territory scoring/border/overtime and DuoBack waves, boosts, bosses and special-boss phases.
- `simulation/loop.js`, `simulation/ability-runtime.js` and `simulation/mode-runtime.js` compose deterministic input processing, ability effects and mode rules.
- `room/lifecycle.js` implements two-player room creation, readiness/countdown, waiting timeout, invalid-code throttling, leave rules and room recovery.
- `match/lifecycle.js` pauses a match on disconnect and enforces the 30-second reconnect window.
- `storage/world-state.js` validates JSON-safe world snapshots and restores stable entity references; `storage/recovery.js` manages versioned snapshots and ordered event replay.

**Balance invariant:** player cells do not have the old per-cell `MAX_MASS` cap and may merge above that value. Keep bot and boss caps separate.

## Protocol and trust boundaries

- The server authenticates users through Supabase; room identity comes from the authenticated user, not from a client-supplied player ID.
- The client submits intent/commands, not positions, physics state or a declared match result.
- Ability IDs and build-dependent values are resolved from trusted server-side state.
- Room commands are sequence-checked; stale or malformed input is rejected.
- WebSocket access uses short-lived, one-time room tickets.
- Result persistence is server-side and idempotent. Temporary Supabase failures remain retryable.
- Privacy consent is checked before profile/save data is loaded for online play.

These controls are covered by automated tests, but they do not replace a live deployment security review.

## Run checks locally

From the `kapli-3d/` project directory:

```sh
node --test
```

Build the Worker from `server/cloudflare/`:

```sh
npm install
npm run build
```

The GitHub Actions workflow `.github/workflows/kapli-3d-server-tests.yml` runs browser/server JavaScript syntax checks, the Worker build and the Node regression suite on pushes to `kapli-3d-online-test`.

The regression suite covers physics/source-parity formulas, deterministic random restoration, viruses and ejected mass, ability effects and Chronos, Territory, DuoBack bosses/waves/boosts, room lifecycle, Worker/DO protocol, client wiring, snapshots/event replay and Supabase result persistence.

## Remaining release checks

The code and automated test suite are not proof of a live multiplayer release. The following still require the owner's service accounts or real devices:

1. Verify `../PRIVACY-CONSENT-MIGRATION.sql` has been applied (the Worker requires `kapli_has_privacy_consent()`), and apply `../ONLINE-SERVER-RESULTS-MIGRATION.sql` after the existing Duo records migration.
2. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `ALLOWED_ORIGINS` as Worker secrets.
3. Deploy the Worker/SQLite Durable Object from `cloudflare/`.
4. Run a two-account end-to-end test for room creation/join, both modes, abilities/actions/boosts, disconnect/reconnect and result persistence.
5. Measure real-device behavior, latency and load before public release.

No deployment, Supabase migration, production secret change, or modification to the `main` branch is performed by this repository work.
