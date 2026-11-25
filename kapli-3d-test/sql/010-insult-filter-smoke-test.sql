-- KAPLI-3D TEST ONLY · temporary smoke test for the insult filter
-- Run only after 009-safe-insult-token-filter.sql.
-- Inserts four temporary dictionary entries inside a transaction,
-- tests classification only, and ROLLS BACK all inserted rows.
-- Does not call violation recording, chat/DM send functions, or sanctions.

begin;

insert into public.kapli_banned_words(word, kind, exact)
select v.word, 'insult', false
from (values
  ('идиот'),
  ('пидор'),
  ('хуй'),
  ('сука')
) as v(word)
where not exists (
  select 1
  from public.kapli_banned_words b
  where b.word = v.word
    and b.kind = 'insult'
    and b.exact = false
);

with samples(label, body, expected) as (
  values
    ('обычное оскорбление', 'ты идиот', 'insult'),
    ('оскорбление с пунктуацией', 'ты, идиот!', 'insult'),
    ('leet: цифра вместо буквы', 'п1дор', 'insult'),
    ('латинская x вместо х', 'xуй', 'insult'),
    ('оскорбление с повторными буквами', 'иидиооот', 'insult'),
    ('обычное слово с похожим фрагментом', 'идиотизм', null::text),
    ('обычное слово с фрагментом', 'суконный', null::text),
    ('нейтральное сообщение', 'сегодня играем вечером', null::text),
    ('нейтральное сообщение', 'плохой результат', null::text)
)
select
  label,
  body,
  expected,
  public.kapli_text_banned(body) as actual,
  public.kapli_text_banned(body) is not distinct from expected as passed
from samples
order by label;

rollback;

-- Expected: passed = true for every row.
-- If any row is false, do not run the full dictionary seed.
