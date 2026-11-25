-- Kapli-3D TEST ONLY · черновик словаря оскорблений
-- ВАЖНО: ПОКА НЕ ЗАПУСКАТЬ.
-- Сначала применить 009-safe-insult-token-filter.sql,
-- затем выполнить 010-insult-filter-smoke-test.sql.
-- Запускать этот словарь можно только если все строки теста имеют passed=true.
-- До этого момента текущая база остаётся без словаря и не выдаёт автоматические муты
-- по словам из этого черновика.
-- Сначала выполните 008-insult-filter-diagnostics.sql и передайте результат
-- определения kapli_text_banned()/kapli_skeleton() для подготовки безопасной миграции.
--
-- Этот файл только наполняет public.kapli_banned_words.
-- Не меняет функции, триггеры, счётчики, санкции, профили или игровые данные.
-- Конечные варианты обхода не покрывают все возможные написания.
-- Неоднозначные фразы, угрозы и контекстные обвинения здесь не включены:
-- они должны уходить на ручную проверку.
--
-- После применения миграции 009 exact=false проверяется по целому
-- нормализованному токену, а не по произвольной подстроке.
-- INSERT идемпотентен по (word, kind, exact).

begin;

do $$
begin
  if to_regclass('public.kapli_banned_words') is null then
    raise exception 'Таблица public.kapli_banned_words не найдена';
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
end $$;

with incoming(word, kind, exact) as (
values
  ('идиот', 'insult', false),
  ('идиоты', 'insult', false),
  ('идиота', 'insult', false),
  ('идиотом', 'insult', false),
  ('дебил', 'insult', false),
  ('дебилы', 'insult', false),
  ('дебила', 'insult', false),
  ('дебилом', 'insult', false),
  ('кретин', 'insult', false),
  ('кретины', 'insult', false),
  ('кретина', 'insult', false),
  ('придурок', 'insult', false),
  ('придурки', 'insult', false),
  ('придурка', 'insult', false),
  ('тупица', 'insult', false),
  ('тупой', 'insult', false),
  ('тупая', 'insult', false),
  ('тупые', 'insult', false),
  ('тупорылый', 'insult', false),
  ('тупорылая', 'insult', false),
  ('безмозглый', 'insult', false),
  ('даун', 'insult', false),
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
  ('скотина', 'insult', false),
  ('козел', 'insult', false),
  ('козёл', 'insult', false),
  ('сволочь', 'insult', false),
  ('сволочи', 'insult', false),
  ('мудак', 'insult', false),
  ('мудаки', 'insult', false),
  ('мудила', 'insult', false),
  ('мудозвон', 'insult', false),
  ('говнюк', 'insult', false),
  ('говнюки', 'insult', false),
  ('говноед', 'insult', false),
  ('говно', 'insult', false),
  ('долбоеб', 'insult', false),
  ('долбоёб', 'insult', false),
  ('долбаеб', 'insult', false),
  ('долбаёб', 'insult', false),
  ('еблан', 'insult', false),
  ('ебланы', 'insult', false),
  ('охламон', 'insult', false),
  ('лох', 'insult', false),
  ('лохушка', 'insult', false),
  ('лохопед', 'insult', false),
  ('неудачник', 'insult', false),
  ('хуй', 'insult', false),
  ('хуи', 'insult', false),
  ('хуя', 'insult', false),
  ('хуем', 'insult', false),
  ('хуём', 'insult', false),
  ('хуевый', 'insult', false),
  ('хуёвый', 'insult', false),
  ('хуевая', 'insult', false),
  ('хуевое', 'insult', false),
  ('пизда', 'insult', false),
  ('пиздец', 'insult', false),
  ('пиздеть', 'insult', false),
  ('пиздишь', 'insult', false),
  ('пиздюк', 'insult', false),
  ('пиздобол', 'insult', false),
  ('пизданутый', 'insult', false),
  ('ебать', 'insult', false),
  ('ебал', 'insult', false),
  ('ебала', 'insult', false),
  ('ебёт', 'insult', false),
  ('ебет', 'insult', false),
  ('ебучий', 'insult', false),
  ('ебучая', 'insult', false),
  ('ебаный', 'insult', false),
  ('ёбаный', 'insult', false),
  ('заебал', 'insult', false),
  ('заебала', 'insult', false),
  ('заебись', 'insult', false),
  ('наебать', 'insult', false),
  ('выебать', 'insult', false),
  ('уебок', 'insult', false),
  ('уёбок', 'insult', false),
  ('уебки', 'insult', false),
  ('блядь', 'insult', false),
  ('блять', 'insult', false),
  ('бля', 'insult', false),
  ('блядский', 'insult', false),
  ('сука', 'insult', false),
  ('суки', 'insult', false),
  ('сукин', 'insult', false),
  ('сучка', 'insult', false),
  ('гандон', 'insult', false),
  ('гондон', 'insult', false),
  ('шлюха', 'insult', false),
  ('шлюхи', 'insult', false),
  ('залупа', 'insult', false),
  ('нахуй', 'insult', false),
  ('похуй', 'insult', false),
  ('нехуй', 'insult', false),
  ('охуеть', 'insult', false),
  ('охуенный', 'insult', false),
  ('охуенно', 'insult', false),
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
  ('пидоp', 'insult', false),
  ('д3бил', 'insult', false),
  ('дeбил', 'insult', false),
  ('деб1л', 'insult', false),
  ('1диот', 'insult', false),
  ('иди0т', 'insult', false),
  ('идuот', 'insult', false),
  ('xуй', 'insult', false),
  ('хуy', 'insult', false),
  ('xyй', 'insult', false),
  ('п1зда', 'insult', false),
  ('пизд0', 'insult', false),
  ('пuзда', 'insult', false),
  ('бл9дь', 'insult', false),
  ('бляdь', 'insult', false),
  ('е6ать', 'insult', false),
  ('мyдак', 'insult', false),
  ('мудaк', 'insult', false),
  ('сyка', 'insult', false),
  ('cyка', 'insult', false)
)
insert into public.kapli_banned_words(word, kind, exact)
select i.word, i.kind, i.exact
from incoming i
where not exists (
  select 1 from public.kapli_banned_words b
  where b.word=i.word and b.kind=i.kind and b.exact=i.exact
);

select kind, exact, count(*) as entries
from public.kapli_banned_words
group by kind, exact
order by kind, exact;

commit;
