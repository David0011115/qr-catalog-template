-- Kapli 3D 2.5: records of the modes for two, visible to everyone in «Рейтинг».
-- Run once in Supabase SQL Editor (it can be run again safely). Nothing existing is changed.
--
-- «Захват территории»: every player sends the result of their own match (win / loss / draw and their share of the field).
--   The table keeps one row per player: wins, losses, draws, best share. Rating: most wins, then the best share.
-- «Спина к спине»: the phone that ran the run (the room's creator) sends one row for the pair:
--   difficulty, waves, time, bosses, bots, comebacks, and the partner's public ID (the server looks up the nickname itself).
--   Rating per difficulty: the best run of each pair — most waves, then the shortest time.
-- The tables are closed; the game reads and writes them only through the functions below, which check that the numbers
-- are plausible and accept at most one result a minute from one player.

begin;

create table if not exists public.kapli_duo_territory (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  wins       integer  not null default 0,
  losses     integer  not null default 0,
  draws      integer  not null default 0,
  best_share smallint not null default 0,
  last_at    timestamptz
);

create table if not exists public.kapli_duo_coop (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,   -- who ran the run (the room's creator)
  mate_user  uuid references auth.users(id) on delete set null,          -- the partner, when signed in
  diff       smallint not null check (diff between 0 and 2),
  waves      integer  not null check (waves between 0 and 500),
  time_s     integer  not null check (time_s between 0 and 36000),
  bosses     integer  not null default 0,
  bots       integer  not null default 0,
  respawns   integer  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists kapli_duo_coop_rank on public.kapli_duo_coop (diff, waves desc, time_s asc);
create index if not exists kapli_duo_coop_user on public.kapli_duo_coop (user_id, created_at desc);

alter table public.kapli_duo_territory enable row level security;
alter table public.kapli_duo_coop enable row level security;
revoke all on table public.kapli_duo_territory from anon, authenticated;
revoke all on table public.kapli_duo_coop from anon, authenticated;

-- ---------- «Захват территории»: send a result ----------
create or replace function public.kapli_duo_territory_submit(p_result text, p_share integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prev timestamptz;
begin
  if uid is null then return false; end if;
  if p_result not in ('win', 'loss', 'draw') or p_share is null or p_share < 0 or p_share > 100 then return false; end if;
  -- the share has to match the result: a win is more than half of the field, a loss less, a draw within ±2%
  if (p_result = 'win' and p_share < 51) or (p_result = 'loss' and p_share > 49) or (p_result = 'draw' and (p_share < 48 or p_share > 52)) then return false; end if;
  select last_at into prev from public.kapli_duo_territory where user_id = uid;
  if prev is not null and prev > now() - interval '40 seconds' then return false; end if;   -- a match lasts longer than that
  insert into public.kapli_duo_territory as t (user_id, wins, losses, draws, best_share, last_at)
  values (uid, (p_result = 'win')::int, (p_result = 'loss')::int, (p_result = 'draw')::int, p_share, now())
  on conflict (user_id) do update set
    wins = t.wins + (p_result = 'win')::int,
    losses = t.losses + (p_result = 'loss')::int,
    draws = t.draws + (p_result = 'draw')::int,
    best_share = greatest(t.best_share, p_share),
    last_at = now();
  return true;
end;
$$;

-- ---------- «Спина к спине»: send a run ----------
create or replace function public.kapli_duo_coop_submit(p_diff integer, p_mate_pid bigint, p_waves integer, p_time integer, p_bosses integer, p_bots integer, p_respawns integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  mate uuid;
  prev timestamptz;
begin
  if uid is null then return false; end if;
  if p_diff not between 0 and 2 or p_waves not between 0 and 500 or p_time not between 1 and 36000 then return false; end if;
  -- plausibility: a wave takes at least 12 s (fight and break), bosses at most 5 per wave, numbers never negative
  if p_waves * 12 > p_time then return false; end if;
  if coalesce(p_bosses, 0) not between 0 and p_waves * 5 + 5 or coalesce(p_bots, 0) not between 0 and p_time * 3 or coalesce(p_respawns, 0) not between 0 and p_time / 4 + 1 then return false; end if;
  select max(created_at) into prev from public.kapli_duo_coop where user_id = uid;
  if prev is not null and prev > now() - interval '60 seconds' then return false; end if;
  if p_mate_pid is not null then
    select user_id into mate from public.player_profiles where public_id = p_mate_pid;
    if mate = uid then mate := null; end if;
  end if;
  insert into public.kapli_duo_coop (user_id, mate_user, diff, waves, time_s, bosses, bots, respawns)
  values (uid, mate, p_diff, p_waves, p_time, coalesce(p_bosses, 0), coalesce(p_bots, 0), coalesce(p_respawns, 0));
  return true;
end;
$$;

-- ---------- ratings ----------
create or replace function public.kapli_duo_territory_top(p_limit integer default 20)
returns table (place bigint, nickname text, wins integer, games integer, best_share smallint, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select row_number() over (order by t.wins desc, t.best_share desc, t.last_at asc) as place,
         p.nickname::text, t.wins, t.wins + t.losses + t.draws as games, t.best_share, t.user_id = auth.uid() as is_me
  from public.kapli_duo_territory t
  join public.player_profiles p on p.user_id = t.user_id
  where t.wins > 0
  order by t.wins desc, t.best_share desc, t.last_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create or replace function public.kapli_duo_territory_me()
returns table (place bigint, total bigint, wins integer, games integer, best_share smallint)
language sql
stable
security definer
set search_path = ''
as $$
  with r as (
    select t.user_id, t.wins, t.wins + t.losses + t.draws as games, t.best_share,
           row_number() over (order by t.wins desc, t.best_share desc, t.last_at asc) as place, count(*) over () as total
    from public.kapli_duo_territory t where t.wins > 0
  )
  select r.place, r.total, r.wins, r.games, r.best_share from r where r.user_id = auth.uid();
$$;

create or replace function public.kapli_duo_coop_top(p_diff integer, p_limit integer default 20)
returns table (place bigint, nickname text, mate_nickname text, waves integer, time_s integer, bosses integer, bots integer, respawns integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with best as (   -- the best run of each pair (a pair is the same two players in any order)
    select distinct on (least(c.user_id::text, coalesce(c.mate_user::text, '-')), greatest(c.user_id::text, coalesce(c.mate_user::text, '-')))
           c.user_id, c.mate_user, c.waves, c.time_s, c.bosses, c.bots, c.respawns, c.created_at
    from public.kapli_duo_coop c
    where c.diff = p_diff and c.waves > 0
    order by least(c.user_id::text, coalesce(c.mate_user::text, '-')), greatest(c.user_id::text, coalesce(c.mate_user::text, '-')), c.waves desc, c.time_s asc, c.created_at asc
  )
  select row_number() over (order by b.waves desc, b.time_s asc, b.created_at asc) as place,
         p.nickname::text, coalesce(m.nickname::text, 'Гость'), b.waves, b.time_s, b.bosses, b.bots, b.respawns,
         (b.user_id = auth.uid() or b.mate_user = auth.uid()) as is_me
  from best b
  join public.player_profiles p on p.user_id = b.user_id
  left join public.player_profiles m on m.user_id = b.mate_user
  order by b.waves desc, b.time_s asc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.kapli_duo_territory_submit(text, integer) from public, anon;
revoke all on function public.kapli_duo_coop_submit(integer, bigint, integer, integer, integer, integer, integer) from public, anon;
grant execute on function public.kapli_duo_territory_submit(text, integer) to authenticated;
grant execute on function public.kapli_duo_coop_submit(integer, bigint, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.kapli_duo_territory_top(integer) to anon, authenticated;
grant execute on function public.kapli_duo_territory_me() to authenticated;
grant execute on function public.kapli_duo_coop_top(integer, integer) to anon, authenticated;

commit;

-- Check after running (should return two empty tables, no errors):
-- select * from public.kapli_duo_territory_top(5);
-- select * from public.kapli_duo_coop_top(0, 5);
