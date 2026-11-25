-- KAPLI-3D TEST ONLY. Diagnostic query; it changes no data or schema.
-- Run in Supabase SQL Editor for project kccwtpveezsrgwfnflhf and send the single JSON result.
select jsonb_pretty(jsonb_build_object(
  'banned_word_kinds',
  coalesce((
    select jsonb_agg(jsonb_build_object('kind', x.kind, 'exact', x.exact, 'count', x.n) order by x.kind, x.exact)
    from (
      select kind, exact, count(*)::integer as n
      from public.kapli_banned_words
      group by kind, exact
    ) x
  ), '[]'::jsonb),
  'moderation_related_tables',
  coalesce((
    select jsonb_agg(jsonb_build_object('table', t.table_name, 'exists', to_regclass('public.' || t.table_name) is not null) order by t.table_name)
    from (values
      ('kapli_chat'), ('kapli_chat_reports'), ('kapli_friends'), ('kapli_blocks'),
      ('kapli_dm'), ('kapli_dm_reports'), ('kapli_moderation_counters'),
      ('kapli_moderation_violations'), ('kapli_sanctions')
    ) as t(table_name)
  ), '[]'::jsonb),
  'moderation_related_functions',
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'args', pg_get_function_identity_arguments(p.oid),
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'kapli_text_banned', 'kapli_chat_before_insert', 'kapli_chat_report',
        'kapli_dm_send', 'kapli_dm_report', 'kapli_mod_record_violation',
        'kapli_mod_my_status'
      )
  ), '[]'::jsonb)
)) as moderation_preflight_report;
