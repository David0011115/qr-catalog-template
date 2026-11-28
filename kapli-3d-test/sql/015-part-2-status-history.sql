-- KAPLI-3D TEST ONLY · migration 015, part 2/4
-- Apply parts in order in Supabase SQL Editor: 1, then 2, then 3, then 4.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Status, violation evidence, dashboard and sanction-history RPCs.

begin;

-- Replace personal status so the client can distinguish mute, temporary ban and permanent ban.
create or replace function public.kapli_mod_my_status()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare s record;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select id, kind, reason, created_at, ends_at
    into s
  from public.kapli_sanctions
  where user_id = auth.uid() and revoked_at is null
    and (kind = 'ban' or ends_at > now())
  order by case kind when 'ban' then 0 when 'temp_ban' then 1 else 2 end,
           ends_at desc nulls first
  limit 1;
  if not found then return jsonb_build_object('active', false); end if;
  return jsonb_build_object('active', true, 'id', s.id, 'kind', s.kind,
    'reason', s.reason, 'created_at', s.created_at, 'ends_at', s.ends_at);
end;
$$;

-- Keep the exact offending phrase independently of the chat/DM row.
create or replace function public.kapli_mod_record_violation(
  p_user_id uuid, p_type text, p_source text, p_source_id bigint default null, p_body text default ''
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  d date := (now() at time zone 'UTC')::date;
  n integer; mins integer; expiry timestamptz; active_id bigint;
  violation_id bigint; new_sanction_id bigint;
begin
  if p_user_id is null or p_type is null or p_type not in ('insult','spam') then
    raise exception 'invalid_violation' using errcode = 'P0001';
  end if;
  if p_source is null or p_source not in ('chat','dm','manual','system') then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;

  insert into public.kapli_moderation_counters(user_id, violation_type, day_utc, violation_count, updated_at)
  values (p_user_id, p_type, d, 1, now())
  on conflict (user_id, violation_type, day_utc)
  do update set violation_count = public.kapli_moderation_counters.violation_count + 1,
                updated_at = now()
  returning violation_count into n;

  mins := n * 5;
  insert into public.kapli_moderation_violations
    (user_id, violation_type, source, source_id, body_snapshot, day_utc, count_for_day, mute_minutes)
  values (p_user_id, p_type, p_source, p_source_id, left(coalesce(p_body,''),1000), d, n, mins)
  returning id into violation_id;

  expiry := now() + make_interval(mins => mins);
  select id into active_id
  from public.kapli_sanctions
  where user_id = p_user_id and kind = 'mute' and source = 'automatic'
    and revoked_at is null and ends_at > now()
  order by ends_at desc limit 1;

  if active_id is null then
    insert into public.kapli_sanctions(user_id, kind, reason, source, ends_at)
    values (p_user_id, 'mute',
      case p_type when 'insult' then 'Оскорбления' else 'Спам или флуд' end,
      'automatic', expiry)
    returning id into new_sanction_id;
  else
    update public.kapli_sanctions
       set ends_at = greatest(ends_at, expiry),
           reason = case p_type when 'insult' then 'Оскорбления' else 'Спам или флуд' end
     where id = active_id
    returning id into new_sanction_id;
  end if;

  insert into public.kapli_sanction_evidence
    (sanction_id, violation_id, source, source_id, violation_type, body_snapshot)
  values (new_sanction_id, violation_id, p_source, p_source_id, p_type, left(coalesce(p_body,''),1000));

  insert into public.kapli_moderation_actions
    (action, actor_user_id, actor_role, target_user_id, sanction_id, sanction_kind, reason)
  values ('automatic_mute_issued', null, 'arbiter', p_user_id, new_sanction_id, 'mute',
    case p_type when 'insult' then 'Оскорбления' else 'Спам или флуд' end);

  return jsonb_build_object('count', n, 'mute_minutes', mins, 'day_utc', d, 'violation_id', violation_id);
end;
$$;

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
