-- «Случайный билд» (mode 'rbuild') in the rating: records are checked by the same rules as «Классика».
-- Run once in the Supabase SQL Editor (safe to run again).
-- How it works: the existing public.kapli_mode_rule is kept unchanged under the name kapli_mode_rule_v1,
-- and a thin wrapper with the same name and result type sends 'rbuild' to the 'classic' rules.
-- Every other mode is passed through as before, so nothing else changes.

do $$
declare
  res text;
begin
  -- already applied? then nothing to do
  if exists (select 1 from pg_proc where proname = 'kapli_mode_rule_v1' and pronamespace = 'public'::regnamespace) then
    raise notice 'kapli_mode_rule wrapper already installed';
    return;
  end if;
  select pg_get_function_result(p.oid) into res
  from pg_proc p where p.proname = 'kapli_mode_rule' and p.pronamespace = 'public'::regnamespace
    and pg_get_function_identity_arguments(p.oid) = 'p_mode text';
  if res is null then
    select pg_get_function_result(p.oid) into res
    from pg_proc p where p.proname = 'kapli_mode_rule' and p.pronamespace = 'public'::regnamespace and p.pronargs = 1;
  end if;
  if res is null then raise exception 'public.kapli_mode_rule(text) not found'; end if;

  execute 'alter function public.kapli_mode_rule(text) rename to kapli_mode_rule_v1';
  execute format($f$
    create function public.kapli_mode_rule(p_mode text)
    returns %s
    language sql
    stable
    set search_path = public
    as $body$ select * from public.kapli_mode_rule_v1(case when p_mode = 'rbuild' then 'classic' else p_mode end) $body$
  $f$, res);
end;
$$;

-- check: both lines must return the same limits
-- select * from public.kapli_mode_rule('classic');
-- select * from public.kapli_mode_rule('rbuild');
