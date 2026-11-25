-- KAPLI-3D TEST ONLY · restore player profiles and create them on signup
-- Target: Supabase test project kccwtpveezsrgwfnflhf
-- Apply manually in the TEST project's SQL Editor only.
-- Does not touch player_saves or any gameplay data.

begin;

-- Create a profile whenever a new Auth user signs up with a nickname in user metadata.
-- Existing player_profiles triggers remain responsible for nickname filtering and public_id.
create or replace function public.kapli_auth_create_player_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname text := btrim(coalesce(new.raw_user_meta_data ->> 'nickname', ''));
begin
  -- Some Auth-created users may not have a nickname (e.g. dashboard-created users).
  -- Do not create an invalid profile for them.
  if v_nickname = '' then
    return new;
  end if;

  insert into public.player_profiles (user_id, nickname, nickname_normalized)
  values (new.id, v_nickname, lower(v_nickname))
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists kapli_auth_create_player_profile on auth.users;
create trigger kapli_auth_create_player_profile
after insert on auth.users
for each row
execute function public.kapli_auth_create_player_profile();

-- Restore profiles for Auth users that already exist.
-- The existing BEFORE INSERT triggers validate the nickname and assign public_id.
insert into public.player_profiles (user_id, nickname, nickname_normalized)
select
  u.id,
  btrim(u.raw_user_meta_data ->> 'nickname'),
  lower(btrim(u.raw_user_meta_data ->> 'nickname'))
from auth.users u
where nullif(btrim(u.raw_user_meta_data ->> 'nickname'), '') is not null
on conflict (user_id) do nothing;

commit;

-- Verification (run separately after applying):
-- select u.id, u.raw_user_meta_data->>'nickname' as auth_nickname,
--        p.nickname, p.nickname_normalized, p.public_id
-- from auth.users u left join public.player_profiles p on p.user_id = u.id
-- order by u.created_at desc;
