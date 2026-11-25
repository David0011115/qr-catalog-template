-- KAPLI-3D TEST ONLY · punctuation handling fix for the insult filter
-- Target: Supabase test project kccwtpveezsrgwfnflhf
-- Apply manually in TEST SQL Editor after 009-safe-insult-token-filter.sql.
-- Replaces only kapli_skeleton(); leaves kapli_text_banned(), dictionary,
-- violation recording, sanctions, chat/DM functions, and gameplay data unchanged.
--
-- Fix:
--   Leet digits are normalized (0,1,2,4,5,6,7,8,9).
--   Punctuation symbols such as !, $, @, and | are NOT converted to letters.
--   Punctuation therefore remains a token separator for kapli_text_banned().
--   The special 3 -> e/z dual check, hard-sign removal, and repeated-letter
--   collapse are preserved.
--
-- After applying, run sql/010-insult-filter-smoke-test.sql again.
-- Expected: all 9 tests pass. Do not seed the full dictionary until then.

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
          translate(
            lower(coalesce(p, '')),
            'абвгдеёжзийклмнопрстуфхцчшщыэюя',
            'abvgdeezziiklmnoprstufxccssyeua'
          ),
          '012456789',
          'oizasgtbg'
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
    '(.)\1+',
    '\1',
    'g'
  );
$function$;

commit;

-- Verification is intentionally separate:
-- run sql/010-insult-filter-smoke-test.sql after this migration.
