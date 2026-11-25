-- Kapli-3D TEST ONLY · диагностика фильтра оскорблений (READ ONLY)
-- Можно запускать в SQL Editor тестового проекта.
-- Не меняет таблицы, функции, триггеры, счётчики или санкции.
-- Цель: получить точное определение функции и увидеть текущие совпадения.

-- 1. Текущие определения функций нормализации и фильтра.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_function_result(p.oid) as result_type, pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('kapli_text_banned', 'kapli_skeleton')
order by p.proname;

-- 2. Проверочные примеры. Только вызов классификации; нарушения и муты не записываются.
with samples(label, body, expected) as (values
  ('очевидное оскорбление', 'ты идиот', 'insult'),
  ('leet-вариант', 'п1дор', 'insult'),
  ('латинские похожие буквы', 'xуй', 'insult'),
  ('обычное слово с коротким фрагментом', 'плохой результат', null::text),
  ('обычное нейтральное сообщение', 'сегодня играем вечером', null::text),
  ('оскорбление с пунктуацией', 'ты, идиот!', 'insult')
)
select label, body, expected, public.kapli_text_banned(body) as actual,
       (public.kapli_text_banned(body) is not distinct from expected) as matches_expected
from samples;

-- 3. Текущее наполнение словаря.
select kind, exact, count(*) as entries
from public.kapli_banned_words
group by kind, exact
order by kind, exact;
