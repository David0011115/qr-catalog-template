-- Friends, private messages, block list, reports, daily gifts and online status for Kapli 3D.
-- Run once in the Supabase SQL Editor before the updated game code is deployed (safe to run again).
--
-- Rules enforced here, on the server:
--   * friends: request -> the other player accepts or declines; up to 200 friends, 30 open outgoing requests;
--   * private messages: only between accepted friends, 1..300 characters, at most 1 per second and 500 per day;
--   * block list: a block removes the friendship and stops requests, messages and gifts both ways;
--   * reports: only the recipient can report a message; reports land in public.kapli_dm_reports;
--   * gifts: one gift (100 coins) per friend per day; a player can claim at most 5 gifts per day;
--   * online: the game pings every minute while open; "online" = a ping in the last 2 minutes.
-- Tables are closed to direct access (RLS without policies) except reading your own messages,
-- which the realtime feed needs. Everything else goes through the security definer functions below.

begin;

-- ---------- tables ----------
create table if not exists public.kapli_friends (
  user_a uuid not null references auth.users (id) on delete cascade,
  user_b uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists kapli_friends_b_idx on public.kapli_friends (user_b);

create table if not exists public.kapli_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists kapli_blocks_blocked_idx on public.kapli_blocks (blocked);

create table if not exists public.kapli_dm (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender <> recipient)
);
create index if not exists kapli_dm_pair_idx on public.kapli_dm (least(sender, recipient), greatest(sender, recipient), id desc);
create index if not exists kapli_dm_unread_idx on public.kapli_dm (recipient) where read_at is null;
create index if not exists kapli_dm_sender_idx on public.kapli_dm (sender, created_at desc);

create table if not exists public.kapli_dm_reports (
  message_id bigint not null references public.kapli_dm (id) on delete cascade,
  reporter uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, reporter)
);

create table if not exists public.kapli_gifts (
  id bigint generated always as identity primary key,
  sender uuid not null references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  amount integer not null default 100 check (amount between 1 and 1000),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  unique (sender, recipient, day)
);
create index if not exists kapli_gifts_open_idx on public.kapli_gifts (recipient) where claimed_at is null;

create table if not exists public.kapli_presence (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now()
);

alter table public.kapli_friends enable row level security;
alter table public.kapli_blocks enable row level security;
alter table public.kapli_dm enable row level security;
alter table public.kapli_dm_reports enable row level security;
alter table public.kapli_gifts enable row level security;
alter table public.kapli_presence enable row level security;

-- the realtime feed of new messages: each player may read only their own conversations
revoke all on public.kapli_friends, public.kapli_blocks, public.kapli_dm, public.kapli_dm_reports, public.kapli_gifts, public.kapli_presence from anon, authenticated;
grant select on public.kapli_dm to authenticated;
drop policy if exists kapli_dm_read_own on public.kapli_dm;
create policy kapli_dm_read_own on public.kapli_dm for select to authenticated
  using ((select auth.uid()) in (sender, recipient));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'kapli_dm') then
    alter publication supabase_realtime add table public.kapli_dm;
  end if;
end;
$$;

-- ---------- helpers (internal, not callable by players) ----------
-- a player by nickname (case-insensitive) or by public ID ("42" or "000042")
create or replace function public.kapli_find_player(p_query text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  q text := btrim(coalesce(p_query, ''));
  uid uuid;
begin
  if q = '' then return null; end if;
  select p.user_id into uid from public.player_profiles p where lower(p.nickname) = lower(q) limit 1;
  if uid is null and q ~ '^[0-9]{1,12}$' then
    select p.user_id into uid from public.player_profiles p where p.public_id = q::bigint limit 1;
  end if;
  return uid;
end;
$$;

create or replace function public.kapli_is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.kapli_blocks where (blocker = a and blocked = b) or (blocker = b and blocked = a));
$$;

create or replace function public.kapli_are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.kapli_friends where user_a = least(a, b) and user_b = greatest(a, b) and status = 'accepted');
$$;

revoke all on function public.kapli_find_player(text), public.kapli_is_blocked(uuid, uuid), public.kapli_are_friends(uuid, uuid) from public, anon, authenticated;

-- ---------- online status + counters (called every minute while the game is open) ----------
create or replace function public.kapli_ping()
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_signed_in'; end if;
  insert into public.kapli_presence (user_id, last_seen) values (me, now())
    on conflict (user_id) do update set last_seen = excluded.last_seen;
  return json_build_object(
    'requests', (select count(*) from public.kapli_friends f where f.status = 'pending' and f.requested_by <> me and me in (f.user_a, f.user_b)),
    'unread',   (select count(*) from public.kapli_dm d where d.recipient = me and d.read_at is null),
    'gifts',    (select count(*) from public.kapli_gifts g where g.recipient = me and g.claimed_at is null));
end;
$$;

