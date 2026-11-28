-- 014: staff roles, role badges, moderator permissions, and issuer attribution
begin;

create table if not exists public.kapli_moderators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now()
);
alter table public.kapli_moderators enable row level security;
revoke all on public.kapli_moderators from public, anon, authenticated;

create or replace function public.kapli_mod_is_moderator()
returns boolean language sql stable security definer set search_path = ''
as $$
  select auth.uid() is not null and (
    public.kapli_mod_is_admin()
    or exists (select 1 from public.kapli_moderators m where m.user_id = auth.uid())
  );
$$;

create or replace function public.kapli_mod_my_role()
returns text language sql stable security definer set search_path = ''
as $$
  select case
    when public.kapli_mod_is_admin() then 'admin'
    when exists (select 1 from public.kapli_moderators m where m.user_id = auth.uid()) then 'moderator'
    else 'player'
  end;
$$;

create or replace function public.kapli_public_roles(p_nicks text[])
returns table(nickname text, role text)
language sql stable security definer set search_path = ''
as $$
  select p.nickname,
    case when exists (select 1 from public.kapli_admins a where a.user_id = p.user_id)
         then 'admin' else 'moderator' end
  from public.player_profiles p
  where p.nickname = any(coalesce(p_nicks, array[]::text[]))
    and (
      exists (select 1 from public.kapli_admins a where a.user_id = p.user_id)
      or exists (select 1 from public.kapli_moderators m where m.user_id = p.user_id)
    );
$$;

