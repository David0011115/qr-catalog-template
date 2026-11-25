-- KAPLI-3D TEST ONLY · private-message moderation integration
-- Apply manually in Supabase SQL Editor for test project kccwtpveezsrgwfnflhf.
-- Requires 001-moderation-core.sql and 002-friends-dm-base.sql.
-- This migration does not create or modify the public chat (kapli_chat is absent in this test DB).

begin;

create or replace function public.kapli_dm_send(p_nick text, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
  t text := btrim(coalesce(p_body, ''));
  banned_kind text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if t = '' then raise exception 'empty'; end if;

  -- Permanent bans and active mutes block DMs, but do not affect gameplay.
  if exists (
    select 1
    from public.kapli_sanctions s
    where s.user_id = me
      and s.revoked_at is null
      and (s.kind = 'ban' or (s.kind = 'mute' and s.ends_at > now()))
  ) then
    if exists (
      select 1 from public.kapli_sanctions s
      where s.user_id = me and s.revoked_at is null and s.kind = 'ban'
    ) then
      raise exception 'banned' using errcode = 'P0001';
    end if;
    raise exception 'muted' using errcode = 'P0001';
  end if;

  if other is null or not public.kapli_are_friends(me, other)
     or public.kapli_is_blocked(me, other) then
    raise exception 'not_friends';
  end if;

  if exists (select 1 from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 second') then
    raise exception 'too_fast';
  end if;
  if (select count(*) from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 day') >= 500 then
    raise exception 'daily_limit';
  end if;

  -- Only explicit dictionary kinds "insult" and "spam" trigger automatic sanctions.
  -- Unknown dictionary kinds are blocked but are not automatically punished.
  banned_kind := public.kapli_text_banned(t);
  if banned_kind is not null then
    if banned_kind in ('insult', 'spam') then
      perform public.kapli_mod_record_violation(me, banned_kind, 'dm', null, t);
    end if;
    return;
  end if;

  return query
    insert into public.kapli_dm (sender, recipient, body)
    values (me, other, left(t, 300))
    returning public.kapli_dm.id, public.kapli_dm.created_at;
end;
$$;

revoke all on function public.kapli_dm_send(text, text) from public, anon;
grant execute on function public.kapli_dm_send(text, text) to authenticated;

commit;

-- IMPORTANT:
-- 1) Add dictionary rows to public.kapli_banned_words only with kind='insult' or kind='spam'
--    after the approved moderation vocabulary is prepared. This migration deliberately seeds none.
-- 2) A dictionary match is committed to moderation history and creates/extends the daily mute;
--    the function returns no message row so the client can show a moderation notice.
-- 3) Public chat remains inactive until its actual table and server-side insert path are installed.
