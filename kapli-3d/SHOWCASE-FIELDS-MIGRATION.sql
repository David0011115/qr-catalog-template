-- Kapli 3D: the player's card on the server keeps the newer parts too.
-- kapli_set_showcase saved only bg, frame, title, badge, skin and six numbers; everything added later was dropped on the way:
--   act   — the activity calendar (2.2)
--   shelf — the showcase of up to 3 achievements (2.2)
--   rc    — the summary of the last season (2.2)
--   ps    — prestige stars (2.0)
-- This keeps every check that was there and adds these four, each checked for its exact shape. Run once in SQL Editor
-- (running it again is safe). Players' cards fill in by themselves the next time they open the game or their profile.

create or replace function public.kapli_set_showcase(p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid(); clean jsonb := '{}'::jsonb; k text; v jsonb; e jsonb; sh jsonb := '[]'::jsonb; rc jsonb := '{}'::jsonb;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 4096 then raise exception 'bad_showcase' using errcode = 'P0001'; end if;

  -- as before
  foreach k in array array['bg', 'frame', 'title', 'badge', 'skin'] loop
    if jsonb_typeof(p -> k) = 'string' and (p ->> k) ~ '^[A-Za-z0-9_]{0,40}$' then clean := clean || jsonb_build_object(k, p ->> k); end if;
  end loop;
  foreach k in array array['lvl', 'league', 'chaos', 'wins', 'best', 'ach'] loop
    if jsonb_typeof(p -> k) = 'number' and (p ->> k)::numeric between 0 and 100000000 then clean := clean || jsonb_build_object(k, floor((p ->> k)::numeric)); end if;
  end loop;

  -- ps: prestige { s: stars, n: novas }
  v := p -> 'ps';
  if jsonb_typeof(v) = 'object' then
    clean := clean || jsonb_build_object('ps', jsonb_strip_nulls(jsonb_build_object(
      's', case when jsonb_typeof(v -> 's') = 'number' and (v ->> 's')::numeric between 0 and 1000 then floor((v ->> 's')::numeric) end,
      'n', case when jsonb_typeof(v -> 'n') = 'number' and (v ->> 'n')::numeric between 0 and 1000 then floor((v ->> 'n')::numeric) end)));
  end if;

  -- shelf: up to 3 pairs [achievement id, step 1..6]
  v := p -> 'shelf';
  if jsonb_typeof(v) = 'array' then
    for e in select x from jsonb_array_elements(v) as t(x) limit 3 loop
      if jsonb_typeof(e) = 'array' and jsonb_typeof(e -> 0) = 'string' and (e ->> 0) ~ '^[A-Za-z0-9_]{1,40}$'
         and jsonb_typeof(e -> 1) = 'number' and (e ->> 1)::numeric between 1 and 6 then
        sh := sh || jsonb_build_array(jsonb_build_array(e ->> 0, floor((e ->> 1)::numeric)));
      end if;
    end loop;
    clean := clean || jsonb_build_object('shelf', sh);
  end if;

  -- act: the calendar { g: one digit 0..4 per day (up to 45 days), t: the day it was sent, s: streak, b: best streak }
  v := p -> 'act';
  if jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'g') = 'string' and (v ->> 'g') ~ '^[0-4]{1,45}$'
     and jsonb_typeof(v -> 't') = 'string' and (v ->> 't') ~ '^\d{4}-\d\d-\d\d$' then
    clean := clean || jsonb_build_object('act', jsonb_build_object(
      'g', v ->> 'g', 't', v ->> 't',
      's', case when jsonb_typeof(v -> 's') = 'number' and (v ->> 's')::numeric between 0 and 100000 then floor((v ->> 's')::numeric) else 0 end,
      'b', case when jsonb_typeof(v -> 'b') = 'number' and (v ->> 'b')::numeric between 0 and 100000 then floor((v ->> 'b')::numeric) else 0 end));
  end if;

  -- rc: the last season's summary — numbers, the season's name (plain text, shown escaped by the game), the favourite mode
  v := p -> 'rc';
  if jsonb_typeof(v) = 'object' and jsonb_typeof(v -> 'id') = 'number' then
    foreach k in array array['id', 'r', 't', 'm', 'w', 'c', 'x', 'ch', 'pts'] loop
      if jsonb_typeof(v -> k) = 'number' and (v ->> k)::numeric between 0 and 1000000000 then rc := rc || jsonb_build_object(k, floor((v ->> k)::numeric)); end if;
    end loop;
    if jsonb_typeof(v -> 'lg') = 'number' and (v ->> 'lg')::numeric between -1 and 5 then rc := rc || jsonb_build_object('lg', floor((v ->> 'lg')::numeric)); end if;
    if jsonb_typeof(v -> 'n') = 'string' and length(v ->> 'n') between 1 and 40 then rc := rc || jsonb_build_object('n', v ->> 'n'); end if;
    if jsonb_typeof(v -> 'fav') = 'array' and jsonb_typeof(v -> 'fav' -> 0) = 'string' and (v -> 'fav' ->> 0) ~ '^[a-z0-9_]{1,20}$'
       and jsonb_typeof(v -> 'fav' -> 1) = 'number' and (v -> 'fav' ->> 1)::numeric between 0 and 1000000 then
      rc := rc || jsonb_build_object('fav', jsonb_build_array(v -> 'fav' ->> 0, floor((v -> 'fav' ->> 1)::numeric)));
    end if;
    clean := clean || jsonb_build_object('rc', rc);
  end if;

  insert into kapli_showcase(user_id, data, updated_at) values (uid, clean, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $function$;

-- Check: after you open the game (or your profile) once, your card has the calendar
-- select nickname, (select string_agg(k, ', ') from jsonb_object_keys(data) k) as keys from public.kapli_showcases(array['4opper']);
