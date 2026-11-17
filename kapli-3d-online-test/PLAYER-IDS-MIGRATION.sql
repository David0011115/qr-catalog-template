-- Sequential public player IDs for Kapli 3D.
-- Run once in Supabase SQL Editor before the updated game code is deployed.
-- The Supabase Auth UUID remains the internal key and is not changed.
-- Assigns public_id 1 to the profile whose normalized nickname is "4opper".
-- Existing other profiles receive the next numbers in creation order; new profiles continue after the current maximum.

begin;

alter table public.player_profiles
  add column if not exists public_id bigint;

create sequence if not exists public.player_profiles_public_id_seq
  as bigint start with 1 increment by 1 minvalue 1 no maxvalue cache 1;

alter sequence public.player_profiles_public_id_seq
  owned by public.player_profiles.public_id;

create or replace function public.kapli_assign_player_public_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.public_id is null then
    new.public_id := nextval('public.player_profiles_public_id_seq'::regclass);
  end if;
  return new;
end;
$$;

drop trigger if exists player_profiles_assign_public_id on public.player_profiles;
create trigger player_profiles_assign_public_id
before insert on public.player_profiles
for each row execute function public.kapli_assign_player_public_id();

do $$
declare
  target_count integer;
begin
  select count(*) into target_count
  from public.player_profiles
  where nickname_normalized = '4opper';

  if target_count <> 1 then
    raise exception 'Expected exactly one profile for normalized nickname 4opper; found %', target_count;
  end if;
end;
$$;

update public.player_profiles
set public_id = 1
where nickname_normalized = '4opper';

with target as (
  select user_id
  from public.player_profiles
  where nickname_normalized = '4opper'
),
numbered as (
  select p.user_id, row_number() over (order by p.created_at, p.user_id) + 1 as assigned_id
  from public.player_profiles p
  where p.user_id <> (select user_id from target)
    and p.public_id is null
)
update public.player_profiles p
set public_id = numbered.assigned_id
from numbered
where p.user_id = numbered.user_id;

create unique index if not exists player_profiles_public_id_uidx
  on public.player_profiles (public_id);

alter table public.player_profiles
  alter column public_id set not null;

select setval(
  'public.player_profiles_public_id_seq'::regclass,
  (select coalesce(max(public_id), 0) + 1 from public.player_profiles),
  false
);

commit;

-- To manually change a player's displayed ID later, update public_id by user_id
-- in the Supabase SQL Editor, then reseed the sequence above MAX(public_id):
-- update public.player_profiles set public_id = 42 where user_id = '<auth UUID>';
-- select setval('public.player_profiles_public_id_seq'::regclass,
--   (select coalesce(max(public_id), 0) + 1 from public.player_profiles), false);
