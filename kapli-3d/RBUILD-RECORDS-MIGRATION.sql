-- «Случайный билд» (mode 'rbuild') in the rating: records are checked by the same rules as «Классика».
-- Run once in the Supabase SQL Editor (safe to run again).
-- If you ran the first version of this file (before RATING-FIX.sql existed), run RATING-FIX.sql instead.
-- How it works: the existing public.kapli_mode_rule is kept unchanged under the name kapli_mode_rule_v1,
-- and a thin wrapper with the same name and result type sends 'rbuild' to the 'classic' rules.
-- Every other mode is passed through as before, so nothing else changes.

do $$
declare
  res text; args text;
begin
  -- already applied? then nothing to do
  if exists (select 1 from pg_proc where proname = 'kapli_mode_rule_v1' and pronamespace = 'public'::regnamespace) then
    raise notice 'kapli_mode_rule wrapper already installed';
    return;
  end if;
  -- full argument list keeps the OUT columns (lo, hi, lower_better); the result alone would be a bare "record"
  select pg_get_function_result(p.oid), pg_get_function_arguments(p.oid) into res, args
  from pg_proc p where p.proname = 'kapli_mode_rule' and p.pronamespace = 'public'::regnamespace and p.pronargs = 1;
  if res is null then raise exception 'public.kapli_mode_rule(text) not found'; end if;

  execute 'alter function public.kapli_mode_rule(text) rename to kapli_mode_rule_v1';
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

-- check: both lines must return the same limits
-- select * from public.kapli_mode_rule('classic');
-- select * from public.kapli_mode_rule('rbuild');