create or replace function public.kapli_mod_admin_list_moderators()
returns table(user_id uuid, nickname text, granted_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_admin() then raise exception 'admin_only' using errcode = 'P0001'; end if;
  return query
    select m.user_id, p.nickname, m.granted_at
    from public.kapli_moderators m
    left join public.player_profiles p on p.user_id = m.user_id
    order by m.granted_at desc;
end;
$$;

create or replace function public.kapli_mod_admin_set_moderator(p_user_id uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_admin() then raise exception 'admin_only' using errcode = 'P0001'; end if;
  if p_user_id is null or p_on is null then raise exception 'invalid_target' using errcode = 'P0001'; end if;
  if exists (select 1 from public.kapli_admins a where a.user_id = p_user_id) then
    raise exception 'admin_role_protected' using errcode = 'P0001';
  end if;
  if p_on then
    insert into public.kapli_moderators(user_id, granted_by)
    values (p_user_id, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from public.kapli_moderators where user_id = p_user_id;
  end if;
  return true;
end;
$$;

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
    'active_bans', (select count(*) from public.kapli_sanctions where kind = 'ban' and revoked_at is null)
  );
end;
$$;

create or replace function public.kapli_mod_admin_queue(p_status text default 'pending')
returns table (
  id bigint, category text, priority text, status text,
  reported_user_id uuid, reported_nickname text, reporter_user_id uuid,
  source text, source_id bigint, evidence jsonb, created_at timestamptz, resolution text
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return query
    select q.id, q.category, q.priority, q.status, q.reported_user_id, p.nickname,
           q.reporter_user_id, q.source, q.source_id, q.evidence, q.created_at, q.resolution
    from public.kapli_moderation_queue q
    left join public.player_profiles p on p.user_id = q.reported_user_id
    where p_status = 'all' or q.status = p_status
    order by case q.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
             q.created_at desc
    limit 200;
end;
$$;

create or replace function public.kapli_mod_admin_appeals(p_status text default 'pending')
returns table (
  id bigint, sanction_id bigint, user_id uuid, nickname text,
  body text, status text, created_at timestamptz, review_note text
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return query
    select a.id, a.sanction_id, a.user_id, p.nickname, a.body, a.status, a.created_at, a.review_note
    from public.kapli_moderation_appeals a
    left join public.player_profiles p on p.user_id = a.user_id
    where p_status = 'all' or a.status = p_status
    order by a.created_at desc limit 200;
end;
$$;

create or replace function public.kapli_mod_admin_find_players(p_query text)
returns table(user_id uuid, nickname text, public_id bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare q text := trim(coalesce(p_query,''));
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  if char_length(q) < 2 then raise exception 'query_too_short' using errcode = 'P0001'; end if;
  return query
    select p.user_id, p.nickname, p.public_id, p.created_at
    from public.player_profiles p
    where p.nickname ilike '%' || q || '%'
       or p.public_id::text = q
       or p.user_id::text = q
    order by case when lower(p.nickname) = lower(q) then 0 else 1 end, p.created_at desc
    limit 30;
end;
$$;

-- Drop/recreate because issuer_nickname is an additional returned column.
drop function if exists public.kapli_mod_admin_sanctions(uuid);
create function public.kapli_mod_admin_sanctions(p_user_id uuid default null)
returns table (
  id bigint, user_id uuid, nickname text, kind text, reason text,
  source text, created_at timestamptz, ends_at timestamptz, revoked_at timestamptz,
  issuer_nickname text, issuer_role text
) language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  return query
    select s.id, s.user_id, p.nickname, s.kind, s.reason, s.source,
           s.created_at, s.ends_at, s.revoked_at, issuer.nickname,
           case when ia.user_id is not null then 'admin' when im.user_id is not null then 'moderator' else null end
    from public.kapli_sanctions s
    left join public.player_profiles p on p.user_id = s.user_id
    left join public.player_profiles issuer on issuer.user_id = s.created_by
    left join public.kapli_admins ia on ia.user_id = s.created_by
    left join public.kapli_moderators im on im.user_id = s.created_by
    where p_user_id is null or s.user_id = p_user_id
    order by s.created_at desc limit 200;
end;
$$;

create or replace function public.kapli_mod_admin_set_sanction(
  p_user_id uuid, p_kind text, p_minutes integer, p_reason text
) returns bigint language plpgsql security definer set search_path = ''
as $$
declare new_id bigint;
begin
  if p_kind = 'ban' then
    if not public.kapli_mod_is_admin() then raise exception 'admin_ban_only' using errcode = 'P0001'; end if;
  elsif p_kind = 'mute' then
    if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
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
  insert into public.kapli_sanctions(user_id, kind, reason, source, created_by, ends_at)
  values (p_user_id, p_kind, trim(p_reason), 'admin', auth.uid(),
          case when p_kind = 'ban' then null else now() + make_interval(mins => p_minutes) end)
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.kapli_mod_admin_revoke_sanction(p_sanction_id bigint, p_reason text default '')
returns boolean language plpgsql security definer set search_path = ''
as $$
declare k text;
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  select s.kind into k from public.kapli_sanctions s where s.id = p_sanction_id and s.revoked_at is null;
  if k is null then return false; end if;
  if k = 'ban' and not public.kapli_mod_is_admin() then raise exception 'admin_ban_only' using errcode = 'P0001'; end if;
  update public.kapli_sanctions
     set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = left(coalesce(p_reason,''),500)
   where id = p_sanction_id and revoked_at is null;
  return found;
end;
$$;

create or replace function public.kapli_mod_admin_resolve_queue(p_queue_id bigint, p_status text, p_note text default '')
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  if p_status not in ('in_review','resolved','dismissed') then raise exception 'invalid_status' using errcode = 'P0001'; end if;
  update public.kapli_moderation_queue
     set status = p_status,
         assigned_to = case when p_status = 'in_review' then auth.uid() else assigned_to end,
         resolved_at = case when p_status in ('resolved','dismissed') then now() else null end,
         resolution = left(coalesce(p_note,''),1000)
   where id = p_queue_id;
  return found;
end;
$$;

create or replace function public.kapli_mod_admin_review_appeal(p_appeal_id bigint, p_decision text, p_note text default '')
returns boolean language plpgsql security definer set search_path = ''
as $$
declare sid bigint; skind text;
begin
  if not public.kapli_mod_is_moderator() then raise exception 'staff_only' using errcode = 'P0001'; end if;
  if p_decision not in ('accepted','rejected') then raise exception 'invalid_decision' using errcode = 'P0001'; end if;
  select a.sanction_id, s.kind into sid, skind
    from public.kapli_moderation_appeals a
    join public.kapli_sanctions s on s.id = a.sanction_id
   where a.id = p_appeal_id and a.status = 'pending'
   for update of a;
  if sid is null then return false; end if;
  if p_decision = 'accepted' and skind = 'ban' and not public.kapli_mod_is_admin() then
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
  end if;
  return true;
end;
$$;

-- Event/anti-cheat review remains administrator-only.
revoke all on function public.kapli_mod_is_moderator() from public, anon, authenticated;
revoke all on function public.kapli_mod_my_role() from public, anon, authenticated;
revoke all on function public.kapli_public_roles(text[]) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_list_moderators() from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_set_moderator(uuid,boolean) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_dashboard() from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_queue(text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_appeals(text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_events(text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_sanctions(uuid) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_find_players(text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_review_event(bigint,text,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_set_sanction(uuid,text,integer,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_revoke_sanction(bigint,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_resolve_queue(bigint,text,text) from public, anon, authenticated;
revoke all on function public.kapli_mod_admin_review_appeal(bigint,text,text) from public, anon, authenticated;

grant execute on function public.kapli_mod_is_moderator() to authenticated;
grant execute on function public.kapli_mod_my_role() to authenticated;
grant execute on function public.kapli_public_roles(text[]) to anon, authenticated;
grant execute on function public.kapli_mod_admin_list_moderators() to authenticated;
grant execute on function public.kapli_mod_admin_set_moderator(uuid,boolean) to authenticated;
grant execute on function public.kapli_mod_admin_dashboard() to authenticated;
grant execute on function public.kapli_mod_admin_queue(text) to authenticated;
grant execute on function public.kapli_mod_admin_appeals(text) to authenticated;
grant execute on function public.kapli_mod_admin_events(text) to authenticated;
grant execute on function public.kapli_mod_admin_sanctions(uuid) to authenticated;
grant execute on function public.kapli_mod_admin_find_players(text) to authenticated;
grant execute on function public.kapli_mod_admin_review_event(bigint,text,text) to authenticated;
grant execute on function public.kapli_mod_admin_set_sanction(uuid,text,integer,text) to authenticated;
grant execute on function public.kapli_mod_admin_revoke_sanction(bigint,text) to authenticated;
grant execute on function public.kapli_mod_admin_resolve_queue(bigint,text,text) to authenticated;
grant execute on function public.kapli_mod_admin_review_appeal(bigint,text,text) to authenticated;

commit;
