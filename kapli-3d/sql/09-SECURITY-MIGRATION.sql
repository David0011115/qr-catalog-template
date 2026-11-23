-- Kapli 3D 2.6: protection of what other players see, error reports, the game version with the online mark.
-- Run once in Supabase SQL Editor (running it again is safe). Needs SHOWCASE-FIELDS-MIGRATION.sql to have been run before.
--
-- 1. Exclusive badges («Создатель», «Бета-тестер», «Ветврач») are granted by the server. A card can show such a badge —
--    and its frame, title and profile background — only if the server granted it. Before, anyone who edited their own save
--    could show «Создатель игры» to everyone.
-- 2. Promo codes are checked by the server: the codes live only here (as salted hashes), once per account, with an end date.
--    Before, the game carried a short fingerprint of every code, and a code could be found from it in minutes.
-- 3. Error reports: the game sends its errors here (no personal data), at most 30 a day from one device.
-- 4. The online mark also stores the game version, so a player stuck on an old copy of the game is visible.

begin;

-- ---------- 1. exclusive badges ----------
create table if not exists public.kapli_badge_grants (
  user_id    uuid not null references auth.users(id) on delete cascade,
  badge      text not null check (badge in ('creator', 'beta', 'vet')),
  granted_at timestamptz not null default now(),
  primary key (user_id, badge)
);
alter table public.kapli_badge_grants enable row level security;
revoke all on table public.kapli_badge_grants from anon, authenticated;

-- who has them now: «Создатель» — only 4opper; «Бета-тестер» and «Ветврач» — whoever already has them in their cloud save
-- (the codes were handed out personally to the testers)
insert into public.kapli_badge_grants (user_id, badge)
select p.user_id, b from public.player_profiles p, unnest(array['creator', 'beta', 'vet']) b where p.nickname = '4opper'
on conflict do nothing;
insert into public.kapli_badge_grants (user_id, badge)
select s.user_id, b.badge from public.player_saves s
cross join lateral (select unnest(array['beta', 'vet']) as badge) b
where jsonb_typeof(s.save_data -> 'badges') = 'object' and (s.save_data -> 'badges') ? b.badge
on conflict do nothing;

-- give or take a badge by hand (SQL Editor only): select public.kapli_grant_badge('nick', 'beta', true);
create or replace function public.kapli_grant_badge(p_nick text, p_badge text, p_on boolean default true)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid;
begin
  select user_id into uid from public.player_profiles where nickname = p_nick;
  if uid is null then return 'no such player'; end if;
  if p_on then insert into public.kapli_badge_grants (user_id, badge) values (uid, p_badge) on conflict do nothing; return 'granted';
  else delete from public.kapli_badge_grants where user_id = uid and badge = p_badge; return 'taken'; end if;
end $$;
revoke all on function public.kapli_grant_badge(text, text, boolean) from public, anon, authenticated;

-- the player's own exclusive badges (the game removes the ones the server does not know about)
create or replace function public.kapli_my_badges()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(badge order by badge), '{}') from public.kapli_badge_grants where user_id = auth.uid();
$$;
revoke all on function public.kapli_my_badges() from public, anon;
grant execute on function public.kapli_my_badges() to authenticated;

