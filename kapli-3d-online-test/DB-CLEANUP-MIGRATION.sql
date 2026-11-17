-- Kapli 3D 2.6: old journal rows are removed by themselves, so the free plan's 500 MB is not eaten by logs.
-- Needs WALLET-MIGRATION.sql. Run once in SQL Editor (running it again is safe).
-- What is removed (nothing a player sees):
--   * error reports older than 14 days;
--   * wallet operations older than 90 days (the balance and «◆ Монеты» stay: they are kept in kapli_wallet);
--   * friends' gifts that were claimed more than 30 days ago.
-- Chat and private messages are not touched.
-- It runs on about one of 200 wallet syncs; by hand: select public.kapli_cleanup();
-- How big the tables are:
--   select relname, pg_size_pretty(pg_total_relation_size(relid)) from pg_catalog.pg_statio_user_tables order by pg_total_relation_size(relid) desc;

begin;

create or replace function public.kapli_cleanup()
returns text language plpgsql security definer set search_path = '' as $$
declare e bigint; w bigint; g bigint;
begin
  delete from public.kapli_errors where at < now() - interval '14 days'; get diagnostics e = row_count;
  delete from public.kapli_wallet_ops where at < now() - interval '90 days'; get diagnostics w = row_count;
  delete from public.kapli_gifts where claimed_at < now() - interval '30 days'; get diagnostics g = row_count;
  return format('errors %s, wallet ops %s, gifts %s', e, w, g);
end $$;
revoke all on function public.kapli_cleanup() from public, anon, authenticated;

create or replace function public.kapli_cleanup_tick()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform public.kapli_cleanup(); return null; end $$;
revoke all on function public.kapli_cleanup_tick() from public, anon, authenticated;
drop trigger if exists kapli_cleanup_tick on public.kapli_wallet_ops;
create trigger kapli_cleanup_tick after insert on public.kapli_wallet_ops for each statement
  when (random() < 0.005) execute function public.kapli_cleanup_tick();

create index if not exists kapli_wallet_ops_old on public.kapli_wallet_ops (at);
create index if not exists kapli_gifts_claimed on public.kapli_gifts (claimed_at) where claimed_at is not null;

commit;
