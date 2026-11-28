-- KAPLI-3D TEST ONLY · migration 015, part 7/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Server-side public chat restrictions.

begin;

-- Public chat and DMs reject a temporary account ban server-side as well.
create or replace function public.kapli_chat_before_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid(); nick text; clean_body text := btrim(coalesce(new.body, ''));
  banned_kind text;
begin
  if me is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  if clean_body = '' or char_length(clean_body) > 500 then raise exception 'invalid_message' using errcode = 'P0001'; end if;
  if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null
    and s.kind in ('ban','temp_ban') and (s.kind = 'ban' or s.ends_at > now())) then
    if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null and s.kind = 'ban') then
      raise exception 'banned' using errcode = 'P0001';
    end if;
    raise exception 'temp_banned' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.kapli_sanctions s where s.user_id = me and s.revoked_at is null
    and s.kind = 'mute' and s.ends_at > now()) then raise exception 'muted' using errcode = 'P0001'; end if;
  select p.nickname into nick from public.player_profiles p where p.user_id = me;
  if nick is null or btrim(nick) = '' then raise exception 'profile_missing' using errcode = 'P0001'; end if;
  banned_kind := public.kapli_text_banned(clean_body);
  if banned_kind is not null then
    if banned_kind in ('insult','spam') then perform public.kapli_mod_record_violation(me,banned_kind,'chat',null,clean_body); end if;
    return null;
  end if;
  new.user_id := me; new.nickname := nick; new.body := clean_body; new.created_at := now();
  return new;
end;
$$;

commit;
