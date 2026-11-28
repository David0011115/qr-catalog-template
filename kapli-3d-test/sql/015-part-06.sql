-- KAPLI-3D TEST ONLY · migration 015, part 6/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Appeal review and staff action journal query.

begin;

-- An accepted appeal may revoke a mute by staff, but bans require an administrator.
create or replace function public.kapli_mod_admin_review_appeal(p_appeal_id bigint, p_decision text, p_note text default '')
returns boolean language plpgsql security definer set search_path = ''
as $$
declare sid bigint; skind text; target uuid; actor_role text;
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  select a.sanction_id, s.kind, a.user_id into sid, skind, target
    from public.kapli_moderation_appeals a
    join public.kapli_sanctions s on s.id = a.sanction_id
   where a.id = p_appeal_id and a.status = 'pending'
   for update of a;
  if sid is null then return false; end if;
  if p_decision = 'accepted' and skind in ('ban','temp_ban') and not public.kapli_mod_is_admin() then
    raise exception 'admin_ban_only' using errcode = 'P0001';
  end if;
  update public.kapli_moderation_appeals
     set status = p_decision, reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = left(coalesce(p_note,''),1000)
   where id = p_appeal_id and status = 'pending';
  if p_decision = 'accepted' then
    update public.kapli_sanctions
       set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = 'Апелляция удовлетворена'
     where id = sid and revoked_at is null;
    actor_role := case when public.kapli_mod_is_admin() then 'admin' else 'moderator' end;
    insert into public.kapli_moderation_actions(action, actor_user_id, actor_role, target_user_id, sanction_id, sanction_kind, reason)
    values ('appeal_sanction_revoked', auth.uid(), actor_role, target, sid, skind, left(coalesce(p_note,'Апелляция удовлетворена'),500));
  end if;
  return true;
end;
$$;

-- Staff-only read access to the append-only action journal.
create or replace function public.kapli_mod_admin_actions()
returns table (
  id bigint, action text, actor_role text, actor_nickname text,
  target_user_id uuid, target_nickname text, sanction_id bigint,
  sanction_kind text, reason text, created_at timestamptz
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return query
    select a.id, a.action, a.actor_role, ap.nickname, a.target_user_id, tp.nickname,
      a.sanction_id, a.sanction_kind, a.reason, a.created_at
    from public.kapli_moderation_actions a
    left join public.player_profiles ap on ap.user_id = a.actor_user_id
    left join public.player_profiles tp on tp.user_id = a.target_user_id
    order by a.created_at desc limit 200;
end;
$$;

commit;
