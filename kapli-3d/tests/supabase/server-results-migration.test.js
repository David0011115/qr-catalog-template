import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../../ONLINE-SERVER-RESULTS-MIGRATION.sql', import.meta.url), 'utf8');

test('server result RPCs acknowledge matching retries before applying player rate limits', () => {
  const territoryStart = sql.indexOf('create or replace function public.kapli_duo_territory_submit_server');
  const coopStart = sql.indexOf('create or replace function public.kapli_duo_coop_submit_server');
  assert.ok(territoryStart >= 0 && coopStart > territoryStart);
  const territory = sql.slice(territoryStart, coopStart);
  const coop = sql.slice(coopStart);
  const territoryRetry = territory.indexOf('where match_id = p_match_id and mode = \'territory\'');
  const territoryRateLimit = territory.indexOf('from public.kapli_duo_territory');
  const coopRetry = coop.indexOf('where match_id = p_match_id and mode = \'duoback\'');
  const coopRateLimit = coop.indexOf('select max(created_at)');
  assert.ok(territoryRetry >= 0 && territoryRetry < territoryRateLimit);
  assert.ok(coopRetry >= 0 && coopRetry < coopRateLimit);
  assert.match(territory, /return jsonb_build_object\('ok', true, 'alreadyRecorded', true\)/);
  assert.match(coop, /return jsonb_build_object\('ok', true, 'alreadyRecorded', true\)/);
});

test('DuoBack result RPC rejects null counters instead of relying on table constraints', () => {
  const coopStart = sql.indexOf('create or replace function public.kapli_duo_coop_submit_server');
  const coop = sql.slice(coopStart);
  for (const field of ['p_diff', 'p_waves', 'p_time', 'p_bosses', 'p_bots', 'p_respawns']) {
    assert.match(coop, new RegExp(field + ' is null'));
  }
  assert.match(coop, /reason', 'match-id-collision'/);
});