-- ---------- friends ----------
create or replace function public.kapli_friends()
returns table (nickname text, public_id bigint, status text, online boolean, last_seen timestamptz, unread integer, gift_sent boolean, last_msg timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select auth.uid() as id),
  rel as (
    select case when f.user_a = me.id then f.user_b else f.user_a end as other,
           case when f.status = 'accepted' then 'friend' when f.requested_by = me.id then 'outgoing' else 'incoming' end as st,
           coalesce(f.accepted_at, f.created_at) as since
    from public.kapli_friends f, me
    where me.id in (f.user_a, f.user_b)
  )
  select p.nickname::text, p.public_id, rel.st,
         coalesce(pr.last_seen > now() - interval '2 minutes', false),
         pr.last_seen,
         (select count(*)::int from public.kapli_dm d, me where d.sender = rel.other and d.recipient = me.id and d.read_at is null),
         exists (select 1 from public.kapli_gifts g, me where g.sender = me.id and g.recipient = rel.other and g.day = (now() at time zone 'utc')::date),
         (select max(d.created_at) from public.kapli_dm d, me where (d.sender = rel.other and d.recipient = me.id) or (d.sender = me.id and d.recipient = rel.other))
  from rel
  join public.player_profiles p on p.user_id = rel.other
  left join public.kapli_presence pr on pr.user_id = rel.other
  order by (rel.st = 'incoming') desc, 6 desc, 8 desc nulls last, 4 desc, lower(p.nickname);
$$;

