import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABILITY_DATA, abilityOn, abilityPower, abilityCooldown, canCastAbility,
  setAbilityActive, startAbilityCooldown, tickAbilityOwner, createDecoy,
  stepDecoy, stepDecoys,
} from '../../server/core/abilities.js';

const owner = (id, extra = {}) => ({ id, cells: [], abCd: {}, abT: {}, ...extra });
const cell = (mass, x = 0, z = 0, own = {}) => ({
  mass, x, z, owner: own, rs: 1,
});

test('ability metadata, power and cooldown modifiers match source tuning', () => {
  assert.equal(ABILITY_DATA.shrink.dur, 4);
  assert.equal(abilityPower(0), 1);
  assert.equal(abilityPower(5), 1.325);
  assert.equal(abilityCooldown('shield', 0), 25);
  assert.equal(abilityCooldown('shield', 5), 20);
  assert.equal(abilityCooldown('shield', 5, true), 18);
  assert.equal(abilityCooldown('missing'), null);
});

test('cast validation and activation/cooldown state are authoritative', () => {
  const p = owner('p1', { cells: [{}] });
  assert.equal(canCastAbility(p, 'shield'), true);
  p.abCd.shield = 0.01;
  assert.equal(canCastAbility(p, 'shield'), false);
  p.abCd.shield = 0;
  assert.equal(setAbilityActive(p, 'shrink', 4), true);
  assert.equal(abilityOn(p, 'shrink'), true);
  assert.equal(startAbilityCooldown(p, 'shield', { player: true, level: 5 }), true);
  assert.equal(p.abCd.shield, 20);
});

test('ability tick decrements timers and eases shrink scale back toward 0.7', () => {
  const p = owner('p1', {
    slowT: 1, iceT: 0.05, rs: 1,
    abCd: { shield: 0.5 },
    abT: { shrink: 0.5 },
  });
  tickAbilityOwner(p, 0.1);
  assert.equal(p.slowT, 0.9);
  assert.equal(p.iceT, 0);
  assert.equal(p.abCd.shield, 0.4);
  assert.equal(p.abT.shrink, 0.4);
  assert.ok(Math.abs(p.rs - 0.82) < 1e-12);
});

test('phase jump starts its cooldown only when the second-jump window expires', () => {
  const p = owner('p1', { cells: [{}], phase2: 0.5, abCd: { x_phase: 0 } });
  const result = tickAbilityOwner(p, 0.5, { player: true, level: 0 });
  assert.equal(result.phaseCooldownStarted, true);
  assert.equal(p.phase2, 0);
  assert.equal(p.abCd.x_phase, 27.5);
});

test('owners without an ability cooldown map still tick slow and ice timers', () => {
  const npc = { slowT: 1, iceT: 2, abT: { shrink: 3 }, rs: 1 };
  tickAbilityOwner(npc, 0.25);
  assert.equal(npc.slowT, 0.75);
  assert.equal(npc.iceT, 1.75);
  assert.equal(npc.abT.shrink, 3);
});

test('moving decoy catches larger foe, bursts 18 food and slows non-boss', () => {
  const source = owner('p1', { team: 'blue', cells: [{}] });
  const foeCell = cell(400, 0, 0);
  const foe = owner('p2', { kind: 'bot', cells: [foeCell] });
  const d = createDecoy('p1', 0, 0, 1, 0, 3, 5);
  const result = stepDecoy(d, source, [foe], 1 / 30, 100);
  assert.equal(result.alive, false);
  assert.equal(result.caughtBy, foe);
  assert.equal(result.foodBurst, 18);
  assert.equal(result.foodRadius, 7);
  assert.equal(foe.slowT, 2);
});

test('stationary blink shadow vanishes without food or slow effect', () => {
  const source = owner('p1', { cells: [{}] });
  const foe = owner('p2', { kind: 'bot', cells: [cell(400)] });
  const d = createDecoy('p1', 0, 0, 1, 0, 3, 1, { still: true });
  const result = stepDecoy(d, source, [foe], 0.1, 100);
  assert.equal(result.alive, false);
  assert.equal(result.foodBurst, 0);
  assert.equal(foe.slowT, undefined);
});

test('decoy moves at 55 percent base speed and bounces from arena edge', () => {
  const source = owner('p1', { cells: [{}] });
  const d = createDecoy('p1', 9, 0, 1, 0, 2, 5);
  const result = stepDecoy(d, source, [], 1, 10);
  assert.equal(result.alive, true);
  assert.equal(d.x, 8);
  assert.equal(d.hx, -1);
  assert.equal(d.ttl, 4);
});

test('decoy batch removes expired decoys and keeps active ones', () => {
  const source = owner('p1', { cells: [{}] });
  const map = new Map([['p1', source]]);
  const active = createDecoy('p1', 0, 0, 1, 0, 2, 5, { still: true });
  const expired = createDecoy('p1', 0, 0, 1, 0, 2, 0.01, { still: true });
  const result = stepDecoys([active, expired], map, [source], 0.1, 100);
  assert.deepEqual(result.decoys, [active]);
  assert.equal(result.events.length, 1);
});

test('phase-two timer does not advance for owners without cells', () => {
  const npc = { phase2: 1, abT: {}, abCd: {}, cells: [] };
  tickAbilityOwner(npc, 0.5);
  assert.equal(npc.phase2, 1); assert.equal(npc.abCd.x_phase, undefined);
});