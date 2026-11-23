-- Kapli 3D 2.5.3–2.5.4: a rejected record comes with a reason, sent to the player as a private message from the «Создатель».
-- Needs RECORDS-REVIEW-MIGRATION.sql, RECORDS-DETAILS-MIGRATION.sql, FRIENDS-DM-MIGRATION.sql and DM-THREADS-MIGRATION.sql (already run).
-- Run once in SQL Editor (running it again is safe).
--   * kapli_review_reject: the «Создатель» deletes a held record and the player gets his message with the reason;
--   * private messages with the «Создатель» need no friendship: he can write to any player, and a player he wrote to can answer him;
--     everyone else still writes only to friends, the block list and the limits stay as they were;
--   * a rejected record is not erased: it goes to «🚫 Отклонённые» (a table closed to everyone), nobody sees it in the rating,
--     and for 7 days the «Создатель» can bring it back with «Восстановить» (kapli_rejected_restore) — the player is told by a message too;
--     after 7 days the rejected record is deleted for good.

begin;

create or replace function public.kapli_is_creator_id(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kapli_badge_grants where user_id = u and badge = 'creator')
$$;

-- may «a» write to «b»
create or replace function public.kapli_dm_allowed(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select a is not null and b is not null and a <> b and not public.kapli_is_blocked(a, b) and (
    public.kapli_are_friends(a, b)
    or public.kapli_is_creator_id(a)
    or (public.kapli_is_creator_id(b) and exists (select 1 from public.kapli_dm d where d.sender = b and d.recipient = a)))
$$;

create or replace function public.kapli_dm_send(p_nick text, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
  t text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if t = '' then raise exception 'empty'; end if;
  if other is null or not public.kapli_dm_allowed(me, other) then raise exception 'not_friends'; end if;
  if exists (select 1 from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 second') then raise exception 'too_fast'; end if;
  if (select count(*) from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 day') >= 500 then raise exception 'daily_limit'; end if;
  return query insert into public.kapli_dm (sender, recipient, body) values (me, other, left(t, 300)) returning kapli_dm.id, kapli_dm.created_at;
end $$;

-- the conversations list also says whether you can write there (can_write)
drop function if exists public.kapli_dm_threads();
create function public.kapli_dm_threads()
returns table (nickname text, public_id bigint, is_friend boolean, online boolean, last_seen timestamptz,
               last_body text, last_mine boolean, last_at timestamptz, unread integer, can_write boolean)
language sql stable security definer set search_path = '' as $$
  with me as (select auth.uid() as id),
  last_msg as (
    select distinct on (o.other) o.other, d.body, d.sender = me.id as mine, d.created_at
    from public.kapli_dm d
    cross join me
    cross join lateral (select case when d.sender = me.id then d.recipient else d.sender end as other) o
    where me.id in (d.sender, d.recipient)
    order by o.other, d.id desc
  )
  select p.nickname::text, p.public_id,
         public.kapli_are_friends(me.id, l.other),
         coalesce(pr.last_seen > now() - interval '2 minutes', false), pr.last_seen,
         left(l.body, 120), l.mine, l.created_at,
         (select count(*)::int from public.kapli_dm u where u.sender = l.other and u.recipient = me.id and u.read_at is null),
         public.kapli_dm_allowed(me.id, l.other)
  from last_msg l
  cross join me
  join public.player_profiles p on p.user_id = l.other
  left join public.kapli_presence pr on pr.user_id = l.other
  where not public.kapli_is_blocked(me.id, l.other)
  order by l.created_at desc
  limit 100;
$$;

-- rejected records, kept so they can be brought back (only the functions below reach this table)
create table if not exists public.kapli_records_rejected (
  user_id uuid not null references auth.users (id) on delete cascade, mode text not null, score bigint not null, prev_score bigint, msg text,
  rejected_at timestamptz not null default now(),
  primary key (user_id, mode));
alter table public.kapli_records_rejected enable row level security;
revoke all on table public.kapli_records_rejected from public, anon, authenticated;

-- take a held record off the rating into «Отклонённые» and tell the player why (the message text comes from the game: mode, score and the reason)
create or replace function public.kapli_review_reject(p_nick text, p_mode text, p_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; t text := left(btrim(coalesce(p_body, '')), 300); k public.kapli_records;
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select user_id into uid from public.player_profiles where nickname = p_nick;
  if uid is null then return 'no such player'; end if;
  select * into k from public.kapli_records where user_id = uid and mode = p_mode and held;
  if k.user_id is null then return 'not held'; end if;
  delete from public.kapli_records_rejected where rejected_at < now() - interval '7 days';
  insert into public.kapli_records_rejected (user_id, mode, score, prev_score, msg, rejected_at) values (uid, p_mode, k.score, k.prev_score, nullif(t, ''), now())
  on conflict (user_id, mode) do update set score = excluded.score, prev_score = excluded.prev_score, msg = excluded.msg, rejected_at = now();
  perform public.kapli_record_review(p_nick, p_mode, false);
  if t <> '' and uid <> auth.uid() then
    insert into public.kapli_dm (sender, recipient, body) values (auth.uid(), uid, t);
  end if;
  return 'deleted';
end $$;

create or replace function public.kapli_rejected_list()
returns table(nickname text, mode text, score bigint, prev_score bigint, msg text, at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  delete from public.kapli_records_rejected where rejected_at < now() - interval '7 days';   -- kept for 7 days
  return query select p.nickname::text, r.mode, r.score, r.prev_score, r.msg, r.rejected_at
    from public.kapli_records_rejected r join public.player_profiles p on p.user_id = r.user_id order by r.rejected_at desc limit 100;
end $$;

-- the report of a rejected record (RECORDS-DETAILS-MIGRATION.sql keeps reports apart, so it is still there)
create or replace function public.kapli_rejected_details(p_nick text, p_mode text)
returns table(score bigint, prev_score bigint, held boolean, at timestamptz, details jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return query select r.score, r.prev_score, false, r.rejected_at, d.details
    from public.kapli_records_rejected r join public.player_profiles p on p.user_id = r.user_id
    left join public.kapli_record_reports d on d.user_id = r.user_id and d.mode = r.mode and d.score = r.score
    where p.nickname = p_nick and r.mode = p_mode and r.rejected_at >= now() - interval '7 days' limit 1;
end $$;

-- bring a rejected record back into the rating (if the player has not beaten it since) and tell the player
create or replace function public.kapli_rejected_restore(p_nick text, p_mode text, p_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; t text := left(btrim(coalesce(p_body, '')), 300); r public.kapli_records_rejected; cur public.kapli_records; lb boolean; res text := 'restored';
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select user_id into uid from public.player_profiles where nickname = p_nick;
  if uid is null then return 'no such player'; end if;
  select * into r from public.kapli_records_rejected where user_id = uid and mode = p_mode and rejected_at >= now() - interval '7 days';
  if r.user_id is null then return 'not rejected'; end if;
  select coalesce((select m.lower_better from public.kapli_mode_rule(p_mode) m), false) into lb;
  select * into cur from public.kapli_records where user_id = uid and mode = p_mode;
  if cur.user_id is null then
    insert into public.kapli_records (user_id, mode, score, updated_at, held, prev_score) values (uid, p_mode, r.score, now(), false, r.prev_score);
  elsif (lb and r.score < cur.score) or (not lb and r.score > cur.score) then
    update public.kapli_records set score = r.score, updated_at = now(), held = false, prev_score = r.prev_score where user_id = uid and mode = p_mode;
  else res := 'kept';   -- the player has a better record now: it stays
  end if;
  delete from public.kapli_records_rejected where user_id = uid and mode = p_mode;
  if t <> '' and uid <> auth.uid() then insert into public.kapli_dm (sender, recipient, body) values (auth.uid(), uid, t); end if;
  return res;
end $$;

revoke all on function public.kapli_rejected_list(), public.kapli_rejected_details(text, text), public.kapli_rejected_restore(text, text, text) from public, anon;
grant execute on function public.kapli_rejected_list(), public.kapli_rejected_details(text, text), public.kapli_rejected_restore(text, text, text) to authenticated;

revoke all on function public.kapli_is_creator_id(uuid), public.kapli_dm_allowed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.kapli_dm_send(text, text), public.kapli_dm_threads(), public.kapli_review_reject(text, text, text) from public, anon;
grant execute on function public.kapli_dm_send(text, text), public.kapli_dm_threads(), public.kapli_review_reject(text, text, text) to authenticated;

commit;
