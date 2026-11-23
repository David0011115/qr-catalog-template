-- Капли 3D: серверная фиксация согласия с Политикой конфиденциальности
-- Применить один раз в Supabase → SQL Editor.
-- Текущая версия документа: 1.0

create table if not exists public.kapli_privacy_consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  policy_version text not null,
  accepted_at timestamptz not null default now(),
  policy_url text not null,
  consent_text text not null,
  constraint kapli_privacy_consents_user_version_unique
    unique (user_id, policy_version)
);

alter table public.kapli_privacy_consents enable row level security;

drop policy if exists "Users can read own privacy consents"
  on public.kapli_privacy_consents;

create policy "Users can read own privacy consents"
  on public.kapli_privacy_consents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Клиент не может самостоятельно создавать, менять или удалять записи.
revoke all on table public.kapli_privacy_consents from anon, authenticated;
grant select on table public.kapli_privacy_consents to authenticated;

create or replace function public.kapli_has_privacy_consent()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kapli_privacy_consents c
    where c.user_id = auth.uid()
      and c.policy_version = '1.0'
  );
$$;

create or replace function public.kapli_accept_privacy_policy()
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_accepted_at timestamptz;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.kapli_privacy_consents (
    user_id,
    policy_version,
    policy_url,
    consent_text
  )
  values (
    v_user_id,
    '1.0',
    'https://david0011115.github.io/qr-catalog-template/kapli-3d/privacy.html',
    'Я ознакомился(ась) и согласен(на) с Политикой конфиденциальности игры «Капли 3D» (версия 1.0).'
  )
  on conflict (user_id, policy_version) do nothing;

  select c.accepted_at
    into v_accepted_at
  from public.kapli_privacy_consents c
  where c.user_id = v_user_id
    and c.policy_version = '1.0';

  return v_accepted_at;
end;
$$;

revoke all on function public.kapli_has_privacy_consent() from public, anon;
revoke all on function public.kapli_accept_privacy_policy() from public, anon;
grant execute on function public.kapli_has_privacy_consent() to authenticated;
grant execute on function public.kapli_accept_privacy_policy() to authenticated;

comment on table public.kapli_privacy_consents is
  'Append-only consent records for Kapli 3D privacy policy. Users can read only their own records; writes are performed by SECURITY DEFINER RPC.';
