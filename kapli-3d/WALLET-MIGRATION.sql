-- Kapli 3D 2.6: the coin wallet lives on the server (economy V1).
-- Needs SECURITY-MIGRATION.sql and FRIENDS-DM-MIGRATION.sql (already run). Run once in SQL Editor (running it again is safe).
--
-- How it works
--   * A signed-in player's balance is kept here. The game keeps a queue of coin operations (earned / spent), each with
--     its own id, and sends it with kapli_wallet_sync. An id is counted only once, so a queue sent twice (two phones,
--     a lost answer) changes nothing. Without a connection the queue waits on the phone.
--   * Earning: at most 20 000 in one operation and 100 000 a day (UTC). A fair day gives far less; an operation above a
--     limit is not counted and stays in the journal as refused.
--   * Spending: only from what is in the wallet; a purchase without enough coins is refused (it shows in the journal).
--   * The first sync creates the wallet from the coins on the phone «as is», but not more than the cloud save had
--     + 50 000 (a player who never saved to the cloud: not more than 50 000), and never more than 2 000 000.
--   * Promo codes and friends' gifts go to the wallet right on the server.
--   * Guests are not touched: they play and earn on the phone only.
-- For the owner (SQL Editor):
--   select * from public.kapli_wallet_of('nick');                    -- balance and the last 50 operations
--   select public.kapli_wallet_fix('nick', 5000, 'компенсация');     -- add (or take with a minus) coins by hand

begin;

create table if not exists public.kapli_wallet (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  coins      bigint not null default 0 check (coins >= 0),
  day        date not null default ((now() at time zone 'utc')::date),
  earned     bigint not null default 0,            -- earned on «day»
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.kapli_wallet_ops (
  user_id uuid not null references auth.users(id) on delete cascade,
  op      text not null,                           -- the id from the game, or promo:<id> / gift / init / fix
  kind    text not null check (kind in ('earn', 'spend', 'init', 'promo', 'gift', 'fix')),
  amount  bigint not null,
  src     text,
  ok      boolean not null default true,
  why     text,
  at      timestamptz not null default now(),
  primary key (user_id, op)
);
create index if not exists kapli_wallet_ops_at on public.kapli_wallet_ops (user_id, at desc);
alter table public.kapli_wallet enable row level security;
alter table public.kapli_wallet_ops enable row level security;
revoke all on table public.kapli_wallet, public.kapli_wallet_ops from anon, authenticated;

-- p_init: the coins on the phone (used only when the wallet does not exist yet)
-- p_ops: [{ "id": "...", "k": "e" | "s", "n": 120, "s": "round" }, ...] — up to 200 at a time
create or replace function public.kapli_wallet_sync(p_init bigint, p_ops jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); w public.kapli_wallet; o jsonb; id text; k text; n bigint; src text;
  done text[] := '{}'; bad text[] := '{}'; base bigint; start bigint; today date := (now() at time zone 'utc')::date;
begin
  if uid is null then return json_build_object('err', 'auth'); end if;
  select * into w from public.kapli_wallet where user_id = uid for update;
  if w.user_id is null then
    select case when jsonb_typeof(s.save_data -> 'coins') = 'number' then greatest(0, floor((s.save_data ->> 'coins')::numeric))::bigint end
      into base from public.player_saves s where s.user_id = uid;
    start := least(greatest(coalesce(p_init, 0), 0), coalesce(base, 0) + 50000, 2000000);
    insert into public.kapli_wallet (user_id, coins) values (uid, start) on conflict (user_id) do nothing;
    insert into public.kapli_wallet_ops (user_id, op, kind, amount, src, why)
      values (uid, 'init', 'init', start, 'phone', case when start < coalesce(p_init, 0) then 'phone had ' || p_init end) on conflict do nothing;
    select * into w from public.kapli_wallet where user_id = uid for update;
  end if;
  if w.day <> today then w.day := today; w.earned := 0; end if;
  if jsonb_typeof(p_ops) = 'array' then
    for o in select x from jsonb_array_elements(p_ops) t(x) limit 200 loop
      id := o ->> 'id'; k := o ->> 'k'; src := left(coalesce(o ->> 's', ''), 24);
      if id is null or id !~ '^[A-Za-z0-9_-]{4,40}$' or k not in ('e', 's') or jsonb_typeof(o -> 'n') <> 'number' then continue; end if;
      n := floor((o ->> 'n')::numeric);
      if exists (select 1 from public.kapli_wallet_ops where user_id = uid and op = id) then
        if exists (select 1 from public.kapli_wallet_ops where user_id = uid and op = id and ok) then done := done || id; else bad := bad || id; end if;
        continue;
      end if;
      if k = 'e' then
        if n < 1 or n > 20000 then
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, false, 'one op limit'); bad := bad || id;
        elsif w.earned + n > 100000 then
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, false, 'day limit'); bad := bad || id;
        else
          w.coins := w.coins + n; w.earned := w.earned + n;
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, true, null); done := done || id;
        end if;
      else
        if n < 1 or n > 10000000 or w.coins < n then
          insert into public.kapli_wallet_ops values (uid, id, 'spend', n, src, false, 'not enough: ' || w.coins); bad := bad || id;
        else
          w.coins := w.coins - n;
          insert into public.kapli_wallet_ops values (uid, id, 'spend', n, src, true, null); done := done || id;
        end if;
      end if;
    end loop;
  end if;
  update public.kapli_wallet set coins = w.coins, day = w.day, earned = w.earned, updated_at = now() where user_id = uid;
  return json_build_object('coins', w.coins, 'done', to_json(done), 'bad', to_json(bad));
