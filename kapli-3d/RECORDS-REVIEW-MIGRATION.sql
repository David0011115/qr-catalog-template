-- Kapli 3D 2.6: records «на проверке» are reviewed right in the game.
-- Needs RECORDS-GUARD-MIGRATION.sql and SECURITY-MIGRATION.sql (already run). Run once in SQL Editor (running it again is safe).
--   * the player with the «Создатель» badge (kapli_badge_grants) sees «🕵 На проверке (N)» in the rating and can show or delete a record;
--     everyone else gets 'forbidden' from these functions, whatever they send;
--   * a player sees «⏳ на проверке» next to their own held record (kapli_my_held).

begin;

create or replace function public.kapli_is_creator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.kapli_badge_grants where user_id = auth.uid() and badge = 'creator')
$$;

create or replace function public.kapli_review_list()
returns table(nickname text, mode text, score bigint, prev_score bigint, at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return query select p.nickname::text, k.mode, k.score, k.prev_score, k.updated_at
    from public.kapli_records k join public.player_profiles p on p.user_id = k.user_id where k.held order by k.updated_at desc limit 100;
end $$;

create or replace function public.kapli_review_record(p_nick text, p_mode text, p_ok boolean)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return public.kapli_record_review(p_nick, p_mode, p_ok);
end $$;

-- the modes where the player's own record waits for review
create or replace function public.kapli_my_held()
returns text[] language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(mode order by mode), '{}') from public.kapli_records where user_id = auth.uid() and held
$$;

revoke all on function public.kapli_is_creator(), public.kapli_review_list(), public.kapli_review_record(text, text, boolean), public.kapli_my_held() from public, anon;
grant execute on function public.kapli_review_list(), public.kapli_review_record(text, text, boolean), public.kapli_my_held() to authenticated;
revoke all on function public.kapli_is_creator() from authenticated;

commit;
