-- =====================================================================
-- Endurecimento de segurança (varredura de nov/2026)
-- 1. Ligar pessoa <-> conta é só do backend (impede apontar uma pessoa para a
--    conta de outra pessoa e entrar nela pelo ursinho)
-- 2. Ursinho: nunca usa o e-mail do convite; admin entra por e-mail;
--    papel revogado não volta; baú arquivado não abre
-- 3. Dono da plataforma precisa de 2 fatores (aal2) para escrever
-- 4. is_demo só muda pela plataforma; conta da demo não cria baú
-- 5. Arquivos: usuário não altera registros de mídia (só o backend)
-- 6. Vínculos entre baús conferidos também em UPDATE
-- 7. Limite de tentativas (cadastro, login, código, analytics, convidados)
-- =====================================================================

-- 1 -------------------------------------------------------------------
create or replace function public.guard_people_link()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' and new.profile_id is not null and new.profile_id is distinct from public.current_profile_id() then
    raise exception 'people are linked to accounts by the backend only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.profile_id is distinct from old.profile_id then
    raise exception 'people are linked to accounts by the backend only' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger people_link_guard before insert or update on public.people
  for each row execute function public.guard_people_link();

-- 2 -------------------------------------------------------------------
create or replace function public.nfc_login_target(p_public_id text)
returns table (person_id uuid, display_name text, auth_email text, invitation_email text, is_admin boolean, vault_id uuid)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  t public.nfc_tokens;
  p public.people;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{16,64}$' then
    return;
  end if;
  select * into t from public.nfc_tokens where public_id = p_public_id and status = 'active';
  if t.id is null or t.person_id is null then
    return;
  end if;
  if not exists (select 1 from public.vaults v where v.id = t.vault_id and v.status <> 'archived') then
    return;
  end if;
  select * into p from public.people where id = t.person_id and status in ('invited', 'active');
  if p.id is null then
    return;
  end if;
  return query
    select p.id, p.display_name,
      (select lower(u.email) from public.profiles pr join auth.users u on u.id = pr.auth_user_id where pr.id = p.profile_id),
      -- O e-mail do convite foi digitado por um admin e não prova nada: nunca é usado para entrar
      null::text,
      -- Admin de QUALQUER baú (ou da plataforma) não entra pelo ursinho
      p.profile_id is not null and (
        exists (select 1 from public.person_roles r
                where r.profile_id = p.profile_id and r.role = 'admin' and r.revoked_at is null)
        or exists (select 1 from public.platform_admins pa where pa.profile_id = p.profile_id)),
      p.vault_id;
end;
$$;