end $$;
revoke all on function public.kapli_wallet_sync(bigint, jsonb) from public, anon;
grant execute on function public.kapli_wallet_sync(bigint, jsonb) to authenticated;

-- promo codes: the coins go to the wallet (if the wallet is not made yet, they come with the phone's coins at the first sync)
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
  if coalesce(pr.coins, 0) > 0 and exists (select 1 from public.kapli_wallet where user_id = uid) then
    update public.kapli_wallet set coins = coins + pr.coins, updated_at = now() where user_id = uid;
    insert into public.kapli_wallet_ops (user_id, op, kind, amount, src) values (uid, 'promo:' || pr.id, 'promo', pr.coins, pr.id) on conflict do nothing;
  end if;
  return json_build_object('ok', true, 'id', pr.id, 'kind', pr.kind, 'coins', pr.coins, 'badge', pr.badge, 'wallet', exists (select 1 from public.kapli_wallet where user_id = uid));
end $$;
revoke all on function public.kapli_redeem_promo(text) from public, anon;
grant execute on function public.kapli_redeem_promo(text) to authenticated;

-- friends' gifts: as before, plus the coins go to the wallet
create or replace function public.kapli_gifts_claim()
returns table (nickname text, amount integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  room integer;
  got bigint;
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
  -- now() is the same within this call, so these are exactly the gifts just claimed
  select sum(g.amount) into got from public.kapli_gifts g where g.recipient = me and g.claimed_at = now();
  if got > 0 then
    update public.kapli_wallet set coins = coins + got, updated_at = now() where user_id = me;
    if found then insert into public.kapli_wallet_ops (user_id, op, kind, amount, src)
      values (me, 'gift:' || extract(epoch from now())::bigint, 'gift', got, 'friends') on conflict do nothing; end if;
  end if;
end;
$$;
revoke all on function public.kapli_gifts_claim() from public, anon;
grant execute on function public.kapli_gifts_claim() to authenticated;

-- for the owner (SQL Editor only)
create or replace function public.kapli_wallet_of(p_nick text)
returns table (coins bigint, earned_today bigint, op text, kind text, amount bigint, src text, ok boolean, why text, at timestamptz)
language sql stable security definer set search_path = '' as $$
  select w.coins, case when w.day = (now() at time zone 'utc')::date then w.earned else 0 end, o.op, o.kind, o.amount, o.src, o.ok, o.why, o.at
  from public.player_profiles p join public.kapli_wallet w on w.user_id = p.user_id
  left join lateral (select * from public.kapli_wallet_ops x where x.user_id = p.user_id order by x.at desc limit 50) o on true
  where p.nickname = p_nick order by o.at desc
$$;
create or replace function public.kapli_wallet_fix(p_nick text, p_amount bigint, p_why text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid; c bigint;
begin
  select user_id into uid from public.player_profiles where nickname = p_nick; if uid is null then return 'no such player'; end if;
  update public.kapli_wallet set coins = greatest(0, coins + p_amount), updated_at = now() where user_id = uid returning coins into c;
  if c is null then return 'no wallet yet (the player has not opened 2.6 signed in)'; end if;
  insert into public.kapli_wallet_ops (user_id, op, kind, amount, src, why) values (uid, 'fix:' || clock_timestamp(), 'fix', p_amount, 'owner', p_why);
  return 'coins now ' || c;
end $$;
revoke all on function public.kapli_wallet_of(text), public.kapli_wallet_fix(text, bigint, text) from public, anon, authenticated;

commit;
