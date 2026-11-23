-- «Сообщения» tab for Kapli 3D: the list of private conversations, newest first.
-- Run once in the Supabase SQL Editor after FRIENDS-DM-MIGRATION.sql (safe to run again).
-- Returns one row per player you have exchanged messages with: last message, its time and the unread count.
-- Blocked players are left out; former friends stay in the list (their history is readable, new messages are not allowed).

begin;

create or replace function public.kapli_dm_threads()
returns table (nickname text, public_id bigint, is_friend boolean, online boolean, last_seen timestamptz,
               last_body text, last_mine boolean, last_at timestamptz, unread integer)
language sql
stable
security definer
set search_path = ''
as $$
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
         (select count(*)::int from public.kapli_dm u where u.sender = l.other and u.recipient = me.id and u.read_at is null)
  from last_msg l
  cross join me
  join public.player_profiles p on p.user_id = l.other
  left join public.kapli_presence pr on pr.user_id = l.other
  where not public.kapli_is_blocked(me.id, l.other)
  order by l.created_at desc
  limit 100;
$$;

revoke all on function public.kapli_dm_threads() from public, anon;
grant execute on function public.kapli_dm_threads() to authenticated;

commit;
