-- KAPLI-3D TEST ONLY · migration 015, part 4/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Admin/moderator sanction issuance rules.

begin;

-- Moderators can issue/revoke only mutes. Admins can manage all three sanction types.
create or replace function public.kapli_mod_admin_set_sanction(
  p_user_id uuid, p_kind text, p_minutes integer, p_reason text
) returns bigint language plpgsql security definer set search_path = ''
as $$
declare new_id bigint; actor_role text;
begin
  if p_kind = 'mute' then
    if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  elsif p_kind in ('temp_ban','ban') then
    if not public.kapli_mod_is_admin() then raise exception 'admin_ban_only' using errcode = 'P0001'; end if;
  else
    raise exception 'invalid_sanction' using errcode = 'P0001';
  end if;
  if p_user_id is null then raise exception 'invalid_sanction' using errcode = 'P0001'; end if;
  if char_length(trim(coalesce(p_reason,''))) < 3 or char_length(p_reason) > 500 then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;
  if p_kind = 'mute' and (p_minutes is null or p_minutes < 1 or p_minutes > 43200) then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;
  if p_kind = 'temp_ban' and (p_minutes is null or p_minutes < 1440 or p_minutes > 10080) then
    raise exception 'invalid_duration' using errcode = 'P0001';
  end if;
  insert into public.kapli_sanctions(user_id, kind, reason, source, created_by, ends_at)
  values (p_user_id, p_kind, trim(p_reason), 'admin', auth.uid(),
    case when p_kind = 'ban' then null else now() + make_interval(mins => p_minutes) end)
  returning id into new_id;
  actor_role := case when public.kapli_mod_is_admin() then 'admin' else 'moderator' end;
  insert into public.kapli_moderation_actions(action, actor_user_id, actor_role, target_user_id, sanction_id, sanction_kind, reason)
  values ('sanction_issued', auth.uid(), actor_role, p_user_id, new_id, p_kind, trim(p_reason));
  return new_id;
end;
$$;

commit;
