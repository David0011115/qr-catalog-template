-- KAPLI-3D TEST ONLY · migration 015, part 3/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Staff dashboard and sanction-history/evidence query.

begin;

-- Updated counters include temporary bans.
create or replace function public.kapli_mod_admin_dashboard()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'queue_pending', (select count(*) from public.kapli_moderation_queue where status in ('pending','in_review')),
    'appeals_pending', (select count(*) from public.kapli_moderation_appeals where status = 'pending'),
    'events_new', (select count(*) from public.kapli_suspicious_events where review_status in ('new','reviewing')),
    'active_mutes', (select count(*) from public.kapli_sanctions where kind = 'mute' and revoked_at is null and ends_at > now()),
    'active_temp_bans', (select count(*) from public.kapli_sanctions where kind = 'temp_ban' and revoked_at is null and ends_at > now()),
    'active_bans', (select count(*) from public.kapli_sanctions where kind = 'ban' and revoked_at is null)
  );
end;
$$;

-- Return each sanction with its full evidence history.
drop function if exists public.kapli_mod_admin_sanctions(uuid);
create function public.kapli_mod_admin_sanctions(p_user_id uuid default null)
returns table (
  id bigint, user_id uuid, nickname text, kind text, reason text,
  source text, created_at timestamptz, ends_at timestamptz, revoked_at timestamptz,
  issuer_nickname text, issuer_role text, revoke_reason text, evidence jsonb
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return query
    select s.id, s.user_id, p.nickname, s.kind, s.reason, s.source,
      s.created_at, s.ends_at, s.revoked_at, issuer.nickname,
      case when ia.user_id is not null then 'admin' when im.user_id is not null then 'moderator'
           when s.source = 'automatic' then 'arbiter' else null end,
      s.revoke_reason,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', ev.id, 'source', ev.source, 'source_id', ev.source_id,
        'violation_type', ev.violation_type, 'body_snapshot', ev.body_snapshot,
        'created_at', ev.created_at
      ) order by ev.created_at desc)
      from public.kapli_sanction_evidence ev where ev.sanction_id = s.id), '[]'::jsonb)
    from public.kapli_sanctions s
    left join public.player_profiles p on p.user_id = s.user_id
    left join public.player_profiles issuer on issuer.user_id = s.created_by
    left join public.kapli_admins ia on ia.user_id = s.created_by
    left join public.kapli_moderators im on im.user_id = s.created_by
    where p_user_id is null or s.user_id = p_user_id
    order by s.created_at desc limit 200;
end;
$$;

commit;
