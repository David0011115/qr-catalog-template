-- Kapli 3D 2.7: each next level of an ability now costs ×1,35 of the previous one instead of ×1,5.
-- Players who already bought levels at the old price get the difference back into their wallet.
-- The levels are read from each player's cloud save (player_saves). Run ONCE in SQL Editor, after WALLET-MIGRATION.sql,
-- when 2.7 goes out. Step 1 only shows the sums; step 2 pays them.

-- step 1: who gets how much
with lv as (
  select s.user_id, e.key as id, least(greatest((e.value)::int, 0), 5) as n
  from public.player_saves s, jsonb_each_text(case when jsonb_typeof(s.save_data -> 'abil' -> 'lv') = 'object' then s.save_data -> 'abil' -> 'lv' else '{}'::jsonb end) e
  where e.value ~ '^\d+$'
), pr(id, p) as (values ('eject', 5000), ('shield', 15000), ('pulse', 12000), ('blink', 20000), ('slow', 25000), ('cloak', 30000),
                        ('push', 22000), ('shrink', 14000), ('decoy', 28000), ('trap', 35000)),
back as (
  select lv.user_id, sum(round(pr.p * .75 * power(1.5, l) / 50) * 50 - round(pr.p * .75 * power(1.35, l) / 50) * 50)::bigint as coins
  from lv join pr using (id) cross join lateral generate_series(0, lv.n - 1) l group by lv.user_id
)
select p.nickname, b.coins, (w.user_id is not null) as has_wallet
from back b join public.player_profiles p using (user_id) left join public.kapli_wallet w using (user_id)
where b.coins > 0 order by b.coins desc;

-- step 2: pay (uncomment and run once)
-- with lv as (
--   select s.user_id, e.key as id, least(greatest((e.value)::int, 0), 5) as n
--   from public.player_saves s, jsonb_each_text(case when jsonb_typeof(s.save_data -> 'abil' -> 'lv') = 'object' then s.save_data -> 'abil' -> 'lv' else '{}'::jsonb end) e
--   where e.value ~ '^\d+$'
-- ), pr(id, p) as (values ('eject', 5000), ('shield', 15000), ('pulse', 12000), ('blink', 20000), ('slow', 25000), ('cloak', 30000),
--                         ('push', 22000), ('shrink', 14000), ('decoy', 28000), ('trap', 35000)),
-- back as (
--   select lv.user_id, sum(round(pr.p * .75 * power(1.5, l) / 50) * 50 - round(pr.p * .75 * power(1.35, l) / 50) * 50)::bigint as coins
--   from lv join pr using (id) cross join lateral generate_series(0, lv.n - 1) l group by lv.user_id
-- )
-- select p.nickname, public.kapli_wallet_fix(p.nickname, b.coins, 'возврат: уровни способностей дешевле (2.7)')
-- from back b join public.player_profiles p using (user_id) where b.coins > 0;
