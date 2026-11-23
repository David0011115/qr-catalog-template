-- Kapli 3D 2.5.3: a rejected record comes with a reason, sent to the player as a private message from the «Создатель».
-- Needs RECORDS-REVIEW-MIGRATION.sql, FRIENDS-DM-MIGRATION.sql and DM-THREADS-MIGRATION.sql (already run).
-- Run once in SQL Editor (running it again is safe).
--   * kapli_review_reject: the «Создатель» deletes a held record and the player gets his message with the reason;
--   * private messages with the «Создатель» need no friendship: he can write to any player, and a player he wrote to can answer him;
--     everyone else still writes only to friends, the block list and the limits stay as they were.

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

-- delete a held record and tell the player why (the message text comes from the game: mode, score and the reason)
create or replace function public.kapli_review_reject(p_nick text, p_mode text, p_body text)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; t text := left(btrim(coalesce(p_body, '')), 300);
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select user_id into uid from public.player_profiles where nickname = p_nick;
  if uid is null then return 'no such player'; end if;
  if not exists (select 1 from public.kapli_records where user_id = uid and mode = p_mode and held) then return 'not held'; end if;
  perform public.kapli_record_review(p_nick, p_mode, false);
  if t <> '' and uid <> auth.uid() then
    insert into public.kapli_dm (sender, recipient, body) values (auth.uid(), uid, t);
  end if;
  return 'deleted';
end $$;

revoke all on function public.kapli_is_creator_id(uuid), public.kapli_dm_allowed(uuid, uuid) from public, anon, authenticated;
revoke all on function public.kapli_dm_send(text, text), public.kapli_dm_threads(), public.kapli_review_reject(text, text, text) from public, anon;
grant execute on function public.kapli_dm_send(text, text), public.kapli_dm_threads(), public.kapli_review_reject(text, text, text) to authenticated;

commit;
