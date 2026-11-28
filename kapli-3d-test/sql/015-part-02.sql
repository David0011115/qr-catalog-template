-- KAPLI-3D TEST ONLY · migration 015, part 2/8
-- Run parts strictly in order, one at a time, in Supabase SQL Editor.
-- Supabase project: kccwtpveezsrgwfnflhf
-- Player status and violation recording with immutable evidence.

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

commit;
