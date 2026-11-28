-- KAPLI-3D TEST ONLY · migration 015, part 5/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Sanction revocation rules.

begin;

create or replace function public.kapli_mod_admin_revoke_sanction(p_sanction_id bigint, p_reason text default '')
returns boolean language plpgsql security definer set search_path = ''
as $$
declare s record; actor_role text;
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  select id, user_id, kind, reason into s
    from public.kapli_sanctions where id = p_sanction_id and revoked_at is null for update;
  if not found then return false; end if;
  if s.kind <> 'mute' and not public.kapli_mod_is_admin() then
    raise exception 'admin_ban_only' using errcode = 'P0001';
  end if;
  update public.kapli_sanctions
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left(coalesce(p_reason,''),500)
   where id = p_sanction_id and revoked_at is null;
  actor_role := case when public.kapli_mod_is_admin() then 'admin' else 'moderator' end;
  insert into public.kapli_moderation_actions(action, actor_user_id, actor_role, target_user_id, sanction_id, sanction_kind, reason)
  values ('sanction_revoked', auth.uid(), actor_role, s.user_id, s.id, s.kind, left(coalesce(p_reason,''),500));
  return true;
end;
$$;

commit;
