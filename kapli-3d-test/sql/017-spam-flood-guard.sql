-- KAPLI-3D TEST ONLY · migration 017
-- Server-side spam/flood guard for public chat and DMs.
-- Approved thresholds: 3 sec global cooldown; 5 attempts/10 sec; 3 identical messages/60 sec;
-- public chat daily cap: 500 messages per UTC day. Existing DM daily cap remains 500 per rolling 24h.
-- Run once in the TEST Supabase SQL Editor. Does not touch production or player_saves.

begin;

create table if not exists public.kapli_message_guard_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('chat','dm')),
  body_hash text not null check (char_length(body_hash) = 32),
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists kapli_msg_guard_user_time_idx
  on public.kapli_message_guard_events(user_id, created_at desc);
create index if not exists kapli_msg_guard_user_hash_time_idx
  on public.kapli_message_guard_events(user_id, body_hash, created_at desc);
alter table public.kapli_message_guard_events enable row level security;
revoke all on public.kapli_message_guard_events from public, anon, authenticated;

-- Internal helper. The advisory transaction lock serializes attempts for one player,
-- so parallel requests cannot race around the thresholds.
create or replace function public.kapli_message_guard_check(
  p_user_id uuid, p_source text, p_body text
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  prior_at timestamptz;
  event_at timestamptz := clock_timestamp();
  event_hash text;
  burst_n integer;
  repeat_n integer;
  event_id bigint;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid()
     or p_source not in ('chat','dm') or p_body is null then
    raise exception 'invalid_message_guard' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  event_hash := md5(regexp_replace(lower(btrim(p_body)), '\s+', ' ', 'g'));
  select max(e.created_at) into prior_at
    from public.kapli_message_guard_events e
   where e.user_id = p_user_id;

  insert into public.kapli_message_guard_events(user_id, source, body_hash, created_at)
  values (p_user_id, p_source, event_hash, event_at)
  returning id into event_id;

  -- Keep only a short technical window; actual moderation evidence is stored separately.
  delete from public.kapli_message_guard_events
   where user_id = p_user_id and created_at < event_at - interval '2 days';

  select count(*)::integer into burst_n
    from public.kapli_message_guard_events e
   where e.user_id = p_user_id and e.created_at >= event_at - interval '10 seconds';

  select count(*)::integer into repeat_n
    from public.kapli_message_guard_events e
   where e.user_id = p_user_id and e.body_hash = event_hash
     and e.created_at >= event_at - interval '60 seconds';

  -- Record one violation when a threshold is first reached in the current sliding window.
  if repeat_n = 3 or burst_n = 5 then
    perform public.kapli_mod_record_violation(
      p_user_id, 'spam', p_source, null, left(p_body, 1000)
    );
    return 'spam';
  end if;

  if prior_at is not null and prior_at > event_at - interval '3 seconds' then
    -- Return instead of raising: the attempt must commit so burst detection can count it.
    return 'too_fast';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.kapli_message_guard_check(uuid,text,text) from public, anon, authenticated;

-- Public chat: enforce 500 accepted messages per UTC day and apply the shared guard.
create or replace function public.kapli_chat_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  nick text;
  clean_body text := btrim(coalesce(new.body, ''));
  banned_kind text;
  guard_result text;
  daily_n integer;
begin
  if me is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if clean_body = '' or char_length(clean_body) > 500 then
    raise exception 'invalid_message' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.kapli_sanctions s
     where s.user_id = me and s.revoked_at is null
       and s.kind in ('ban','temp_ban') and (s.kind = 'ban' or s.ends_at > now())
  ) then
    if exists (select 1 from public.kapli_sanctions s
      where s.user_id = me and s.revoked_at is null and s.kind = 'ban') then
      raise exception 'banned' using errcode = 'P0001';
    end if;
    raise exception 'temp_banned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kapli_sanctions s
    where s.user_id = me and s.revoked_at is null
      and s.kind = 'mute' and s.ends_at > now()) then
    raise exception 'muted' using errcode = 'P0001';
  end if;

  select p.nickname into nick from public.player_profiles p where p.user_id = me;
  if nick is null or btrim(nick) = '' then
    raise exception 'profile_missing' using errcode = 'P0001';
  end if;

  banned_kind := public.kapli_text_banned(clean_body);
  if banned_kind is not null then
    if banned_kind in ('insult','spam') then
      perform public.kapli_mod_record_violation(me,banned_kind,'chat',null,clean_body);
    end if;
    return null;
  end if;

  -- Serialize daily count and shared guard per account.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));
  select count(*)::integer into daily_n
    from public.kapli_chat c
   where c.user_id = me
     and c.created_at >= ((now() at time zone 'UTC')::date::timestamp at time zone 'UTC');
  if daily_n >= 500 then
    raise exception 'daily_limit' using errcode = 'P0001';
  end if;

  guard_result := public.kapli_message_guard_check(me, 'chat', clean_body);
  if guard_result <> 'ok' then return null; end if;

  new.user_id := me;
  new.nickname := nick;
  new.body := clean_body;
  new.created_at := now();
  return new;
end;
$$;

-- DMs: shared 3-second guard; preserve the existing rolling 24-hour cap of 500.
create or replace function public.kapli_dm_send(p_nick text, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
  t text := btrim(coalesce(p_body, ''));
  banned_kind text;
  guard_result text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if t = '' then raise exception 'empty'; end if;
  if exists (
    select 1 from public.kapli_sanctions s
     where s.user_id = me and s.revoked_at is null
       and s.kind in ('ban','temp_ban') and (s.kind = 'ban' or s.ends_at > now())
  ) then
    if exists (select 1 from public.kapli_sanctions s
      where s.user_id = me and s.revoked_at is null and s.kind = 'ban') then
      raise exception 'banned' using errcode = 'P0001';
    end if;
    raise exception 'temp_banned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kapli_sanctions s
    where s.user_id = me and s.revoked_at is null
      and s.kind = 'mute' and s.ends_at > now()) then
    raise exception 'muted' using errcode = 'P0001';
  end if;
  if other is null or not public.kapli_are_friends(me, other)
     or public.kapli_is_blocked(me, other) then
    raise exception 'not_friends';
  end if;
  if (select count(*) from public.kapli_dm d
       where d.sender = me and d.created_at > now() - interval '1 day') >= 500 then
    raise exception 'daily_limit';
  end if;

  banned_kind := public.kapli_text_banned(t);
  if banned_kind is not null then
    if banned_kind in ('insult','spam') then
      perform public.kapli_mod_record_violation(me,banned_kind,'dm',null,t);
    end if;
    return;
  end if;

  guard_result := public.kapli_message_guard_check(me, 'dm', t);
  if guard_result <> 'ok' then return; end if;

  return query
    insert into public.kapli_dm(sender,recipient,body)
    values (me,other,left(t,300))
    returning public.kapli_dm.id, public.kapli_dm.created_at;
end;
$$;

revoke all on function public.kapli_dm_send(text,text) from public, anon;
grant execute on function public.kapli_dm_send(text,text) to authenticated;

commit;
