-- Kapli 3D 2.7.15: ▲ / ▼ in the rating are the same for everyone — how many places a player moved today (since 00:00 Moscow time).
-- Needs 07 (modes for two), 10 (records «на проверке») and 13 (coins rating), already run.
-- Run once in SQL Editor (running it again is safe).
--   * once a day the server remembers the places of every rating (the first time anyone opens that rating after 00:00 Moscow time —
--     no scheduler needed); kapli_rank_moves(key) returns those remembered places, the game compares them with the places now;
--   * keys: a record mode ('classic', 'timed', 'hardcore', …), 'coins', 'territory', 'duoback0' / 'duoback1' / 'duoback2' (difficulty);
--   * a player is a nickname, a pair of «Спина к спине» is 'nick+mate'; records «на проверке» are not counted (nobody sees them in the rating);
--   * up to 200 places of each rating are remembered; nothing else is stored.

begin;

create table if not exists public.kapli_rank_snap (
  key text not null, id text not null, place integer not null,
  primary key (key, id));
create table if not exists public.kapli_rank_snap_day (
  key text primary key, day date not null);
alter table public.kapli_rank_snap enable row level security;
alter table public.kapli_rank_snap_day enable row level security;
revoke all on table public.kapli_rank_snap, public.kapli_rank_snap_day from public, anon, authenticated;

create or replace function public.kapli_rank_moves(p_key text)
returns table(id text, place integer)
language plpgsql volatile security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Moscow')::date; snap_d date; lb boolean;
begin
  if p_key is null or p_key !~ '^([a-z_]{2,24}|duoback[0-2])$' then return; end if;
  select s.day into snap_d from public.kapli_rank_snap_day s where s.key = p_key;
  if snap_d is null or snap_d < d then
    perform pg_advisory_xact_lock(hashtext('kapli_rank_snap:' || p_key));
    select s.day into snap_d from public.kapli_rank_snap_day s where s.key = p_key;   -- someone may have just taken it
    if snap_d is null or snap_d < d then
      delete from public.kapli_rank_snap s where s.key = p_key;
      if p_key = 'coins' then
        insert into public.kapli_rank_snap (key, id, place)
        select p_key, x.nickname, x.place from (
          select p.nickname::text as nickname, (rank() over (order by w.total desc))::int as place
          from public.kapli_wallet w join public.player_profiles p on p.user_id = w.user_id where w.total > 0) x
        order by x.place limit 200 on conflict do nothing;
      elsif p_key = 'territory' then
        insert into public.kapli_rank_snap (key, id, place)
        select p_key, x.nickname, x.place from (
          select p.nickname::text as nickname, (row_number() over (order by t.wins desc, t.best_share desc, t.last_at asc))::int as place
          from public.kapli_duo_territory t join public.player_profiles p on p.user_id = t.user_id where t.wins > 0) x
        order by x.place limit 200 on conflict do nothing;
      elsif p_key like 'duoback_' then
        insert into public.kapli_rank_snap (key, id, place)
        select p_key, x.pid, x.place from (
          select p.nickname::text || '+' || coalesce(m.nickname::text, 'Гость') as pid,
                 (row_number() over (order by b.waves desc, b.time_s asc, b.created_at asc))::int as place
          from (select distinct on (least(c.user_id::text, coalesce(c.mate_user::text, '-')), greatest(c.user_id::text, coalesce(c.mate_user::text, '-')))
                       c.user_id, c.mate_user, c.waves, c.time_s, c.created_at
                from public.kapli_duo_coop c
                where c.diff = right(p_key, 1)::int and c.waves > 0
                order by least(c.user_id::text, coalesce(c.mate_user::text, '-')), greatest(c.user_id::text, coalesce(c.mate_user::text, '-')), c.waves desc, c.time_s asc, c.created_at asc) b
          join public.player_profiles p on p.user_id = b.user_id
          left join public.player_profiles m on m.user_id = b.mate_user) x
        order by x.place limit 200 on conflict do nothing;
      else
        select coalesce((select r.lower_better from public.kapli_mode_rule(p_key) r), false) into lb;
        insert into public.kapli_rank_snap (key, id, place)
        select p_key, x.nickname, x.place from (
          select p.nickname::text as nickname,
                 (rank() over (order by case when lb then k.score else -k.score end, k.updated_at))::int as place
          from public.kapli_records k join public.player_profiles p on p.user_id = k.user_id
          where k.mode = p_key and not k.held) x
        order by x.place limit 200 on conflict do nothing;
      end if;
      insert into public.kapli_rank_snap_day (key, day) values (p_key, d)
      on conflict (key) do update set day = excluded.day;
    end if;
  end if;
  return query select s.id, s.place from public.kapli_rank_snap s where s.key = p_key;
end $$;

revoke all on function public.kapli_rank_moves(text) from public;
grant execute on function public.kapli_rank_moves(text) to anon, authenticated;

commit;

-- check: should print a list (maybe empty) without an error
-- select * from public.kapli_rank_moves('classic') limit 5;
