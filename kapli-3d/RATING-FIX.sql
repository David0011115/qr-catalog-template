-- Rating fix after RBUILD-RECORDS-MIGRATION.sql. Run once in the Supabase SQL Editor (safe to run again).
-- The new wrapper public.kapli_mode_rule may have been created without execute rights for the game's roles,
-- so every rating request that reads the mode rules fails. This gives both functions the rights back.
-- The rules function only returns fixed limits per mode, so opening it to players is safe.
do $$
begin
  if to_regprocedure('public.kapli_mode_rule(text)') is not null then
    execute 'grant execute on function public.kapli_mode_rule(text) to anon, authenticated';
  end if;
  if to_regprocedure('public.kapli_mode_rule_v1(text)') is not null then
    execute 'grant execute on function public.kapli_mode_rule_v1(text) to anon, authenticated';
  end if;
end;
$$;

-- check: the table below lists the rating functions, whether each runs with owner rights (definer)
-- and who may call it (access). Send a screenshot of it if the rating still does not open.
select p.proname as name, p.prosecdef as definer, coalesce(p.proacl::text, 'default') as access
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('kapli_mode_rule', 'kapli_mode_rule_v1', 'kapli_leaderboard', 'kapli_my_place', 'kapli_submit_record')
order by 1;
