-- Server-authoritative online match results.
-- Apply after DUO-RECORDS-MIGRATION.sql. No second rating system is created:
-- verified results are written into the existing kapli_duo_territory and
-- kapli_duo_coop tables. This table is only an idempotency/audit ledger.

create table if not exists public.kapli_duo_server_matches (
  match_id uuid primary key,
  mode text not null check (mode in ('territory', 'duoback')),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  guest_user_id uuid not null references auth.users(id) on delete cascade,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (host_user_id <> guest_user_id)
);

alter table public.kapli_duo_server_matches enable row level security;
revoke all on table public.kapli_duo_server_matches from anon, authenticated;
grant select, insert, update, delete on table public.kapli_duo_server_matches to service_role;

create or replace function public.kapli_duo_territory_submit_server(
  p_match_id uuid,
  p_host_user_id uuid,
  p_guest_user_id uuid,
  p_host_result text,
  p_host_share integer,
  p_extra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_host_result text;
  v_guest_result text;
  v_inserted integer;
  v_extra jsonb := coalesce(p_extra, '{}'::jsonb);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_match_id is null or p_host_user_id is null or p_guest_user_id is null
     or p_host_user_id = p_guest_user_id
     or p_host_result is null or p_host_result not in ('win', 'loss', 'draw')
     or p_host_share is null or p_host_share not between 0 and 100 then
    return jsonb_build_object('ok', false, 'reason', 'invalid-match-result');
  end if;

  v_host_result := p_host_result;
  -- A reconnect-timeout is decided by the connection rule, not the current
  -- territory percentage. Keep the actual share for statistics, but do not
  -- reject a valid forfeit winner (or double-disconnect draw) for that reason.
  if coalesce(v_extra->>'reason', '') <> 'reconnect-timeout' and (
       (v_host_result = 'win' and p_host_share < 51)
       or (v_host_result = 'loss' and p_host_share > 49)
       or (v_host_result = 'draw' and p_host_share not between 48 and 52)
     ) then
    return jsonb_build_object('ok', false, 'reason', 'result-share-mismatch');
  end if;
  v_guest_result := case v_host_result
    when 'win' then 'loss'
    when 'loss' then 'win'
    else 'draw'
  end;

  -- Return idempotently before the per-player rate limit, so a retry after a
  -- successful commit is acknowledged immediately instead of appearing pending.
  if exists (select 1 from public.kapli_duo_server_matches where match_id = p_match_id) then
    if exists (
      select 1 from public.kapli_duo_server_matches
      where match_id = p_match_id and mode = 'territory'
        and host_user_id = p_host_user_id and guest_user_id = p_guest_user_id
    ) then
      return jsonb_build_object('ok', true, 'alreadyRecorded', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'match-id-collision');
  end if;

  if exists (
    select 1 from public.kapli_duo_territory
    where user_id in (p_host_user_id, p_guest_user_id)
      and last_at > now() - interval '40 seconds'
  ) then
    return jsonb_build_object('ok', false, 'reason', 'rate-limited');
  end if;

  insert into public.kapli_duo_server_matches(match_id, mode, host_user_id, guest_user_id, result)
  values (
    p_match_id, 'territory', p_host_user_id, p_guest_user_id,
    v_extra || jsonb_build_object('hostShare', p_host_share, 'hostResult', v_host_result, 'guestResult', v_guest_result)
  )
  on conflict (match_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'alreadyRecorded', true);
  end if;

  insert into public.kapli_duo_territory as current_stats
    (user_id, wins, losses, draws, best_share, last_at)
  values (
    p_host_user_id,
    (v_host_result = 'win')::integer,
    (v_host_result = 'loss')::integer,
    (v_host_result = 'draw')::integer,
    p_host_share,
    now()
  )
  on conflict (user_id) do update set
    wins = current_stats.wins + excluded.wins,
    losses = current_stats.losses + excluded.losses,
    draws = current_stats.draws + excluded.draws,
    best_share = greatest(current_stats.best_share, excluded.best_share),
    last_at = now();

  insert into public.kapli_duo_territory as current_stats
    (user_id, wins, losses, draws, best_share, last_at)
  values (
    p_guest_user_id,
    (v_guest_result = 'win')::integer,
    (v_guest_result = 'loss')::integer,
    (v_guest_result = 'draw')::integer,
    100 - p_host_share,
    now()
  )
  on conflict (user_id) do update set
    wins = current_stats.wins + excluded.wins,
    losses = current_stats.losses + excluded.losses,
    draws = current_stats.draws + excluded.draws,
    best_share = greatest(current_stats.best_share, excluded.best_share),
    last_at = now();

  return jsonb_build_object('ok', true, 'alreadyRecorded', false);
end;
$$;

create or replace function public.kapli_duo_coop_submit_server(
  p_match_id uuid,
  p_host_user_id uuid,
  p_guest_user_id uuid,
  p_diff integer,
  p_waves integer,
  p_time integer,
  p_bosses integer,
  p_bots integer,
  p_respawns integer,
  p_extra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted integer;
  v_extra jsonb := coalesce(p_extra, '{}'::jsonb);
  v_prev timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role_required';
  end if;
  if p_match_id is null or p_host_user_id is null or p_guest_user_id is null
     or p_host_user_id = p_guest_user_id
     or p_diff is null or p_diff not between 0 and 2
     or p_waves is null or p_waves not between 0 and 500
     or p_time is null or p_time not between 1 and 36000
     or p_bosses is null or p_bots is null or p_respawns is null
     or p_waves * 12 > p_time
     or p_bosses not between 0 and p_waves * 5 + 5
     or p_bots not between 0 and p_time * 3
     or p_respawns not between 0 and p_time / 4 + 1 then
    return jsonb_build_object('ok', false, 'reason', 'invalid-match-result');
  end if;

  -- A duplicate match ID is an acknowledged retry only for the same mode and pair.
  if exists (select 1 from public.kapli_duo_server_matches where match_id = p_match_id) then
    if exists (
      select 1 from public.kapli_duo_server_matches
      where match_id = p_match_id and mode = 'duoback'
        and host_user_id = p_host_user_id and guest_user_id = p_guest_user_id
    ) then
      return jsonb_build_object('ok', true, 'alreadyRecorded', true);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'match-id-collision');
  end if;

  select max(created_at) into v_prev
  from public.kapli_duo_coop where user_id = p_host_user_id;
  if v_prev is not null and v_prev > now() - interval '60 seconds' then
    return jsonb_build_object('ok', false, 'reason', 'rate-limited');
  end if;

  insert into public.kapli_duo_server_matches(match_id, mode, host_user_id, guest_user_id, result)
  values (
    p_match_id, 'duoback', p_host_user_id, p_guest_user_id,
    v_extra || jsonb_build_object(
      'difficulty', p_diff, 'waves', p_waves, 'time', p_time,
      'bosses', p_bosses, 'bots', p_bots, 'respawns', p_respawns
    )
  )
  on conflict (match_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('ok', true, 'alreadyRecorded', true);
  end if;

  insert into public.kapli_duo_coop
    (user_id, mate_user, diff, waves, time_s, bosses, bots, respawns)
  values (
    p_host_user_id, p_guest_user_id, p_diff, p_waves, p_time,
    coalesce(p_bosses, 0), coalesce(p_bots, 0), coalesce(p_respawns, 0)
  );

  return jsonb_build_object('ok', true, 'alreadyRecorded', false);
end;
$$;

revoke all on function public.kapli_duo_territory_submit_server(uuid, uuid, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.kapli_duo_coop_submit_server(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, jsonb) from public, anon, authenticated;
grant execute on function public.kapli_duo_territory_submit_server(uuid, uuid, uuid, text, integer, jsonb) to service_role;
grant execute on function public.kapli_duo_coop_submit_server(uuid, uuid, uuid, integer, integer, integer, integer, integer, integer, jsonb) to service_role;
