-- KAPLI-3D TEST ONLY · safe insult filter with token boundaries
-- Target: Supabase test project kccwtpveezsrgwfnflhf
-- Apply manually in TEST SQL Editor only.
-- Replaces only kapli_skeleton() and kapli_text_banned().
-- Does NOT seed the dictionary, write violations, issue sanctions, or touch gameplay data.
--
-- Matching rules:
--   exact=true  -> whole normalized message must equal the dictionary entry.
--   exact=false -> a whole normalized token must equal the dictionary entry.
-- Punctuation separates tokens; ordinary words containing an insult fragment do not match.
-- Cyrillic letters are transliterated to a simple Latin skeleton; common leet digits are normalized.
--
-- Apply this migration first. Then run 010-insult-filter-smoke-test.sql.
-- Do not seed the full dictionary until the smoke test passes.

begin;

create or replace function public.kapli_skeleton(
  p text,
  p_three text default 'e'
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select regexp_replace(
    regexp_replace(
      replace(
        translate(
          lower(coalesce(p, '')),
          'абвгдеёжзийклмнопрстуфхцчшщыэюя',
          'abvgdeezziiklmnoprstufxccssyeua'
        ),
        '3',
        case
          when lower(coalesce(p_three, 'e')) in ('з', 'z') then 'z'
          else 'e'
        end
      ),
      '[ъь]',
      '',
      'g'
    ),
    '(.)\\1+',
    '\\1',
    'g'
  );
$function$;

create or replace function public.kapli_text_banned(p text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  w record;
  s1 text := public.kapli_skeleton(p, 'e');
  s2 text := public.kapli_skeleton(p, 'з');
begin
  for w in
    select
      b.word,
      b.kind,
      b.exact,
      public.kapli_skeleton(b.word, 'e') as sk_e,
      public.kapli_skeleton(b.word, 'з') as sk_z
    from public.kapli_banned_words b
    where nullif(btrim(b.word), '') is not null
  loop
    if w.sk_e = '' or w.sk_z = '' then
      continue;
    end if;

    if w.exact then
      if s1 = w.sk_e or s2 = w.sk_z then
        return w.kind;
      end if;
    else
      if exists (
        select 1
        from regexp_split_to_table(s1, '[^a-z0-9]+') as t(token)
        where t.token = w.sk_e
      ) or exists (
        select 1
        from regexp_split_to_table(s2, '[^a-z0-9]+') as t(token)
        where t.token = w.sk_z
      ) then
        return w.kind;
      end if;
    end if;
  end loop;

  return null;
end;
$function$;

commit;

-- Verification is intentionally separate and read-only:
-- run sql/010-insult-filter-smoke-test.sql after this migration.
