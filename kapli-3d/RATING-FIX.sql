-- Rating and records fix after RBUILD-RECORDS-MIGRATION.sql. Run once in the Supabase SQL Editor (safe to run again).
-- The wrapper public.kapli_mode_rule was created as "returns record" without its output columns
-- (lo, hi, lower_better), so the rating and record saving failed with
-- "a column definition list is required for functions returning record".
-- This recreates the wrapper with exactly the same arguments and output columns as the original
-- (kept as kapli_mode_rule_v1), still sending 'rbuild' to the 'classic' rules.
do $$
declare
  f oid := to_regprocedure('public.kapli_mode_rule_v1(text)');
  args text; res text;
begin
  if f is null then raise exception 'public.kapli_mode_rule_v1(text) not found — run RBUILD-RECORDS-MIGRATION.sql first'; end if;
  select pg_get_function_arguments(f), pg_get_function_result(f) into args, res;
  execute 'drop function if exists public.kapli_mode_rule(text)';
  execute format($f$
    create function public.kapli_mode_rule(%s)
    returns %s
    language sql
    stable
    set search_path = public
    as $body$ select * from public.kapli_mode_rule_v1(case when $1 = 'rbuild' then 'classic' else $1 end) $body$
  $f$, args, res);
  execute 'grant execute on function public.kapli_mode_rule(text) to anon, authenticated';
end;
$$;

notify pgrst, 'reload schema';

-- check: both rows must show the same limits, then the rating must list players
select 'classic' as mode, * from public.kapli_mode_rule('classic')
union all
select 'rbuild', * from public.kapli_mode_rule('rbuild');
