-- KAPLI-3D TEST ONLY · curated initial insult dictionary
-- Target: Supabase TEST project kccwtpveezsrgwfnflhf.
-- Apply manually in TEST SQL Editor only, after migrations 009 and 011.
-- Run 010-insult-filter-smoke-test.sql before applying this file.
--
-- SAFETY SCOPE:
--   * Adds only high-confidence direct insult/slur tokens as kind='insult'.
--   * exact=false means whole normalized token matching, not substring matching.
--   * Does not alter functions, triggers, counters, sanctions, profiles, chat/DM
--     functions, or gameplay data.
--   * Does not include broad/context-dependent profanity such as standalone
--     expletives, generic swear words, or adjectives that may be ordinary
--     descriptions. Those require separate review before any automatic mute.
--   * The original 151-row draft is intentionally NOT loaded wholesale.
--
-- Idempotent: existing identical (word, kind, exact) rows are not duplicated.
-- This migration only seeds the dictionary. It does not test live chat/DM
-- delivery or automatic sanctions. Run the separate validation steps afterward.

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
  ('идиот', 'insult', false),
  ('идиоты', 'insult', false),
  ('идиота', 'insult', false),
  ('идиотом', 'insult', false),
  ('1диот', 'insult', false),
  ('иди0т', 'insult', false),

  ('дебил', 'insult', false),
  ('дебилы', 'insult', false),
  ('дебила', 'insult', false),
  ('дебилом', 'insult', false),
  ('д3бил', 'insult', false),
  ('дeбил', 'insult', false),
  ('деб1л', 'insult', false),

  ('кретин', 'insult', false),
  ('кретины', 'insult', false),
  ('кретина', 'insult', false),
  ('придурок', 'insult', false),
  ('придурки', 'insult', false),
  ('придурка', 'insult', false),
  ('тупица', 'insult', false),
  ('тупорылый', 'insult', false),
  ('тупорылая', 'insult', false),
  ('безмозглый', 'insult', false),
  ('имбецил', 'insult', false),
  ('кретиноид', 'insult', false),

  ('урод', 'insult', false),
  ('уроды', 'insult', false),
  ('уродина', 'insult', false),
  ('мразь', 'insult', false),
  ('мразота', 'insult', false),
  ('гнида', 'insult', false),
  ('гниды', 'insult', false),
  ('тварь', 'insult', false),
  ('твари', 'insult', false),
  ('ублюдок', 'insult', false),
  ('ублюдки', 'insult', false),
  ('выродок', 'insult', false),
  ('выродки', 'insult', false),
  ('ничтожество', 'insult', false),
  ('чмо', 'insult', false),
  ('падла', 'insult', false),
  ('паскуда', 'insult', false),
  ('сволочь', 'insult', false),
  ('сволочи', 'insult', false),

  ('мудак', 'insult', false),
  ('мудаки', 'insult', false),
  ('мудила', 'insult', false),
  ('мудозвон', 'insult', false),
  ('мyдак', 'insult', false),
  ('мудaк', 'insult', false),
  ('говнюк', 'insult', false),
  ('говнюки', 'insult', false),
  ('говноед', 'insult', false),
  ('долбоеб', 'insult', false),
  ('долбоёб', 'insult', false),
  ('долбаеб', 'insult', false),
  ('долбаёб', 'insult', false),
  ('еблан', 'insult', false),
  ('ебланы', 'insult', false),
  ('охламон', 'insult', false),
  ('пиздюк', 'insult', false),
  ('пиздобол', 'insult', false),
  ('пизданутый', 'insult', false),
  ('уебок', 'insult', false),
  ('уёбок', 'insult', false),
  ('уебки', 'insult', false),

  ('сука', 'insult', false),
  ('суки', 'insult', false),
  ('сукин', 'insult', false),
  ('сучка', 'insult', false),
  ('сyка', 'insult', false),
  ('cyка', 'insult', false),
  ('гандон', 'insult', false),
  ('гондон', 'insult', false),
  ('шлюха', 'insult', false),
  ('шлюхи', 'insult', false),

  ('пидор', 'insult', false),
  ('пидоры', 'insult', false),
  ('пидорас', 'insult', false),
  ('пидорасы', 'insult', false),
  ('педераст', 'insult', false),
  ('педерасты', 'insult', false),
  ('гомик', 'insult', false),
  ('гомики', 'insult', false),
  ('п1дор', 'insult', false),
  ('пид0р', 'insult', false),
  ('пидop', 'insult', false),
  ('пид0рас', 'insult', false),
  ('п1дорас', 'insult', false),
  ('пидopac', 'insult', false),
  ('пидоp', 'insult', false)
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

-- NEXT:
-- 1. Confirm the prepared_entries/newly_inserted result and final dictionary count.
-- 2. Run a separate dictionary classification test before testing real chat/DM.
-- 3. Do not treat this seed as proof that every entry is context-safe.