-- returns: sent | accepted | already | pending | self | not_found | unavailable | limit
create or replace function public.kapli_friend_request(p_query text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  row public.kapli_friends;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  other := public.kapli_find_player(p_query);
  if other is null then return 'not_found'; end if;
  if other = me then return 'self'; end if;
  if public.kapli_is_blocked(me, other) then return 'unavailable'; end if;
  select * into row from public.kapli_friends where user_a = least(me, other) and user_b = greatest(me, other) for update;
  if found then
    if row.status = 'accepted' then return 'already'; end if;
    if row.requested_by = me then return 'pending'; end if;
    update public.kapli_friends set status = 'accepted', accepted_at = now() where user_a = row.user_a and user_b = row.user_b;   -- they asked first: accept
    return 'accepted';
  end if;
  if (select count(*) from public.kapli_friends f where f.status = 'pending' and f.requested_by = me) >= 30
     or (select count(*) from public.kapli_friends f where f.status = 'accepted' and me in (f.user_a, f.user_b)) >= 200 then
    return 'limit';
  end if;
  insert into public.kapli_friends (user_a, user_b, requested_by) values (least(me, other), greatest(me, other), me);
  return 'sent';
end;
$$;

-- accept or decline an incoming request; returns: accepted | declined | none
create or replace function public.kapli_friend_respond(p_nick text, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if other is null then return 'none'; end if;
  if p_accept then
    if public.kapli_friends_count_ok(me) is false then return 'limit'; end if;
    update public.kapli_friends set status = 'accepted', accepted_at = now()
      where user_a = least(me, other) and user_b = greatest(me, other) and status = 'pending' and requested_by = other;
    return case when found then 'accepted' else 'none' end;
  end if;
  delete from public.kapli_friends where user_a = least(me, other) and user_b = greatest(me, other) and status = 'pending' and requested_by = other;
  return case when found then 'declined' else 'none' end;
end;
$$;

create or replace function public.kapli_friends_count_ok(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select count(*) from public.kapli_friends f where f.status = 'accepted' and p_user in (f.user_a, f.user_b)) < 200;
$$;
revoke all on function public.kapli_friends_count_ok(uuid) from public, anon, authenticated;

-- remove a friend, or cancel your own request; returns: removed | none
create or replace function public.kapli_friend_remove(p_nick text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
begin
  if me is null then raise exception 'not_signed_in'; end if;
  delete from public.kapli_friends where user_a = least(me, other) and user_b = greatest(me, other);
  return case when found then 'removed' else 'none' end;
end;
$$;

-- ---------- block list ----------
create or replace function public.kapli_block(p_nick text, p_on boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if other is null then return 'not_found'; end if;
  if other = me then return 'self'; end if;
  if p_on then
    insert into public.kapli_blocks (blocker, blocked) values (me, other) on conflict do nothing;
    delete from public.kapli_friends where user_a = least(me, other) and user_b = greatest(me, other);
    return 'blocked';
  end if;
  delete from public.kapli_blocks where blocker = me and blocked = other;
  return 'unblocked';
end;
$$;

create or replace function public.kapli_blocks()
returns table (nickname text, public_id bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nickname::text, p.public_id from public.kapli_blocks b join public.player_profiles p on p.user_id = b.blocked
  where b.blocker = auth.uid() order by b.created_at desc;
$$;

-- ---------- private messages ----------
-- returns the stored message; errors: not_friends | too_fast | daily_limit | empty
create or replace function public.kapli_dm_send(p_nick text, p_body text)
returns table (id bigint, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
  t text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if t = '' then raise exception 'empty'; end if;
  if other is null or not public.kapli_are_friends(me, other) or public.kapli_is_blocked(me, other) then raise exception 'not_friends'; end if;
  if exists (select 1 from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 second') then raise exception 'too_fast'; end if;
  if (select count(*) from public.kapli_dm d where d.sender = me and d.created_at > now() - interval '1 day') >= 500 then raise exception 'daily_limit'; end if;
  return query insert into public.kapli_dm (sender, recipient, body) values (me, other, left(t, 300)) returning kapli_dm.id, kapli_dm.created_at;
end;
$$;

-- one conversation, newest first (p_after: only messages after this id, for polling)
create or replace function public.kapli_dm_history(p_nick text, p_after bigint default null, p_limit integer default 60)
returns table (id bigint, mine boolean, body text, created_at timestamptz, read_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.sender = auth.uid(), d.body, d.created_at, d.read_at
  from public.kapli_dm d
  where least(d.sender, d.recipient) = least(auth.uid(), public.kapli_find_player(p_nick))
    and greatest(d.sender, d.recipient) = greatest(auth.uid(), public.kapli_find_player(p_nick))
    and (p_after is null or d.id > p_after)
  order by d.id desc
  limit least(greatest(coalesce(p_limit, 60), 1), 100);
$$;

create or replace function public.kapli_dm_read(p_nick text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.kapli_dm set read_at = now()
    where recipient = auth.uid() and sender = public.kapli_find_player(p_nick) and read_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.kapli_dm_report(p_message bigint)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  if not exists (select 1 from public.kapli_dm d where d.id = p_message and d.recipient = auth.uid()) then return 'none'; end if;
  insert into public.kapli_dm_reports (message_id, reporter) values (p_message, auth.uid()) on conflict do nothing;
  return 'reported';
end;
$$;

-- ---------- gifts ----------
-- returns: sent | already | not_friends
create or replace function public.kapli_gift_send(p_nick text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid := public.kapli_find_player(p_nick);
begin
  if me is null then raise exception 'not_signed_in'; end if;
  if other is null or not public.kapli_are_friends(me, other) or public.kapli_is_blocked(me, other) then return 'not_friends'; end if;
  insert into public.kapli_gifts (sender, recipient) values (me, other) on conflict (sender, recipient, day) do nothing;
  return case when found then 'sent' else 'already' end;
end;
$$;

-- claims waiting gifts (at most 5 per UTC day); the game adds the coins to the save
create or replace function public.kapli_gifts_claim()
returns table (nickname text, amount integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  room integer;
begin
  if me is null then raise exception 'not_signed_in'; end if;
  room := 5 - (select count(*) from public.kapli_gifts g where g.recipient = me and g.claimed_at >= ((now() at time zone 'utc')::date)::timestamp at time zone 'utc');
  if room <= 0 then return; end if;
  return query
    with picked as (
      select g.id from public.kapli_gifts g where g.recipient = me and g.claimed_at is null order by g.id limit room for update skip locked
    ), done as (
      update public.kapli_gifts g set claimed_at = now() from picked where g.id = picked.id returning g.sender, g.amount
    )
    select coalesce(p.nickname::text, '?'), done.amount from done left join public.player_profiles p on p.user_id = done.sender;
end;
$$;

-- ---------- who may call what ----------
revoke all on function public.kapli_ping(), public.kapli_friends(), public.kapli_friend_request(text), public.kapli_friend_respond(text, boolean),
  public.kapli_friend_remove(text), public.kapli_block(text, boolean), public.kapli_blocks(), public.kapli_dm_send(text, text),
  public.kapli_dm_history(text, bigint, integer), public.kapli_dm_read(text), public.kapli_dm_report(bigint),
  public.kapli_gift_send(text), public.kapli_gifts_claim() from public, anon;
grant execute on function public.kapli_ping(), public.kapli_friends(), public.kapli_friend_request(text), public.kapli_friend_respond(text, boolean),
  public.kapli_friend_remove(text), public.kapli_block(text, boolean), public.kapli_blocks(), public.kapli_dm_send(text, text),
  public.kapli_dm_history(text, bigint, integer), public.kapli_dm_read(text), public.kapli_dm_report(bigint),
  public.kapli_gift_send(text), public.kapli_gifts_claim() to authenticated;

commit;

-- Moderation: reported private messages, newest first
-- select r.created_at, rp.nickname as reporter, sp.nickname as sender, d.body
-- from public.kapli_dm_reports r join public.kapli_dm d on d.id = r.message_id
-- join public.player_profiles rp on rp.user_id = r.reporter join public.player_profiles sp on sp.user_id = d.sender
-- order by r.created_at desc;
