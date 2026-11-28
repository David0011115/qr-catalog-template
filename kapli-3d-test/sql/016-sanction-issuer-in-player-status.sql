-- 016: expose sanction issuer to the affected player
begin;

create or replace function public.kapli_mod_my_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s record;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  select sa.id, sa.kind, sa.reason, sa.created_at, sa.ends_at, sa.source,
         issuer.nickname as issuer_nickname,
         case
           when sa.source = 'automatic' then 'arbiter'
           when ia.user_id is not null then 'admin'
           when im.user_id is not null then 'moderator'
           else 'staff'
         end as issuer_role
    into s
    from public.kapli_sanctions sa
    left join public.player_profiles issuer on issuer.user_id = sa.created_by
    left join public.kapli_admins ia on ia.user_id = sa.created_by
    left join public.kapli_moderators im on im.user_id = sa.created_by
   where sa.user_id = auth.uid()
     and sa.revoked_at is null
     and (sa.kind = 'ban' or sa.ends_at > now())
   order by case sa.kind when 'ban' then 0 when 'temp_ban' then 1 else 2 end,
            sa.ends_at desc nulls first
   limit 1;

  if not found then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'id', s.id,
    'kind', s.kind,
    'reason', s.reason,
    'created_at', s.created_at,
    'ends_at', s.ends_at,
    'issuer_role', s.issuer_role,
    'issuer_nickname', s.issuer_nickname
  );
end;
$$;

revoke all on function public.kapli_mod_my_status() from public, anon, authenticated;
grant execute on function public.kapli_mod_my_status() to authenticated;

commit;
