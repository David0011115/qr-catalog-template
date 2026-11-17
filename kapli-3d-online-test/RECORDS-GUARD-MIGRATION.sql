-- Kapli 3D 2.6: suspicious records wait for the owner's look before they appear in the rating.
-- Run once in Supabase SQL Editor (running it again is safe).
--
-- A record is held back («на проверке») when it is
--   * more than 3 times the player's own previous record in the mode (and above a small floor), or
--   * a first record that is already far above anything a fair round gives (see the «first» column below).
-- A held record is not shown to others; its owner still sees it as their own. The owner of the game reviews them:
--   select * from public.kapli_records_held();                       -- the list
--   select public.kapli_record_review('nick', 'classic', true);     -- show it
--   select public.kapli_record_review('nick', 'classic', false);    -- delete it
-- The upper limits of the mass modes come down from 2 000 000 to 400 000 (the best real record now is about 40 000).

begin;

alter table public.kapli_records add column if not exists held boolean not null default false;
alter table public.kapli_records add column if not exists prev_score bigint;

create or replace function public.kapli_mode_rule_v1(p_mode text, out lower_better boolean, out lo bigint, out hi bigint)
returns record language sql immutable as $function$
  select r.lb, r.lo, r.hi from (values
    ('classic',  false, 1, 400000), ('timed',   false, 1, 400000), ('hardcore', false, 1, 400000),
    ('royale',   false, 1, 400000), ('survival', false, 1, 36000),  ('crown',    false, 1, 36000),
    ('team',     false, 1, 100000),  ('race',    true,  20, 3600)
  ) as r(m, lb, lo, hi) where r.m = p_mode
$function$;

-- how high a first record may be before it is held: mass for the mass modes, seconds for survival and crown
create or replace function public.kapli_first_limit(p_mode text)
returns bigint language sql immutable as $$
  select case when p_mode in ('survival', 'crown') then 3600 else 120000 end
$$;

create or replace function public.kapli_submit_record(p_mode text, p_score bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; uid uuid := auth.uid(); old public.kapli_records; base text := case when p_mode = 'rbuild' then 'classic' else p_mode end; suspicious boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into r from kapli_mode_rule(p_mode);
  if r.lo is null then raise exception 'bad_mode' using errcode = 'P0001'; end if;
  if p_score is null or p_score < r.lo or p_score > r.hi then raise exception 'bad_score' using errcode = 'P0001'; end if;
  select * into old from kapli_records where user_id = uid and mode = p_mode;
  if old.user_id is not null and ((r.lower_better and p_score >= old.score) or (not r.lower_better and p_score <= old.score)) then return; end if;   -- not better
  suspicious := not r.lower_better and (
    (old.user_id is not null and not old.held and p_score > old.score * 3 and p_score > kapli_first_limit(base) / 10)
    or (old.user_id is null and p_score > kapli_first_limit(base)));
  insert into kapli_records(user_id, mode, score, updated_at, held, prev_score)
  values (uid, p_mode, p_score, now(), suspicious, old.score)
  on conflict (user_id, mode) do update set score = excluded.score, updated_at = now(),
    held = excluded.held or kapli_records.held, prev_score = case when kapli_records.held then kapli_records.prev_score else kapli_records.score end;
end $function$;

create or replace function public.kapli_leaderboard(p_mode text, p_limit integer default 20)
returns table(place bigint, nickname text, score bigint, is_me boolean)
language sql stable security definer set search_path to 'public'
as $function$
  with r as (select * from kapli_mode_rule(p_mode)),
  ranked as (
    select rank() over (order by case when (select lower_better from r) then k.score else -k.score end, k.updated_at) as place,
           p.nickname, k.score, k.user_id = auth.uid() as is_me
    from kapli_records k join player_profiles p on p.user_id = k.user_id
    where k.mode = p_mode and (not k.held or k.user_id = auth.uid())
  )
  select place, nickname, score, is_me from ranked order by place limit least(greatest(p_limit, 1), 50)
$function$;

create or replace function public.kapli_my_place(p_mode text)
returns table(place bigint, score bigint, total bigint)
language sql stable security definer set search_path to 'public'
as $function$
  with r as (select * from kapli_mode_rule(p_mode)),
  ranked as (
    select k.user_id, k.score,
           rank() over (order by case when (select lower_better from r) then k.score else -k.score end, k.updated_at) as place
    from kapli_records k where k.mode = p_mode and (not k.held or k.user_id = auth.uid())
  )
  select place, score, (select count(*) from ranked) from ranked where user_id = auth.uid()
$function$;

-- for the owner (SQL Editor only)
create or replace function public.kapli_records_held()
returns table(nickname text, mode text, score bigint, prev_score bigint, at timestamptz)
language sql stable security definer set search_path to 'public'
as $$ select p.nickname, k.mode, k.score, k.prev_score, k.updated_at from kapli_records k join player_profiles p using (user_id) where k.held order by k.updated_at desc $$;

create or replace function public.kapli_record_review(p_nick text, p_mode text, p_ok boolean)
returns text language plpgsql security definer set search_path to 'public'
as $$
declare uid uuid;
begin
  select user_id into uid from player_profiles where nickname = p_nick; if uid is null then return 'no such player'; end if;
  if p_ok then update kapli_records set held = false where user_id = uid and mode = p_mode; return 'shown';
  else delete from kapli_records where user_id = uid and mode = p_mode and held; return 'deleted'; end if;
end $$;

revoke all on function public.kapli_records_held(), public.kapli_record_review(text, text, boolean), public.kapli_first_limit(text) from public, anon, authenticated;

commit;
