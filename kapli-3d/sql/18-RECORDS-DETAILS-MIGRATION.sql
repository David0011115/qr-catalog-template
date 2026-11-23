-- Kapli 3D 2.5.2: a record carries a report of its round (mass second by second, events, totals, build, device).
-- Needs RECORDS-GUARD-MIGRATION.sql and RECORDS-REVIEW-MIGRATION.sql (already run). Run once in SQL Editor (running it again is safe).
--   * the game sends a record with kapli_submit_record_d; the record itself is checked exactly as before (kapli_submit_record),
--     the report is only stored next to it (at most 32 KB);
--   * only the player with the «Создатель» badge can read a report (kapli_record_details); everyone else gets 'forbidden'.
-- Until this is run the game keeps sending records the old way, without a report.

begin;

-- a table of its own, closed to everyone (RLS on, no policies, no grants): only the functions below reach it
create table if not exists public.kapli_record_reports (
  user_id uuid not null, mode text not null, score bigint not null, details jsonb not null, at timestamptz not null default now(),
  primary key (user_id, mode));
alter table public.kapli_record_reports enable row level security;
revoke all on table public.kapli_record_reports from public, anon, authenticated;

create or replace function public.kapli_submit_record_d(p_mode text, p_score bigint, p_details jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.kapli_submit_record(p_mode, p_score);
  if p_details is not null and jsonb_typeof(p_details) = 'object' and pg_column_size(p_details) <= 32768 then
    if exists (select 1 from public.kapli_records where user_id = auth.uid() and mode = p_mode and score = p_score) then
      insert into public.kapli_record_reports(user_id, mode, score, details, at) values (auth.uid(), p_mode, p_score, p_details, now())
      on conflict (user_id, mode) do update set score = excluded.score, details = excluded.details, at = now();
    end if;
  end if;
end $$;

create or replace function public.kapli_record_details(p_nick text, p_mode text)
returns table(score bigint, prev_score bigint, held boolean, at timestamptz, details jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.kapli_is_creator() then raise exception 'forbidden' using errcode = 'P0001'; end if;
  return query select k.score, k.prev_score, k.held, k.updated_at, d.details
    from public.kapli_records k join public.player_profiles p on p.user_id = k.user_id
    left join public.kapli_record_reports d on d.user_id = k.user_id and d.mode = k.mode and d.score = k.score
    where p.nickname = p_nick and k.mode = p_mode limit 1;
end $$;

revoke all on function public.kapli_submit_record_d(text, bigint, jsonb), public.kapli_record_details(text, text) from public, anon;
grant execute on function public.kapli_submit_record_d(text, bigint, jsonb), public.kapli_record_details(text, text) to authenticated;

commit;