create or replace function public.nfc_link_person(p_public_id text, p_auth_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.nfc_tokens;
  p public.people;
  v_profile uuid;
  v_group uuid;
  v_is_admin boolean;
begin
  select * into t from public.nfc_tokens where public_id = p_public_id and status = 'active' for update;
  if t.id is null or t.person_id is null then
    raise exception 'token unavailable' using errcode = '42501';
  end if;
  if not exists (select 1 from public.vaults v where v.id = t.vault_id and v.status <> 'archived') then
    raise exception 'vault unavailable' using errcode = '42501';
  end if;
  select * into p from public.people where id = t.person_id and status in ('invited', 'active') for update;
  if p.id is null then
    raise exception 'person unavailable' using errcode = '42501';
  end if;
  select id into v_profile from public.profiles where auth_user_id = p_auth_user_id;
  if v_profile is null then
    insert into public.profiles (auth_user_id, display_name) values (p_auth_user_id, p.display_name) returning id into v_profile;
  end if;
  if p.profile_id is not null and p.profile_id <> v_profile then
    raise exception 'person already linked to another account' using errcode = '42501';
  end if;
  if p.profile_id is null and exists (select 1 from public.people where vault_id = p.vault_id and profile_id = v_profile) then
    raise exception 'account already linked to another person in this vault' using errcode = '42501';
  end if;
  if p.profile_id is null then
    update public.people set profile_id = v_profile, status = 'active' where id = p.id;
    update public.profiles set display_name = p.display_name, status = 'active'
    where id = v_profile and display_name like 'nfc-%';
    select coalesce(
      (select i.access_group_id from public.invitations i where i.id = t.invitation_id),
      (select g.id from public.access_groups g where g.vault_id = p.vault_id and g.is_default_family)
    ) into v_group;
    if v_group is not null then
      insert into public.access_group_members (group_id, person_id, added_by)
      values (v_group, p.id, t.created_by) on conflict do nothing;
    end if;
    update public.invitations set accepted_at = now(), accepted_by_profile_id = v_profile
    where person_id = p.id and accepted_at is null and revoked_at is null;
    insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;
    -- Papel só no primeiro vínculo: se um admin revogar depois, o ursinho não devolve
    insert into public.person_roles (vault_id, profile_id, role, created_by) values (p.vault_id, v_profile, 'contributor', t.created_by)
    on conflict do nothing;
  end if;
  if t.activated_at is null then
    update public.nfc_tokens set activated_at = now() where id = t.id;
  end if;
  v_is_admin := exists (select 1 from public.person_roles
                        where vault_id = p.vault_id and profile_id = v_profile and role = 'admin' and revoked_at is null);
  insert into public.audit_events (vault_id, actor_profile_id, action, resource_type, resource_id, metadata)
  values (p.vault_id, v_profile, 'nfc.direct_access', 'nfc_tokens', t.id::text,
          jsonb_build_object('person_id', p.id, 'admin', v_is_admin));
  return p.id;
end;
$$;

-- 3 e 4 ----------------------------------------------------------------
create or replace function public.guard_vaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_platform_admin_strong() then
    return new;
  end if;
  if new.account_id is distinct from old.account_id or new.slug is distinct from old.slug
     or new.status is distinct from old.status or new.kind is distinct from old.kind
     or new.created_by is distinct from old.created_by or new.is_demo is distinct from old.is_demo then
    raise exception 'field not editable' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop policy accounts_platform on public.accounts;
create policy accounts_platform on public.accounts for all to authenticated
  using (public.is_platform_admin_strong()) with check (public.is_platform_admin_strong());
drop policy vaults_admin_update on public.vaults;
create policy vaults_admin_update on public.vaults for update to authenticated
  using (public.is_vault_admin(id) or public.is_platform_admin_strong())
  with check (public.is_vault_admin(id) or public.is_platform_admin_strong());
drop policy rel_types_platform on public.relationship_types;
create policy rel_types_platform on public.relationship_types for all to authenticated
  using (public.is_platform_admin_strong()) with check (public.is_platform_admin_strong());

create or replace function public.guard_demo_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_vault uuid;
begin
  if auth.uid() is null or public.is_platform_admin_strong() then
    return coalesce(new, old);
  end if;
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

create or replace function public.guard_demo_profile()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if auth.uid() is null or public.is_platform_admin_strong() then
    return coalesce(new, old);
  end if;
  if tg_table_name = 'profiles' then
    v_profile := coalesce(new.id, old.id);
  elsif tg_op = 'DELETE' then
    v_profile := old.profile_id;
  else
    v_profile := new.profile_id;
  end if;
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

-- Conta da demo (compartilhada) não cria baú nem conta
create or replace function public.guard_self_service_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
begin
  if v_profile is null or public.is_platform_admin_strong() then
    return new;
  end if;
  if exists (select 1 from public.profiles where id = v_profile and is_demo) then
    raise exception 'demo accounts cannot create vaults' using errcode = '42501';
  end if;
  -- Trava por conta: dois pedidos ao mesmo tempo não furam o limite
  perform pg_advisory_xact_lock(hashtext('self_service_vault:' || v_profile::text));
  if (select count(*) from public.vaults v join public.accounts a on a.id = v.account_id
      where a.owner_profile_id = v_profile and v.status <> 'archived')
     >= (select self_service_vault_limit from public.app_settings where id) then
    raise exception 'vault limit reached' using errcode = '53400';
  end if;
  if (select count(*) from public.vaults where created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many requests' using errcode = '53400';
  end if;
  return new;
end;
$$;

create or replace function public.guard_demo_accounts()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and exists (
    select 1 from public.profiles where id = public.current_profile_id() and is_demo) then
    raise exception 'demo accounts cannot create accounts' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger zz_accounts_demo_guard before insert on public.accounts
  for each row execute function public.guard_demo_accounts();

-- 5 -------------------------------------------------------------------
create or replace function public.guard_media_assets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.processing_status <> 'pending_upload' then
      raise exception 'assets start as pending_upload' using errcode = '42501';
    end if;
    new.created_by_profile_id := public.current_profile_id();
    if new.storage_path not like new.vault_id::text || '/' || new.memory_id::text || '/%' then
      raise exception 'storage path must live under the vault/memory folder' using errcode = '42501';
    end if;
    return new;
  end if;
  -- Verificação, troca de arquivo e exclusão são feitas pelo backend
  raise exception 'assets are updated by the backend only' using errcode = '42501';
end;
$$;

-- Read-only/arquivado também vale para administradores do baú
drop policy memories_insert on public.memories;
create policy memories_insert on public.memories for insert to authenticated
  with check (
    exists (select 1 from public.vaults v where v.id = vault_id and v.status = 'active')
    and (public.is_vault_admin(vault_id)
         or (public.can_contribute_in(vault_id) and created_by_profile_id = public.current_profile_id()))
  );
drop policy media_insert on public.media_assets;
create policy media_insert on public.media_assets for insert to authenticated
  with check (
    exists (
      select 1 from public.memories m join public.vaults v on v.id = m.vault_id
      where m.id = memory_id and v.status = 'active'
        and (public.is_vault_admin(m.vault_id)
             or (public.can_contribute_in(m.vault_id)
                 and m.created_by_profile_id = public.current_profile_id()
                 and m.moderation_status in ('draft', 'uploading', 'changes_requested')
                 and m.deleted_at is null))
    )
  );

-- 6 -------------------------------------------------------------------
drop trigger group_members_same_vault on public.access_group_members;
create trigger group_members_same_vault after insert or update on public.access_group_members
  for each row execute function public.check_same_vault();
drop trigger access_grants_same_vault on public.access_grants;
create trigger access_grants_same_vault after insert or update on public.access_grants
  for each row execute function public.check_same_vault();

-- 7 -------------------------------------------------------------------
-- Contador simples de tentativas, só para o backend (service role)
create table public.rate_events (
  key text not null check (char_length(key) <= 200),
  at timestamptz not null default now()
);
create index rate_events_key_at on public.rate_events (key, at);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from public, anon, authenticated;

create or replace function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(hashtext('rate:' || p_key));
  select count(*) into v_count from public.rate_events
  where key = p_key and at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    return false;
  end if;
  insert into public.rate_events (key) values (p_key);
  -- Limpeza preguiçosa
  if random() < 0.01 then
    delete from public.rate_events where at < now() - interval '2 days';
  end if;
  return true;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
