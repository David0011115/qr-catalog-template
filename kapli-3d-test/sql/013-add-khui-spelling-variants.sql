-- KAPLI-3D TEST ONLY · add missing spellings of one insult token
-- Target: Supabase TEST project kccwtpveezsrgwfnflhf.
-- Apply manually in TEST SQL Editor after 012-curated-insult-dictionary.sql.
--
-- Diagnosis: the 12-case dictionary check returned null for "xуй".
-- The curated 012 seed did not include the base token "хуй" or its mixed-script
-- spellings. This migration adds only that small family of whole-word tokens.
--
-- Does not modify functions, triggers, counters, sanctions, profiles, chat/DM,
-- or gameplay data. exact=false uses the existing whole-token matching logic.
-- Idempotent: identical (word, kind, exact) rows are not duplicated.

begin;

do $preflight$
begin
  if to_regclass('public.kapli_banned_words') is null then
    raise exception 'Таблица public.kapli_banned_words не найдена';
  end if;

  if to_regprocedure('public.kapli_skeleton(text,text)') is null
     or to_regprocedure('public.kapli_text_banned(text)') is null then
    raise exception 'Функции фильтра не найдены: сначала примените 009 и 011';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kapli_banned_words'
      and column_name='word' and data_type='text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kapli_banned_words'
      and column_name='kind' and data_type='text'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kapli_banned_words'
      and column_name='exact' and data_type='boolean'
  ) then
    raise exception 'Структура kapli_banned_words отличается от ожидаемой';
  end if;
end
$preflight$;

with incoming(word, kind, exact) as (
  values
    ('хуй', 'insult', false),
    ('хуи', 'insult', false),
    ('xуй', 'insult', false),
    ('хуy', 'insult', false),
    ('xyй', 'insult', false)
),
inserted as (
  insert into public.kapli_banned_words(word, kind, exact)
  select i.word, i.kind, i.exact
  from incoming i
  where not exists (
    select 1
    from public.kapli_banned_words b
    where b.word = i.word
      and b.kind = i.kind
      and b.exact = i.exact
  )
  returning word
)
select
  (select count(*) from incoming) as prepared_entries,
  count(*) as newly_inserted
from inserted;

select kind, exact, count(*) as total_entries
from public.kapli_banned_words
group by kind, exact
order by kind, exact;

commit;

-- After applying, rerun the read-only 12-case dictionary classification query.
-- Expected: "xуй" returns insult; neutral/false-positive guards remain null.
