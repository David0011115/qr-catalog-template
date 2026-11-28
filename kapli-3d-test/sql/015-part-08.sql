-- KAPLI-3D TEST ONLY · migration 015, part 8/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- DM restrictions and final RPC permissions.

begin;

create or replace function public.kapli_dm_send(p_nick text, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid(); other uuid := public.kapli_find_player(p_nick);
  t text := btrim(coalesce(p_body, '')); banned_kind text;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if t = '' then raise exception 'empty'; end if;
  if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null
    and s.kind in ('ban','temp_ban') and (s.kind = 'ban' or s.ends_at > now())) then
    if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null and s.kind = 'ban') then
      raise exception 'banned' using errcode = 'P0001';
    end if;
    raise exception 'temp_banned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null
    and s.kind = 'mute' and s.ends_at > now()) then raise exception 'muted' using errcode = 'P0001'; end if;
  if other is null or not public.kapli_are_friends(me, other) or public.kapli_is_blocked(me, other) then
    raise exception 'not_friends';
  end if;
  if exists (select 1 from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 second') then
    raise exception 'too_fast';
  end if;
  if (select count(*) from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 day') >= 500 then
    raise exception 'daily_limit';
  end if;
  banned_kind := public.kapli_text_banned(t);
  if banned_kind is not null then
    if banned_kind in ('insult','spam') then perform public.kapli_mod_record_violation(me,banned_kind,'dm',null,t); end if;
    return;
  end if;
  return query insert into public.kapli_dm(sender,recipient,body)
    values (me,other,left(t,300)) returning public.kapli_dm.id, public.kapli_dm.created_at;
end;
$$;

-- RPC permissions.
revoke all on function public.kapli_mod_my_status() from public, anon, authenticated;
revoke all on function public.kapli_mod_record_violation(uuid,text,text,bigint,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_dashboard() from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_sanctions(uuid) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_set_sanction(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_revoke_sanction(bigint,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_review_appeal(bigint,text,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_actions() from public, anon, authenticated;
revoke all on function public.kapli_chat_before_insert() from public, anon, authenticated;
revoke all on function public.kapli_dm_send(text,text) from public, anon;
grant execute on function public.kapli_mod_my_status() to authenticated;
-- kapli_mod_record_violation remains internal; only SECURITY DEFINER moderation paths invoke it.
grant execute on function public.kapli_mod_admin_dashboard() to authenticated;
grant execute on function public.kapli_mod_admin_sanctions(uuid) to authenticated;
grant execute on function public.kapli_mod_admin_set_sanction(uuid,text,integer,text) to authenticated;
grant execute on function public.kapli_mod_admin_revoke_sanction(bigint,text) to authenticated;
grant execute on function public.kapli_mod_admin_review_appeal(bigint,text,text) to authenticated;
grant execute on function public.kapli_mod_admin_actions() to authenticated;
grant execute on function public.kapli_dm_send(text,text) to authenticated;

commit;