-- the card: everything as in SHOWCASE-FIELDS-MIGRATION.sql, plus exclusive items only when granted
create or replace function public.kapli_set_showcase(p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid(); clean jsonb := '{}'::jsonb; k text; v jsonb; e jsonb; sh jsonb := '[]'::jsonb; rc jsonb := '{}'::jsonb;
  mine text[]; ex text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 4096 then raise exception 'bad_showcase' using errcode = 'P0001'; end if;

  foreach k in array array['bg', 'frame', 'title', 'badge', 'skin'] loop
    if jsonb_typeof(p -> k) = 'string' and (p ->> k) ~ '^[A-Za-z0-9_]{0,40}$' then clean := clean || jsonb_build_object(k, p ->> k); end if;
  end loop;
  foreach k in array array['lvl', 'league', 'chaos', 'wins', 'best', 'ach'] loop
    if jsonb_typeof(p -> k) = 'number' and (p ->> k)::numeric between 0 and 100000000 then clean := clean || jsonb_build_object(k, floor((p ->> k)::numeric)); end if;
  end loop;

  -- exclusive items: badge «creator», frame «fr_creator», title «tt_creator», background «bg_creator» (and the same for beta, vet)
  select coalesce(array_agg(badge), '{}') into mine from kapli_badge_grants where user_id = uid;
  foreach ex in array array['creator', 'beta', 'vet'] loop
    if not (ex = any(mine)) then
      if clean ->> 'badge' = ex then clean := clean - 'badge'; end if;
      if clean ->> 'frame' = 'fr_' || ex then clean := clean - 'frame'; end if;
      if clean ->> 'title' = 'tt_' || ex then clean := clean - 'title'; end if;
      if clean ->> 'bg' = 'bg_' || ex then clean := clean - 'bg'; end if;
    end if;
  end loop;

  v := p -> 'ps';
  if jsonb_typeof(v) = 'object' then
    clean := clean || jsonb_build_object('ps', jsonb_strip_nulls(jsonb_build_object(
      's', case when jsonb_typeof(v -> 's') = 'number' and (v ->> 's')::numeric between 0 and 1000 then floor((v ->> 's')::numeric) end,
      'n', case when jsonb_typeof(v -> 'n') = 'number' and (v ->> 'n')::numeric between 0 and 1000 then floor((v ->> 'n')::numeric) end)));
  end if;

  v := p -> 'shelf';
  if jsonb_typeof(v) = 'array' then
    for e in select x from jsonb_array_elements(v) as t(x) limit 3 loop
      if jsonb_typeof(e) = 'array' and jsonb_typeof(e -> 0) = 'string' and (e ->> 0) ~ '^[A-Za-z0-9_]{1,40}$'
         and jsonb_typeof(e -> 1) = 'number' and (e ->> 1)::numeric between 1 and 6 then
        sh := sh || jsonb_build_array(jsonb_build_array(e ->> 0, floor((e ->> 1)::numeric)));
      end if;
    end loop;
    clean := clean || jsonb_build_object('shelf', sh);
  end if;

  v := p -> 'act';
  if jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'g') = 'string' and (v ->> 'g') ~ '^[0-4]{1,45}$'
     and jsonb_typeof(v -> 't') = 'string' and (v ->> 't') ~ '^\d{4}-\d\d-\d\d$' then
    clean := clean || jsonb_build_object('act', jsonb_build_object(
      'g', v ->> 'g', 't', v ->> 't',
      's', case when jsonb_typeof(v -> 's') = 'number' and (v ->> 's')::numeric between 0 and 100000 then floor((v ->> 's')::numeric) else 0 end,
      'b', case when jsonb_typeof(v -> 'b') = 'number' and (v ->> 'b')::numeric between 0 and 100000 then floor((v ->> 'b')::numeric) else 0 end));
  end if;

  v := p -> 'rc';
  if jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'id') = 'number' then
    foreach k in array array['id', 'r', 't', 'm', 'w', 'c', 'x', 'ch', 'pts'] loop
      if jsonb_typeof(v -> k) = 'number' and (v ->> k)::numeric between 0 and 1000000000 then rc := rc || jsonb_build_object(k, floor((v ->> k)::numeric)); end if;
    end loop;
    if jsonb_typeof(v -> 'lg') = 'number' and (v ->> 'lg')::numeric between -1 and 5 then rc := rc || jsonb_build_object('lg', floor((v ->> 'lg')::numeric)); end if;
    if jsonb_typeof(v -> 'n') = 'string' and length(v ->> 'n') between 1 and 40 then rc := rc || jsonb_build_object('n', v ->> 'n'); end if;
    if jsonb_typeof(v -> 'fav') = 'array' and jsonb_typeof(v -> 'fav' -> 0) = 'string' and (v -> 'fav' ->> 0) ~ '^[a-z0-9_]{1,20}$'
       and jsonb_typeof(v -> 'fav' -> 1) = 'number' and (v -> 'fav' ->> 1)::numeric between 0 and 1000000 then
      rc := rc || jsonb_build_object('fav', jsonb_build_array(v -> 'fav' ->> 0, floor((v -> 'fav' ->> 1)::numeric)));
    end if;
    clean := clean || jsonb_build_object('rc', rc);
  end if;

  insert into kapli_showcase(user_id, data, updated_at) values (uid, clean, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $function$;

-- cards that already show an exclusive item without a grant are cleaned now
update public.kapli_showcase s set data = (
  select coalesce(
    (select jsonb_object_agg(key, value) from jsonb_each(s.data) j(key, value)
     where not ((key = 'badge' and value #>> '{}' in ('creator', 'beta', 'vet')
                 or key in ('frame', 'title', 'bg') and value #>> '{}' ~ '^(fr|tt|bg)_(creator|beta|vet)$')
                and not exists (select 1 from public.kapli_badge_grants g where g.user_id = s.user_id
                                and g.badge = regexp_replace(value #>> '{}', '^(fr|tt|bg)_', '')))),
    '{}'::jsonb));

-- ---------- 2. promo codes ----------
create table if not exists public.kapli_secret (k text primary key, v text not null);
insert into public.kapli_secret (k, v) values ('promo_salt', gen_random_uuid()::text) on conflict do nothing;
alter table public.kapli_secret enable row level security;
revoke all on table public.kapli_secret from anon, authenticated;

create table if not exists public.kapli_promo (
  id         text primary key,                                  -- c_duo26, beta, …
  kind       text not null check (kind in ('coins', 'badge')),
  coins      integer not null default 0 check (coins between 0 and 100000),
  badge      text check (badge in ('creator', 'beta', 'vet')),
  expires_at timestamptz,
  active     boolean not null default true
);
create table if not exists public.kapli_promo_codes (
  code_hash text primary key,                                   -- sha256(salt + the normalized code)
  promo_id  text not null references public.kapli_promo(id) on delete cascade
);
create table if not exists public.kapli_promo_uses (
  user_id  uuid not null references auth.users(id) on delete cascade,
  promo_id text not null references public.kapli_promo(id) on delete cascade,
  used_at  timestamptz not null default now(),
  primary key (user_id, promo_id)
);
alter table public.kapli_promo enable row level security;
alter table public.kapli_promo_codes enable row level security;
alter table public.kapli_promo_uses enable row level security;
revoke all on table public.kapli_promo, public.kapli_promo_codes, public.kapli_promo_uses from anon, authenticated;

-- one way to write a code: upper case, no spaces, Latin look-alikes as Cyrillic (ДУО26 typed in Latin still works)
create or replace function public.kapli_promo_hash(p_code text)
returns text language sql stable security definer set search_path = '' as $$
  select encode(sha256(convert_to((select v from public.kapli_secret where k = 'promo_salt')
    || translate(upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g')), 'ABEKMHOPCTXY', 'АВЕКМНОРСТХУ'), 'UTF8')), 'hex');
$$;
revoke all on function public.kapli_promo_hash(text) from public, anon, authenticated;

-- add a code (SQL Editor only):
--   select public.kapli_promo_add('c_new', 'НОВЫЙКОД', 'coins', 5000, null, '2026-12-31 23:59:59+05');
--   select public.kapli_promo_add('beta', 'КОД_ТЕСТЕРОВ', 'badge', 0, 'beta', null);
create or replace function public.kapli_promo_add(p_id text, p_code text, p_kind text, p_coins integer, p_badge text, p_expires timestamptz)
returns text language plpgsql security definer set search_path = '' as $$
begin
  insert into public.kapli_promo (id, kind, coins, badge, expires_at) values (p_id, p_kind, coalesce(p_coins, 0), p_badge, p_expires)
    on conflict (id) do update set kind = excluded.kind, coins = excluded.coins, badge = excluded.badge, expires_at = excluded.expires_at, active = true;
  insert into public.kapli_promo_codes (code_hash, promo_id) values (public.kapli_promo_hash(p_code), p_id) on conflict (code_hash) do update set promo_id = excluded.promo_id;
  return 'ok';
end $$;
revoke all on function public.kapli_promo_add(text, text, text, integer, text, timestamptz) from public, anon, authenticated;

-- the public coin codes from the news
select public.kapli_promo_add('c_druzya', 'ДРУЗЬЯ', 'coins', 1000, null, null);
select public.kapli_promo_add('c_help3d26', 'HELP3D26', 'coins', 3000, null, '2026-11-18 23:59:59+05');
select public.kapli_promo_add('c_duo26', 'ДУО26', 'coins', 7000, null, '2026-11-21 23:59:59+05');
select public.kapli_promo_add('c_duo26', 'DUO26', 'coins', 7000, null, '2026-11-21 23:59:59+05');

-- redeem: { ok, id, kind, coins | badge } or { err: 'auth' | 'unknown' | 'expired' | 'used' | 'often' }
create or replace function public.kapli_redeem_promo(p_code text)
returns json language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); pr public.kapli_promo; recent integer;
begin
  if uid is null then return json_build_object('err', 'auth'); end if;
  select count(*) into recent from public.kapli_promo_uses where user_id = uid and used_at > now() - interval '1 minute';
  if recent >= 5 then return json_build_object('err', 'often'); end if;
  select p.* into pr from public.kapli_promo_codes c join public.kapli_promo p on p.id = c.promo_id
    where c.code_hash = public.kapli_promo_hash(p_code) and p.active;
  if pr.id is null then return json_build_object('err', 'unknown'); end if;
  if pr.expires_at is not null and now() > pr.expires_at then return json_build_object('err', 'expired'); end if;
  if exists (select 1 from public.kapli_promo_uses where user_id = uid and promo_id = pr.id) then return json_build_object('err', 'used'); end if;
  insert into public.kapli_promo_uses (user_id, promo_id) values (uid, pr.id);
  if pr.kind = 'badge' then insert into public.kapli_badge_grants (user_id, badge) values (uid, pr.badge) on conflict do nothing; end if;
  return json_build_object('ok', true, 'id', pr.id, 'kind', pr.kind, 'coins', pr.coins, 'badge', pr.badge);
end $$;
revoke all on function public.kapli_redeem_promo(text) from public, anon;
grant execute on function public.kapli_redeem_promo(text) to authenticated;

-- players who already used a code in the game (their save remembers it) cannot use it again
insert into public.kapli_promo_uses (user_id, promo_id)
select s.user_id, x.id from public.player_saves s
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(s.save_data -> 'promo') = 'array' then s.save_data -> 'promo' else '[]'::jsonb end) x(id)
where x.id in (select id from public.kapli_promo)
on conflict do nothing;

-- ---------- 3. error reports ----------
create table if not exists public.kapli_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  user_id uuid,
  device  text not null,
  ver     text,
  ua      text,
  place   text,
  msg     text not null,
  stack   text,
  n       integer not null default 1
);
create index if not exists kapli_errors_dev on public.kapli_errors (device, at desc);
create index if not exists kapli_errors_at on public.kapli_errors (at desc);
alter table public.kapli_errors enable row level security;
revoke all on table public.kapli_errors from anon, authenticated;

create or replace function public.kapli_err_report(p_device text, p_ver text, p_ua text, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare e jsonb; got integer; room integer; added integer := 0;
begin
  if p_device is null or p_device !~ '^[A-Za-z0-9_-]{8,64}$' or jsonb_typeof(p_items) <> 'array' then return 0; end if;
  select count(*) into got from public.kapli_errors where device = p_device and at > now() - interval '1 day';
  room := 30 - got; if room <= 0 then return 0; end if;
  for e in select x from jsonb_array_elements(p_items) t(x) limit least(room, 10) loop
    if jsonb_typeof(e -> 'm') = 'string' then
      insert into public.kapli_errors (user_id, device, ver, ua, place, msg, stack, n)
      values (auth.uid(), p_device, left(p_ver, 20), left(p_ua, 160), left(e ->> 'w', 40), left(e ->> 'm', 300), left(e ->> 's', 300),
              case when jsonb_typeof(e -> 'n') = 'number' then least(1000, greatest(1, (e ->> 'n')::numeric))::int else 1 end);
      added := added + 1;
    end if;
  end loop;
  return added;
end $$;
revoke all on function public.kapli_err_report(text, text, text, jsonb) from public;
grant execute on function public.kapli_err_report(text, text, text, jsonb) to anon, authenticated;

-- ---------- 4. the game version with the online mark ----------
alter table public.kapli_presence add column if not exists ver text;
create or replace function public.kapli_ping(p_ver text)
returns json language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  insert into public.kapli_presence (user_id, last_seen, ver) values (me, now(), left(p_ver, 20))
    on conflict (user_id) do update set last_seen = excluded.last_seen, ver = excluded.ver;
  return json_build_object(
    'requests', (select count(*) from public.kapli_friends f where f.status = 'pending' and f.requested_by <> me and me in (f.user_a, f.user_b)),
    'unread',   (select count(*) from public.kapli_dm d where d.recipient = me and d.read_at is null),
    'gifts',    (select count(*) from public.kapli_gifts g where g.recipient = me and g.claimed_at is null));
end $$;
revoke all on function public.kapli_ping(text) from public, anon;
grant execute on function public.kapli_ping(text) to authenticated;

commit;

-- ---------- useful queries (SQL Editor) ----------
-- the most frequent errors of the last 3 days:
--   select msg, place, count(distinct device) as devices, sum(n) as times, max(ver) as last_ver from public.kapli_errors
--   where at > now() - interval '3 days' group by msg, place order by devices desc, times desc limit 30;
-- who plays which version:
--   select p.nickname, pr.ver, pr.last_seen from public.kapli_presence pr join public.player_profiles p using (user_id) order by pr.last_seen desc;
-- who has which exclusive badge:
--   select p.nickname, g.badge from public.kapli_badge_grants g join public.player_profiles p using (user_id) order by 1, 2;
