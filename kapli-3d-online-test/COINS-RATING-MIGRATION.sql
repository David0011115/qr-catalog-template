-- Kapli 3D 2.6: the rating «Заработано монет» — coins earned in the game since 2.6, counted by the server.
-- Needs WALLET-MIGRATION.sql (run it first). Run once in SQL Editor (running it again is safe).
-- Only earnings the wallet accepted count (rounds, achievements, chests, leagues…). Promo codes, gifts from friends,
-- the coins moved from the phone at the start and the owner's fixes do not.
-- Reset (for the release): update public.kapli_wallet set total = 0;

begin;

alter table public.kapli_wallet add column if not exists total bigint not null default 0;

create or replace function public.kapli_wallet_total_add()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'earn' and new.ok then update public.kapli_wallet set total = total + new.amount where user_id = new.user_id; end if;
  return new;
end $$;
drop trigger if exists kapli_wallet_total on public.kapli_wallet_ops;
create trigger kapli_wallet_total after insert on public.kapli_wallet_ops for each row execute function public.kapli_wallet_total_add();

-- what was earned before this file was run
update public.kapli_wallet w set total = coalesce((select sum(o.amount) from public.kapli_wallet_ops o where o.user_id = w.user_id and o.kind = 'earn' and o.ok), 0);

create or replace function public.kapli_coins_top(p_limit integer default 20)
returns table(place bigint, nickname text, total bigint, is_me boolean)
language sql stable security definer set search_path = '' as $$
  with r as (
    select rank() over (order by w.total desc) as place, p.nickname::text as nickname, w.total, w.user_id = auth.uid() as is_me
    from public.kapli_wallet w join public.player_profiles p on p.user_id = w.user_id where w.total > 0
  )
  select place, nickname, total, is_me from r order by place, nickname limit least(greatest(p_limit, 1), 50)
$$;
create or replace function public.kapli_coins_me()
returns table(place bigint, total bigint, players bigint)
language sql stable security definer set search_path = '' as $$
  with r as (select w.user_id, w.total, rank() over (order by w.total desc) as place from public.kapli_wallet w where w.total > 0)
  select place, total, (select count(*) from r) from r where user_id = auth.uid()
$$;
revoke all on function public.kapli_coins_top(integer), public.kapli_coins_me(), public.kapli_wallet_total_add() from public, anon;
grant execute on function public.kapli_coins_top(integer), public.kapli_coins_me() to authenticated;
revoke all on function public.kapli_wallet_total_add() from authenticated;

commit;
