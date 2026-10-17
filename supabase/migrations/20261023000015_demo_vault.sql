-- =====================================================================
-- Baú de demonstração ("Baú da Alice")
-- * Qualquer pessoa pode entrar em /demo e navegar como família ou como
--   administradora, mas NADA muda: toda escrita de usuário logado num baú
--   de demonstração é recusada no banco (inclusive via funções RPC).
-- * Só o backend (service role, que monta a demo) e o dono da plataforma
--   alteram a demo.
-- =====================================================================

alter table public.vaults add column is_demo boolean not null default false;
alter table public.profiles add column is_demo boolean not null default false;

create or replace function public.guard_demo_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vault uuid;
begin
  -- Backend (sem usuário) e dono da plataforma passam
  if auth.uid() is null or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  -- Ler o token da demo atualiza "último uso"; isso pode
  if tg_table_name = 'nfc_tokens' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'last_scanned_at' - 'updated_at') = (to_jsonb(old) - 'last_scanned_at' - 'updated_at') then
    return new;
  end if;
  if tg_table_name = 'vaults' then
    v_vault := coalesce(new.id, old.id);
  elsif tg_table_name = 'access_group_members' then
    select g.vault_id into v_vault from public.access_groups g where g.id = coalesce(new.group_id, old.group_id);
  else
    v_vault := case when tg_op = 'DELETE' then old.vault_id else new.vault_id end;
  end if;
  if exists (select 1 from public.vaults v where v.id = v_vault and v.is_demo) then
    raise exception 'demo vault is read-only' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['vaults', 'people', 'person_roles', 'access_groups', 'access_group_members', 'invitations',
    'nfc_tokens', 'memories', 'media_assets', 'memory_comments', 'visits', 'capsules', 'capsule_items', 'consents',
    'access_grants', 'data_deletion_requests', 'vault_events'] loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.guard_demo_vault()',
                   'zz_' || t || '_demo_guard', t);
  end loop;
end $$;

-- Perfis compartilhados da demo também não mudam (nome, preferências)
create or replace function public.guard_demo_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if auth.uid() is null or public.is_platform_admin() then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'profiles' then
    v_profile := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_profile := old.profile_id;
  else
    v_profile := new.profile_id;
  end if;
  -- Exceção: "visto por último" pode atualizar
  if tg_table_name = 'profiles' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'last_seen_at' - 'updated_at') = (to_jsonb(old) - 'last_seen_at' - 'updated_at') then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = v_profile and p.is_demo) then
    raise exception 'demo vault is read-only' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger zz_profiles_demo_guard before update or delete on public.profiles
  for each row execute function public.guard_demo_profile();
create trigger zz_notification_prefs_demo_guard before insert or update or delete on public.notification_preferences
  for each row execute function public.guard_demo_profile();

-- Para o backend achar a demo e os perfis dela
create or replace function public.demo_vault_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$ select id from public.vaults where is_demo and status <> 'archived' order by created_at limit 1 $$;

revoke execute on function public.guard_demo_vault(), public.guard_demo_profile(), public.demo_vault_id() from public, anon, authenticated;
grant execute on function public.guard_demo_vault(), public.guard_demo_profile() to authenticated;
grant execute on function public.demo_vault_id() to anon, authenticated, service_role;
