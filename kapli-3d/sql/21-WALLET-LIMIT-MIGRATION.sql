-- Kapli 3D 2.7.5: the day limit of earned coins goes from 100 000 to 250 000 (owner's decision after the coin audit:
-- a strong player hit 100 000 in about 75 minutes — a normal evening, not cheating). One earning is still at most 20 000.
-- The same function as in 12-WALLET-MIGRATION.sql with one number changed. Safe to run again.
begin;
create or replace function public.kapli_wallet_sync(p_init bigint, p_ops jsonb)
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid(); w public.kapli_wallet; o jsonb; id text; k text; n bigint; src text;
  done text[] := '{}'; bad text[] := '{}'; base bigint; start bigint; today date := (now() at time zone 'utc')::date;
begin
  if uid is null then return json_build_object('err', 'auth'); end if;
  select * into w from public.kapli_wallet where user_id = uid for update;
  if w.user_id is null then
    select case when jsonb_typeof(s.save_data -> 'coins') = 'number' then greatest(0, floor((s.save_data ->> 'coins')::numeric))::bigint end
      into base from public.player_saves s where s.user_id = uid;
    start := least(greatest(coalesce(p_init, 0), 0), coalesce(base, 0) + 50000, 2000000);
    insert into public.kapli_wallet (user_id, coins) values (uid, start) on conflict (user_id) do nothing;
    insert into public.kapli_wallet_ops (user_id, op, kind, amount, src, why)
      values (uid, 'init', 'init', start, 'phone', case when start < coalesce(p_init, 0) then 'phone had ' || p_init end) on conflict do nothing;
    select * into w from public.kapli_wallet where user_id = uid for update;
  end if;
  if w.day <> today then w.day := today; w.earned := 0; end if;
  if jsonb_typeof(p_ops) = 'array' then
    for o in select x from jsonb_array_elements(p_ops) t(x) limit 200 loop
      id := o ->> 'id'; k := o ->> 'k'; src := left(coalesce(o ->> 's', ''), 24);
      if id is null or id !~ '^[A-Za-z0-9_-]{4,40}$' or k not in ('e', 's') or jsonb_typeof(o -> 'n') <> 'number' then
        if id is not null then bad := bad || left(id, 40); end if;   -- answered, so the game drops it from its queue
        continue;
      end if;
      n := floor((o ->> 'n')::numeric);
      if exists (select 1 from public.kapli_wallet_ops where user_id = uid and op = id) then
        if exists (select 1 from public.kapli_wallet_ops where user_id = uid and op = id and ok) then done := done || id; else bad := bad || id; end if;
        continue;
      end if;
      if k = 'e' then
        if n < 1 or n > 20000 then
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, false, 'one op limit'); bad := bad || id;
        elsif w.earned + n > 250000 then
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, false, 'day limit'); bad := bad || id;
        else
          w.coins := w.coins + n; w.earned := w.earned + n;
          insert into public.kapli_wallet_ops values (uid, id, 'earn', n, src, true, null); done := done || id;
        end if;
      else
        if n < 1 or n > 10000000 or w.coins < n then
          insert into public.kapli_wallet_ops values (uid, id, 'spend', n, src, false, 'not enough: ' || w.coins); bad := bad || id;
        else
          w.coins := w.coins - n;
          insert into public.kapli_wallet_ops values (uid, id, 'spend', n, src, true, null); done := done || id;
        end if;
      end if;
    end loop;
  end if;
  update public.kapli_wallet set coins = w.coins, day = w.day, earned = w.earned, updated_at = now() where user_id = uid;
  return json_build_object('coins', w.coins, 'done', to_json(done), 'bad', to_json(bad));
end $$;
revoke all on function public.kapli_wallet_sync(bigint, jsonb) from public, anon;
grant execute on function public.kapli_wallet_sync(bigint, jsonb) to authenticated;
commit;
