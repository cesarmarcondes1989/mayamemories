-- =====================================================================
-- Fase 0 — multi-cliente: o BAÚ vira a unidade de tudo.
--
-- * accounts  : quem paga (pode ter vários baús)
-- * vaults    : um baú (criança ou evento) com seus dados e tema
-- * platform_admins : o dono da plataforma (NÃO vê conteúdo das famílias)
-- * vault_id em todas as tabelas de conteúdo; regras de acesso por baú.
--
-- Autorização = pertencer ao baú da LINHA (sem depender de cabeçalho ou
-- cookie). O app só escolhe qual dos seus baús mostrar.
-- Os dados existentes viram o baú "maya" (nº 1), sem perder nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Novas tabelas
-- ---------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  owner_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

create table public.vaults (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$'),
  kind text not null default 'child' check (kind in ('child', 'event')),
  title text not null check (char_length(title) between 1 and 120),
  subject_name text not null check (char_length(subject_name) between 1 and 80),
  gender text check (gender in ('girl', 'boy', 'unspecified')),
  birth_date date,
  expected_birth_date date,
  event_date date,
  city text check (char_length(city) <= 120),
  theme text not null default 'rosa'
    check (theme in ('rosa', 'azul', 'salvia', 'marronzinho', 'lavanda', 'vermelho', 'amarelo', 'noite')),
  cover_path text,
  welcome_message text check (char_length(welcome_message) <= 400),
  upload_limits jsonb,
  nudges_enabled boolean not null default true,
  -- read_only: inadimplente ou evento encerrado (todos veem, ninguém envia)
  status text not null default 'active' check (status in ('active', 'read_only', 'archived')),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vaults_account_idx on public.vaults (account_id);
create trigger vaults_updated_at before update on public.vaults
  for each row execute function public.set_updated_at();

-- Criação de baús pelo próprio usuário: liga junto com o checkout (Fase 1)
alter table public.app_settings add column self_service_vaults boolean not null default false;

create table public.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Baú nº 1 com os dados atuais (se houver dados)
-- ---------------------------------------------------------------------
do $$
declare
  v_owner uuid := (select profile_id from public.person_roles where role = 'admin' and revoked_at is null
                   order by created_at limit 1);
  v_account uuid;
  v_vault uuid;
  s public.app_settings;
begin
  select * into s from public.app_settings where id;
  if v_owner is not null or exists (select 1 from public.memories) or exists (select 1 from public.people) then
    insert into public.accounts (name, owner_profile_id) values ('Família de ' || coalesce(s.subject_name, 'Maya'), v_owner)
    returning id into v_account;
    insert into public.vaults (account_id, slug, kind, title, subject_name, gender, birth_date, expected_birth_date,
                               theme, upload_limits, nudges_enabled, created_by)
    values (v_account, 'maya', 'child', coalesce(s.subject_name, 'Maya'), coalesce(s.subject_name, 'Maya'), 'girl',
            s.birth_date, s.expected_birth_date, 'rosa', s.upload_limits, coalesce(s.nudges_enabled, true), v_owner)
    returning id into v_vault;
    if v_owner is not null then
      insert into public.platform_admins (profile_id) values (v_owner);
    end if;
    perform set_config('maya.legacy_vault', v_vault::text, false);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3. vault_id em todas as tabelas de conteúdo (+ preenchimento)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  v uuid := nullif(current_setting('maya.legacy_vault', true), '')::uuid;
begin
  foreach t in array array['people', 'person_roles', 'access_groups', 'invitations', 'nfc_tokens', 'memories',
    'media_assets', 'memory_comments', 'visits', 'capsules', 'capsule_items', 'consents', 'access_grants',
    'data_deletion_requests', 'audit_events', 'notification_jobs'] loop
    execute format('alter table public.%I add column vault_id uuid references public.vaults (id) on delete cascade', t);
    if v is not null then
      -- auditoria é imutável por trigger: desliga só durante o preenchimento
      if t = 'audit_events' then
        execute 'alter table public.audit_events disable trigger audit_events_immutable';
      end if;
      execute format('update public.%I set vault_id = $1', t) using v;
      if t = 'audit_events' then
        execute 'alter table public.audit_events enable trigger audit_events_immutable';
      end if;
    end if;
    if t not in ('audit_events', 'notification_jobs') then
      -- o grupo "Família autorizada" inicial (sem dados) pertence ao baú nº 1 ou é removido
      if t = 'access_groups' and v is null then
        delete from public.access_groups where vault_id is null;
      end if;
      if t = 'capsules' and v is null then
        delete from public.capsules where vault_id is null;
      end if;
      execute format('alter table public.%I alter column vault_id set not null', t);
    end if;
    execute format('create index %I on public.%I (vault_id)', t || '_vault_idx', t);
  end loop;
end $$;

select set_config('maya.legacy_vault', '', false);

-- Unicidades agora são por baú
alter table public.people drop constraint people_profile_id_key;
create unique index people_vault_profile_uniq on public.people (vault_id, profile_id) where profile_id is not null;
drop index public.person_roles_active_uniq;
create unique index person_roles_active_uniq on public.person_roles (vault_id, profile_id, role) where revoked_at is null;
alter table public.access_groups drop constraint access_groups_name_key;
create unique index access_groups_vault_name_uniq on public.access_groups (vault_id, name);
drop index public.access_groups_single_family;
create unique index access_groups_single_family on public.access_groups (vault_id) where is_default_family;

-- ---------------------------------------------------------------------
-- 4. Integridade entre baús: filhos herdam o baú do pai
-- ---------------------------------------------------------------------
create or replace function public.inherit_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if tg_table_name in ('media_assets', 'memory_comments') then
    select vault_id into v from public.memories where id = new.memory_id;
  elsif tg_table_name = 'capsule_items' then
    select vault_id into v from public.capsules where id = new.capsule_id;
    if (select vault_id from public.memories where id = new.memory_id) is distinct from v then
      raise exception 'memory and capsule belong to different vaults' using errcode = '42501';
    end if;
  elsif tg_table_name = 'consents' then
    select vault_id into v from public.people where id = new.person_id;
  elsif tg_table_name = 'invitations' then
    select vault_id into v from public.people where id = new.person_id;
  elsif tg_table_name = 'data_deletion_requests' then
    select vault_id into v from public.memories where id = new.memory_id;
    v := coalesce(v, new.vault_id);
  end if;
  if v is null then
    raise exception 'parent not found for %', tg_table_name using errcode = '23503';
  end if;
  new.vault_id := v;
  return new;
end;
$$;

create trigger aa_media_assets_vault before insert on public.media_assets for each row execute function public.inherit_vault();
create trigger aa_memory_comments_vault before insert on public.memory_comments for each row execute function public.inherit_vault();
create trigger aa_capsule_items_vault before insert on public.capsule_items for each row execute function public.inherit_vault();
create trigger aa_consents_vault before insert on public.consents for each row execute function public.inherit_vault();
create trigger aa_invitations_vault before insert on public.invitations for each row execute function public.inherit_vault();
create trigger aa_deletion_requests_vault before insert on public.data_deletion_requests for each row execute function public.inherit_vault();

-- Referências que precisam estar no mesmo baú
create or replace function public.check_same_vault()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'memories' then
    if (select vault_id from public.people where id = new.author_person_id) is distinct from new.vault_id then
      raise exception 'author must belong to the vault' using errcode = '42501';
    end if;
    if new.requested_capsule_id is not null
       and (select vault_id from public.capsules where id = new.requested_capsule_id) is distinct from new.vault_id then
      raise exception 'capsule must belong to the vault' using errcode = '42501';
    end if;
  elsif tg_table_name = 'visits' then
    if new.memory_id is not null
       and (select vault_id from public.memories where id = new.memory_id) is distinct from new.vault_id then
      raise exception 'memory must belong to the vault' using errcode = '42501';
    end if;
  elsif tg_table_name = 'nfc_tokens' then
    if new.person_id is not null
       and (select vault_id from public.people where id = new.person_id) is distinct from new.vault_id then
      raise exception 'person must belong to the vault' using errcode = '42501';
    end if;
  elsif tg_table_name = 'access_group_members' then
    if (select vault_id from public.people where id = new.person_id)
       is distinct from (select vault_id from public.access_groups where id = new.group_id) then
      raise exception 'person and group belong to different vaults' using errcode = '42501';
    end if;
  elsif tg_table_name = 'access_grants' then
    if new.resource_type = 'memory'
       and (select vault_id from public.memories where id = new.resource_id) is distinct from new.vault_id then
      raise exception 'resource must belong to the vault' using errcode = '42501';
    end if;
    if new.resource_type = 'capsule'
       and (select vault_id from public.capsules where id = new.resource_id) is distinct from new.vault_id then
      raise exception 'resource must belong to the vault' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger memories_same_vault after insert or update on public.memories for each row execute function public.check_same_vault();
create trigger visits_same_vault after insert or update on public.visits for each row execute function public.check_same_vault();
create trigger nfc_tokens_same_vault after insert or update on public.nfc_tokens for each row execute function public.check_same_vault();
create trigger group_members_same_vault after insert on public.access_group_members for each row execute function public.check_same_vault();
create trigger access_grants_same_vault after insert on public.access_grants for each row execute function public.check_same_vault();

-- vault_id nunca muda depois de criado
create or replace function public.freeze_vault_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.vault_id is distinct from old.vault_id then
    raise exception 'vault_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
do $$
declare t text;
begin
  foreach t in array array['people', 'person_roles', 'access_groups', 'invitations', 'nfc_tokens', 'memories',
    'media_assets', 'memory_comments', 'visits', 'capsules', 'capsule_items', 'consents', 'access_grants',
    'data_deletion_requests'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.freeze_vault_id()',
                   t || '_freeze_vault', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Remove políticas e helpers antigos (sem noção de baú)
-- ---------------------------------------------------------------------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;
drop policy if exists "memories bucket: read authorized media" on storage.objects;
drop policy if exists "memories bucket: upload to registered path" on storage.objects;

drop function public.current_person_id();
drop function public.has_role(text);
drop function public.is_admin();
drop function public.is_member();
drop function public.can_contribute();
drop function public.is_in_family();
drop function public.require_admin();
drop function public.notify_admins(text, jsonb, text);
drop function public.write_audit(text, text, text, jsonb);
drop function public.log_admin_event(text, text, text, jsonb);
drop function public.has_active_consent(text, text);
drop function public.admin_create_nfc_token(uuid, text, uuid, boolean);
drop function public.resolve_nfc_token(text);
drop function public.nfc_login_target(text);
drop function public.admin_generate_growth_capsules();
drop function public.admin_dashboard_stats();
drop function public.admin_people_overview();
drop function public.my_memory_stats();

-- ---------------------------------------------------------------------
-- 6. Helpers por baú
-- ---------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.platform_admins where profile_id = public.current_profile_id()) $$;

-- A pessoa do usuário atual dentro de um baú
create or replace function public.vault_person_id(p_vault uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select pe.id from public.people pe
  where pe.vault_id = p_vault and pe.profile_id = public.current_profile_id() and pe.status = 'active'
$$;

create or replace function public.has_vault_role(p_vault uuid, p_role text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.person_roles r
    where r.vault_id = p_vault and r.profile_id = public.current_profile_id()
      and r.role = p_role and r.revoked_at is null
  ) and public.vault_person_id(p_vault) is not null
$$;

create or replace function public.is_vault_admin(p_vault uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select public.has_vault_role(p_vault, 'admin') $$;

create or replace function public.is_vault_member(p_vault uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.has_vault_role(p_vault, 'admin') or public.has_vault_role(p_vault, 'contributor')
      or public.has_vault_role(p_vault, 'future_subject')
$$;

-- Contribuir exige baú ativo (só leitura bloqueia envios, nunca a leitura)
create or replace function public.can_contribute_in(p_vault uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (public.has_vault_role(p_vault, 'admin') or public.has_vault_role(p_vault, 'contributor'))
     and exists (select 1 from public.vaults v where v.id = p_vault and v.status = 'active')
$$;

create or replace function public.in_vault_family(p_vault uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access_group_members m
    join public.access_groups g on g.id = m.group_id
    where g.vault_id = p_vault and g.is_default_family and m.person_id = public.vault_person_id(p_vault)
  )
$$;

create or replace function public.has_grant(p_resource_type text, p_resource_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access_grants g
    where g.resource_type = p_resource_type and g.resource_id = p_resource_id
      and g.revoked_at is null and (g.expires_at is null or g.expires_at > now())
      and (
        g.grantee_profile_id = public.current_profile_id()
        or g.grantee_group_id in (
          select m.group_id from public.access_group_members m
          where m.person_id = public.vault_person_id(g.vault_id)
        )
      )
  )
$$;

create or replace function public.capsule_listable(p_capsule_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  c public.capsules;
begin
  select * into c from public.capsules where id = p_capsule_id;
  if c.id is null then
    return false;
  end if;
  if public.is_vault_admin(c.vault_id) then
    return true;
  end if;
  if not public.is_vault_member(c.vault_id) or c.status not in ('scheduled', 'sealed', 'eligible_to_open', 'opened') then
    return false;
  end if;
  return case c.visibility_policy
    when 'family' then public.in_vault_family(c.vault_id) or public.has_grant('capsule', c.id)
    when 'selected' then public.has_grant('capsule', c.id)
    else false
  end;
end;
$$;

create or replace function public.capsule_viewable(p_capsule_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select public.is_vault_admin(c.vault_id) from public.capsules c where c.id = p_capsule_id), false)
      or (public.capsule_listable(p_capsule_id) and public.capsule_is_open(p_capsule_id))
$$;

create or replace function public.memory_viewable(p_memory_id uuid)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  m public.memories;
  v_profile uuid := public.current_profile_id();
begin
  if v_profile is null then
    return false;
  end if;
  select * into m from public.memories where id = p_memory_id;
  if not found then
    return false;
  end if;
  if public.is_vault_admin(m.vault_id) then
    return true;
  end if;
  if (m.created_by_profile_id = v_profile or m.author_person_id = public.vault_person_id(m.vault_id))
     and m.moderation_status <> 'removed' and m.deleted_at is null then
    return true;
  end if;
  if m.deleted_at is not null or m.moderation_status <> 'approved' then
    return false;
  end if;
  if m.unlock_at is not null and m.unlock_at > now() then
    return false;
  end if;
  if not public.is_vault_member(m.vault_id) then
    return false;
  end if;
  return case m.visibility
    when 'family' then public.in_vault_family(m.vault_id) or public.has_grant('memory', m.id)
    when 'selected' then public.has_grant('memory', m.id)
    when 'private' then public.has_grant('memory', m.id)
    when 'capsule' then exists (
      select 1 from public.capsule_items ci
      where ci.memory_id = m.id and public.capsule_viewable(ci.capsule_id)
    )
    else false
  end;
end;
$$;

create or replace function public.require_vault_admin(p_vault uuid)
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if p_vault is null or not public.is_vault_admin(p_vault) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.current_profile_id();
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Auditoria por baú
-- ---------------------------------------------------------------------
create or replace function public.write_audit(
  p_vault uuid, p_action text, p_resource_type text, p_resource_id text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_events (vault_id, actor_profile_id, action, resource_type, resource_id, metadata)
  values (p_vault, public.current_profile_id(), p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.log_admin_event(
  p_vault uuid, p_action text, p_resource_type text, p_resource_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_vault_admin(p_vault);
  perform public.write_audit(p_vault, p_action, p_resource_type, p_resource_id, p_metadata);
end;
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  v_changed text[];
  v_meta jsonb := '{}'::jsonb;
  v_id text;
  v_key text;
  v_vault uuid;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k) into v_changed
    from jsonb_object_keys(v_new) k
    where k not in ('updated_at', 'last_scanned_at', 'last_seen_at')
      and (v_new -> k) is distinct from (v_old -> k);
    if v_changed is null then
      return new;
    end if;
    v_meta := jsonb_build_object('changed', to_jsonb(v_changed));
  end if;
  foreach v_key in array array['status', 'moderation_status', 'visibility', 'processing_status', 'role'] loop
    if (v_new ? v_key or v_old ? v_key) and (v_new -> v_key) is distinct from (v_old -> v_key) then
      v_meta := v_meta || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
    end if;
  end loop;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'group_id', v_old ->> 'group_id');
  v_vault := coalesce(v_new ->> 'vault_id', v_old ->> 'vault_id')::uuid;
  if v_vault is null and tg_table_name = 'vaults' then
    v_vault := v_id::uuid;
  end if;
  if v_vault is null and tg_table_name = 'access_group_members' then
    select vault_id into v_vault from public.access_groups where id = coalesce(v_new ->> 'group_id', v_old ->> 'group_id')::uuid;
  end if;
  insert into public.audit_events (vault_id, actor_profile_id, action, resource_type, resource_id, metadata)
  values (v_vault, public.current_profile_id(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_meta);
  return coalesce(new, old);
end;
$$;

drop trigger if exists audit_settings on public.app_settings;
create trigger audit_vaults after insert or update on public.vaults
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------
-- 8. Guardas de coluna (agora por baú)
-- ---------------------------------------------------------------------
create or replace function public.guard_memories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if public.is_vault_admin(new.vault_id) then
    if tg_op = 'UPDATE' and new.created_by_profile_id is distinct from old.created_by_profile_id then
      raise exception 'created_by_profile_id is immutable' using errcode = '42501';
    end if;
    if new.visibility = 'public' then
      raise exception 'public visibility is disabled' using errcode = '42501';
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.moderation_status not in ('draft', 'uploading') then
      raise exception 'invalid initial status' using errcode = '42501';
    end if;
    if new.visibility not in ('private', 'family', 'selected', 'capsule') then
      raise exception 'invalid visibility' using errcode = '42501';
    end if;
    new.created_by_profile_id := public.current_profile_id();
    new.author_person_id := public.vault_person_id(new.vault_id);
    new.is_highlight := false;
    new.timeline_position := null;
    new.published_at := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.submitted_at := null;
    new.moderation_note := null;
    new.deleted_at := null;
    return new;
  end if;
  if new.id is distinct from old.id
     or new.created_by_profile_id is distinct from old.created_by_profile_id
     or new.author_person_id is distinct from old.author_person_id
     or new.is_highlight is distinct from old.is_highlight
     or new.timeline_position is distinct from old.timeline_position
     or new.published_at is distinct from old.published_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.submitted_at is distinct from old.submitted_at
     or new.moderation_note is distinct from old.moderation_note
     or new.deleted_at is distinct from old.deleted_at
     or new.memory_type is distinct from old.memory_type then
    raise exception 'field not editable by contributor' using errcode = '42501';
  end if;
  if new.moderation_status is distinct from old.moderation_status
     and not (old.moderation_status = 'draft' and new.moderation_status = 'uploading') then
    raise exception 'status transitions require the review workflow' using errcode = '42501';
  end if;
  if new.visibility not in ('private', 'family', 'selected', 'capsule') then
    raise exception 'invalid visibility' using errcode = '42501';
  end if;
  if old.moderation_status in ('approved', 'rejected', 'changes_requested') then
    new.moderation_status := 'pending_review';
    new.published_at := null;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;

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
  if public.is_vault_admin(new.vault_id) then
    return new;
  end if;
  raise exception 'assets are updated by the backend only' using errcode = '42501';
end;
$$;

create or replace function public.guard_comments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_vault_admin(new.vault_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.created_by_profile_id := public.current_profile_id();
    new.author_person_id := public.vault_person_id(new.vault_id);
    new.moderated_by := null;
    new.moderated_at := null;
    new.deleted_at := null;
    return new;
  end if;
  if new.memory_id is distinct from old.memory_id
     or new.created_by_profile_id is distinct from old.created_by_profile_id
     or new.author_person_id is distinct from old.author_person_id
     or new.status is distinct from old.status
     or new.moderated_by is distinct from old.moderated_by
     or new.deleted_at is distinct from old.deleted_at then
    raise exception 'field not editable by contributor' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_visits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_vault_admin(new.vault_id) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.created_by := public.current_profile_id();
    new.person_id := public.vault_person_id(new.vault_id);
    new.approved_by := null;
    new.approved_at := null;
    new.registered_at := now();
    return new;
  end if;
  if new.person_id is distinct from old.person_id
     or new.created_by is distinct from old.created_by
     or new.status is distinct from old.status
     or new.approved_by is distinct from old.approved_by
     or new.approved_at is distinct from old.approved_at
     or new.registered_at is distinct from old.registered_at then
    raise exception 'field not editable by contributor' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_consents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_vault_admin(new.vault_id) then
    return new;
  end if;
  new.person_id := public.vault_person_id(new.vault_id);
  new.recorded_by := public.current_profile_id();
  if new.status = 'granted' then
    new.granted_at := now();
    new.withdrawn_at := null;
  else
    new.withdrawn_at := now();
  end if;
  return new;
end;
$$;
-- consents: a pessoa vem do baú escolhido pelo app; o vault vem da pessoa
drop trigger aa_consents_vault on public.consents;
create or replace function public.consents_vault_check()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.vault_id is null then
    select vault_id into new.vault_id from public.people where id = new.person_id;
  end if;
  if new.vault_id is null then
    raise exception 'vault required' using errcode = '23502';
  end if;
  return new;
end;
$$;
create trigger aa_consents_vault before insert on public.consents for each row execute function public.consents_vault_check();

-- Guarda do baú: só a plataforma muda conta, endereço e situação
create or replace function public.guard_vaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_platform_admin() then
    return new;
  end if;
  if new.account_id is distinct from old.account_id or new.slug is distinct from old.slug
     or new.status is distinct from old.status or new.kind is distinct from old.kind
     or new.created_by is distinct from old.created_by then
    raise exception 'field not editable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger vaults_guard before update on public.vaults for each row execute function public.guard_vaults();

-- ---------------------------------------------------------------------
-- 9. RLS (negado por padrão; liberado por baú)
-- ---------------------------------------------------------------------
alter table public.accounts enable row level security;
alter table public.vaults enable row level security;
alter table public.platform_admins enable row level security;

create policy accounts_read on public.accounts for select to authenticated
  using (owner_profile_id = public.current_profile_id() or public.is_platform_admin()
         or exists (select 1 from public.vaults v where v.account_id = accounts.id and public.is_vault_admin(v.id)));
create policy accounts_platform on public.accounts for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy vaults_read on public.vaults for select to authenticated
  using (public.is_vault_member(id) or public.is_platform_admin());
create policy vaults_admin_update on public.vaults for update to authenticated
  using (public.is_vault_admin(id) or public.is_platform_admin())
  with check (public.is_vault_admin(id) or public.is_platform_admin());

create policy platform_admins_read on public.platform_admins for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_platform_admin());

-- Padrões da plataforma (limites de upload)
create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_platform_update on public.app_settings for update to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy profiles_self_read on public.profiles for select to authenticated
  using (
    auth_user_id = auth.uid()
    or exists (select 1 from public.people p where p.profile_id = profiles.id and public.is_vault_admin(p.vault_id))
  );
create policy profiles_self_update on public.profiles for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

create policy rel_types_read on public.relationship_types for select to authenticated using (true);
create policy rel_types_platform on public.relationship_types for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy people_admin on public.people for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy people_member_read on public.people for select to authenticated
  using (
    public.is_vault_member(vault_id) and (
      id = public.vault_person_id(vault_id)
      or exists (select 1 from public.memories m where m.author_person_id = people.id and public.memory_viewable(m.id))
      or exists (select 1 from public.memory_comments c where c.author_person_id = people.id and c.status = 'approved'
                 and c.deleted_at is null and public.memory_viewable(c.memory_id))
    )
  );

create policy roles_read on public.person_roles for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_vault_admin(vault_id));

create policy groups_admin on public.access_groups for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy group_members_admin on public.access_group_members for all to authenticated
  using (exists (select 1 from public.access_groups g where g.id = group_id and public.is_vault_admin(g.vault_id)))
  with check (exists (select 1 from public.access_groups g where g.id = group_id and public.is_vault_admin(g.vault_id)));
create policy group_members_self on public.access_group_members for select to authenticated
  using (exists (select 1 from public.people p where p.id = person_id and p.profile_id = public.current_profile_id()));

create policy invitations_admin on public.invitations for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy nfc_admin on public.nfc_tokens for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));

create policy memories_read on public.memories for select to authenticated
  using (public.memory_viewable(id));
create policy memories_insert on public.memories for insert to authenticated
  with check (
    public.is_vault_admin(vault_id)
    or (public.can_contribute_in(vault_id) and created_by_profile_id = public.current_profile_id())
  );
create policy memories_update on public.memories for update to authenticated
  using (
    public.is_vault_admin(vault_id)
    or (created_by_profile_id = public.current_profile_id()
        and public.can_contribute_in(vault_id)
        and deleted_at is null
        and moderation_status in ('draft', 'uploading', 'processing', 'pending_review', 'changes_requested', 'approved', 'rejected'))
  )
  with check (public.is_vault_admin(vault_id) or created_by_profile_id = public.current_profile_id());

create policy media_read on public.media_assets for select to authenticated
  using (public.memory_viewable(memory_id) and processing_status <> 'deleted');
create policy media_insert on public.media_assets for insert to authenticated
  with check (
    exists (
      select 1 from public.memories m
      where m.id = memory_id
        and (public.is_vault_admin(m.vault_id)
             or (public.can_contribute_in(m.vault_id)
                 and m.created_by_profile_id = public.current_profile_id()
                 and m.moderation_status in ('draft', 'uploading', 'changes_requested')
                 and m.deleted_at is null))
    )
  );
create policy media_admin_update on public.media_assets for update to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));

create policy comments_read on public.memory_comments for select to authenticated
  using (
    public.is_vault_admin(vault_id)
    or (created_by_profile_id = public.current_profile_id() and deleted_at is null)
    or (status = 'approved' and deleted_at is null and public.memory_viewable(memory_id))
  );
create policy comments_insert on public.memory_comments for insert to authenticated
  with check (
    exists (
      select 1 from public.memories m
      where m.id = memory_id and m.moderation_status = 'approved' and m.deleted_at is null
        and public.can_contribute_in(m.vault_id)
    )
    and public.memory_viewable(memory_id)
  );
create policy comments_update on public.memory_comments for update to authenticated
  using (public.is_vault_admin(vault_id) or (created_by_profile_id = public.current_profile_id() and status = 'pending_review'))
  with check (public.is_vault_admin(vault_id) or created_by_profile_id = public.current_profile_id());

create policy visits_read on public.visits for select to authenticated
  using (public.is_vault_admin(vault_id) or person_id = public.vault_person_id(vault_id));
create policy visits_insert on public.visits for insert to authenticated
  with check (public.is_vault_admin(vault_id) or public.can_contribute_in(vault_id));
create policy visits_update on public.visits for update to authenticated
  using (public.is_vault_admin(vault_id) or (person_id = public.vault_person_id(vault_id) and status = 'pending_review'))
  with check (public.is_vault_admin(vault_id) or person_id = public.vault_person_id(vault_id));

create policy capsules_read on public.capsules for select to authenticated
  using (public.capsule_listable(id));
create policy capsules_admin on public.capsules for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy capsule_items_read on public.capsule_items for select to authenticated
  using (public.capsule_viewable(capsule_id));
create policy capsule_items_admin on public.capsule_items for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));

create policy consents_read on public.consents for select to authenticated
  using (public.is_vault_admin(vault_id) or person_id = public.vault_person_id(vault_id));
create policy consents_insert on public.consents for insert to authenticated
  with check (public.is_vault_admin(vault_id) or public.vault_person_id(vault_id) is not null);

create policy grants_admin on public.access_grants for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
create policy grants_self on public.access_grants for select to authenticated
  using (grantee_profile_id = public.current_profile_id());

create policy deletion_read on public.data_deletion_requests for select to authenticated
  using (public.is_vault_admin(vault_id) or requested_by = public.current_profile_id());
create policy deletion_admin on public.data_deletion_requests for update to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));

create policy audit_admin_read on public.audit_events for select to authenticated
  using (vault_id is not null and public.is_vault_admin(vault_id));

create policy notif_prefs_self on public.notification_preferences for all to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create policy notif_jobs_admin on public.notification_jobs for select to authenticated
  using (vault_id is not null and public.is_vault_admin(vault_id));

-- Storage: mesmas regras, caminho registrado em media_assets
create policy "memories bucket: read authorized media"
on storage.objects for select to authenticated
using (
  bucket_id = 'memories'
  and exists (
    select 1 from public.media_assets a
    where a.storage_path = storage.objects.name
      and a.processing_status <> 'deleted'
      and public.memory_viewable(a.memory_id)
  )
);
create policy "memories bucket: upload to registered path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'memories'
  and exists (
    select 1 from public.media_assets a
    where a.storage_path = storage.objects.name
      and a.processing_status = 'pending_upload'
      and a.created_by_profile_id = public.current_profile_id()
  )
);

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------
-- 10. Fluxos de negócio por baú
-- ---------------------------------------------------------------------
create or replace function public.notify_vault_admins(p_vault uuid, p_event text, p_payload jsonb, p_dedupe text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select distinct profile_id from public.person_roles
           where vault_id = p_vault and role = 'admin' and revoked_at is null loop
    perform public.enqueue_notification(p_event, r.profile_id, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('vault_id', p_vault),
                                        p_dedupe || ':' || r.profile_id::text);
  end loop;
end;
$$;

-- Cria um baú completo: conta (se preciso), pessoa do criador como admin,
-- grupo "Família autorizada" e cápsulas sugeridas.
create or replace function public.create_vault(
  p_kind text, p_title text, p_subject_name text, p_slug text,
  p_my_name text, p_relationship text default 'outro',
  p_birth_date date default null, p_expected_birth_date date default null, p_event_date date default null,
  p_gender text default null, p_theme text default 'rosa', p_account_id uuid default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_account uuid := p_account_id;
  v_vault uuid;
  v_person uuid;
  v_group uuid;
begin
  if v_profile is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_platform_admin()
     and not coalesce((select self_service_vaults from public.app_settings where id), false) then
    raise exception 'vault creation is not open yet' using errcode = '42501';
  end if;
  if p_kind not in ('child', 'event') then
    raise exception 'invalid kind';
  end if;
  if v_account is null then
    select id into v_account from public.accounts where owner_profile_id = v_profile order by created_at limit 1;
    if v_account is null then
      insert into public.accounts (name, owner_profile_id) values (left(coalesce(nullif(p_my_name, ''), 'Minha conta'), 160), v_profile)
      returning id into v_account;
    end if;
  elsif not exists (select 1 from public.accounts where id = v_account and owner_profile_id = v_profile)
        and not public.is_platform_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if exists (select 1 from public.vaults where slug = lower(p_slug)) then
    raise exception 'slug already taken' using errcode = '23505';
  end if;
  insert into public.vaults (account_id, slug, kind, title, subject_name, gender, birth_date, expected_birth_date,
                             event_date, theme, created_by)
  values (v_account, lower(p_slug), p_kind, p_title, p_subject_name, p_gender, p_birth_date, p_expected_birth_date,
          p_event_date, coalesce(p_theme, 'rosa'), v_profile)
  returning id into v_vault;

  insert into public.people (vault_id, display_name, relationship_type, profile_id, status, created_by)
  values (v_vault, left(coalesce(nullif(p_my_name, ''), 'Admin'), 120),
          coalesce((select key from public.relationship_types where key = p_relationship), 'outro'), v_profile, 'active', v_profile)
  returning id into v_person;
  insert into public.person_roles (vault_id, profile_id, role, created_by)
  values (v_vault, v_profile, 'admin', v_profile), (v_vault, v_profile, 'contributor', v_profile);
  insert into public.access_groups (vault_id, name, description, is_default_family, created_by)
  values (v_vault, 'Família autorizada', 'Pessoas que podem ver memórias marcadas como "Família autorizada".', true, v_profile)
  returning id into v_group;
  insert into public.access_group_members (group_id, person_id, added_by) values (v_group, v_person, v_profile);
  insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;

  if p_kind = 'child' then
    insert into public.capsules (vault_id, title, description, theme, capsule_type, opening_rule, status, created_by) values
      (v_vault, 'Cápsula Zero — A espera', 'Da gestação ao nascimento: a expectativa da família.', 'O que estávamos vivendo',
       'pregnancy', 'manual', 'scheduled', v_profile),
      (v_vault, 'Cápsula do nascimento', 'Primeiras fotos, primeiros vídeos, a primeira visita.', 'Quem estava por perto',
       'birth', 'manual', 'scheduled', v_profile),
      (v_vault, 'Cartas para o futuro', 'Cartas escritas para abrir em datas especiais.', 'O que desejamos para você',
       'letters', 'manual', 'draft', v_profile);
  else
    insert into public.capsules (vault_id, title, description, theme, capsule_type, opening_rule, status, created_by) values
      (v_vault, 'Mensagens do grande dia', 'Tudo o que os convidados deixaram.', 'Quem estava lá',
       'special', 'manual', 'scheduled', v_profile);
  end if;
  return v_vault;
end;
$$;

-- Primeiro dono da plataforma (somente service role). Também cria o
-- primeiro baú quando ainda não há nenhum.
create or replace function public.bootstrap_first_admin(
  p_email text, p_display_name text, p_relationship text default 'pai'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_profile uuid;
  v_vault uuid;
begin
  if exists (select 1 from public.platform_admins) then
    raise exception 'an administrator already exists; use the admin panel to add others';
  end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then
    raise exception 'auth user not found for %', p_email;
  end if;
  select id into v_profile from public.profiles where auth_user_id = v_user;
  if v_profile is null then
    insert into public.profiles (auth_user_id, display_name) values (v_user, p_display_name) returning id into v_profile;
  else
    update public.profiles set display_name = p_display_name, status = 'active' where id = v_profile;
  end if;
  insert into public.platform_admins (profile_id) values (v_profile);
  if not exists (select 1 from public.vaults) then
    perform set_config('request.jwt.claims', json_build_object('sub', v_user)::text, true);
    v_vault := public.create_vault('child', 'Maya', 'Maya', 'maya', p_display_name, p_relationship, null, null, null, 'girl', 'rosa');
    perform set_config('request.jwt.claims', '', true);
  end if;
  insert into public.audit_events (vault_id, actor_profile_id, action, resource_type, resource_id, metadata)
  values (v_vault, null, 'admin.bootstrap', 'profile', v_profile::text, '{}'::jsonb);
  return v_profile;
end;
$$;

create or replace function public.admin_set_role(p_person_id uuid, p_role text, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.people;
  v_admin uuid;
begin
  select * into p from public.people where id = p_person_id;
  v_admin := public.require_vault_admin(p.vault_id);
  if p_role not in ('admin', 'contributor', 'future_subject') then
    raise exception 'invalid role';
  end if;
  if p.profile_id is null then
    raise exception 'person has no active account yet';
  end if;
  if p_enabled then
    insert into public.person_roles (vault_id, profile_id, role, created_by) values (p.vault_id, p.profile_id, p_role, v_admin)
    on conflict do nothing;
  else
    if p_role = 'admin' and p.profile_id = v_admin then
      raise exception 'you cannot remove your own admin role';
    end if;
    if p_role = 'admin' and (select count(*) from public.person_roles
                             where vault_id = p.vault_id and role = 'admin' and revoked_at is null) <= 1 then
      raise exception 'at least one administrator must remain';
    end if;
    update public.person_roles set revoked_at = now(), revoked_by = v_admin
    where vault_id = p.vault_id and profile_id = p.profile_id and role = p_role and revoked_at is null;
  end if;
end;
$$;

create or replace function public.admin_set_person_status(p_person_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.people;
  v_admin uuid;
begin
  select * into p from public.people where id = p_person_id;
  v_admin := public.require_vault_admin(p.vault_id);
  if p_status not in ('active', 'suspended', 'archived') then
    raise exception 'invalid status';
  end if;
  if p.profile_id = v_admin and p_status <> 'active' then
    raise exception 'you cannot suspend yourself';
  end if;
  -- Suspender vale só para este baú (a pessoa pode estar em outros)
  update public.people set status = p_status where id = p.id;
end;
$$;

create or replace function public.admin_create_invitation(
  p_person_id uuid, p_email text default null, p_expires_in_days int default 30, p_add_to_family boolean default true
) returns table (invitation_id uuid, secret text)
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.people;
  v_admin uuid;
  v_secret text := public.random_token(24);
  v_id uuid;
begin
  select * into p from public.people where id = p_person_id;
  v_admin := public.require_vault_admin(p.vault_id);
  if p_expires_in_days < 1 or p_expires_in_days > 365 then
    raise exception 'expiration must be between 1 and 365 days';
  end if;
  insert into public.invitations (vault_id, person_id, email, token_hash, access_group_id, expires_at, created_by)
  values (
    p.vault_id, p.id, nullif(lower(trim(p_email)), ''), public.hash_secret(v_secret),
    case when p_add_to_family then (select id from public.access_groups where vault_id = p.vault_id and is_default_family) end,
    now() + make_interval(days => p_expires_in_days), v_admin
  ) returning id into v_id;
  return query select v_id, v_secret;
end;
$$;

create or replace function public.link_invitation(i public.invitations)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_profile uuid := (select p.id from public.profiles p where p.auth_user_id = auth.uid());
  v_current_person uuid;
  v_target_profile uuid;
begin
  if v_profile is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select profile_id into v_target_profile from public.people where id = i.person_id;
  if v_target_profile is not null and v_target_profile <> v_profile then
    raise exception 'invitation already linked to another account' using errcode = '42501';
  end if;
  select id into v_current_person from public.people where profile_id = v_profile and vault_id = i.vault_id;
  if v_current_person is not null and v_current_person <> i.person_id then
    raise exception 'account already linked to another person' using errcode = '42501';
  end if;
  update public.people set profile_id = v_profile, status = 'active' where id = i.person_id and status in ('invited', 'active');
  if not found then
    raise exception 'person is not available' using errcode = '42501';
  end if;
  update public.profiles set display_name = (select display_name from public.people where id = i.person_id)
  where id = v_profile and display_name = split_part(public.auth_email(), '@', 1);
  insert into public.person_roles (vault_id, profile_id, role, created_by) values (i.vault_id, v_profile, 'contributor', i.created_by)
  on conflict do nothing;
  if i.access_group_id is not null then
    insert into public.access_group_members (group_id, person_id, added_by)
    values (i.access_group_id, i.person_id, i.created_by) on conflict do nothing;
  end if;
  update public.invitations set accepted_at = now(), accepted_by_profile_id = v_profile where id = i.id;
  insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;
  perform public.notify_vault_admins(i.vault_id, 'invitation.accepted', jsonb_build_object('person_id', i.person_id),
                                     'invitation.accepted:' || i.id::text);
  return i.person_id;
end;
$$;

create or replace function public.accept_invitations_for_my_email()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text := public.auth_email();
  i public.invitations;
  v_count int := 0;
begin
  if v_email is null then
    return 0;
  end if;
  -- um convite por baú (o mais recente)
  for i in
    select distinct on (vault_id) * from public.invitations
    where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
    order by vault_id, created_at desc
  loop
    perform public.link_invitation(i);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_create_nfc_token(
  p_vault_id uuid, p_person_id uuid default null, p_label text default null,
  p_invitation_id uuid default null, p_activate boolean default true
) returns public.nfc_tokens
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_vault_admin(p_vault_id);
  t public.nfc_tokens;
begin
  insert into public.nfc_tokens (vault_id, public_id, person_id, invitation_id, label, status, activated_at, created_by)
  values (
    p_vault_id, public.random_token(15), p_person_id, p_invitation_id, p_label,
    case when p_activate then 'active' else 'prepared' end,
    case when p_activate then now() end, v_admin
  ) returning * into t;
  return t;
end;
$$;

create or replace function public.admin_set_nfc_status(p_token_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.nfc_tokens;
begin
  select * into t from public.nfc_tokens where id = p_token_id for update;
  if t.id is null then
    raise exception 'token not found';
  end if;
  perform public.require_vault_admin(t.vault_id);
  if t.status in ('revoked', 'replaced') then
    raise exception 'revoked or replaced tokens cannot be reactivated';
  end if;
  if p_status not in ('active', 'suspended', 'revoked') then
    raise exception 'invalid status';
  end if;
  update public.nfc_tokens set
    status = p_status,
    activated_at = case when p_status = 'active' then coalesce(activated_at, now()) else activated_at end,
    revoked_at = case when p_status = 'revoked' then now() else revoked_at end
  where id = p_token_id;
end;
$$;

create or replace function public.admin_replace_nfc_token(p_token_id uuid)
returns public.nfc_tokens
language plpgsql security definer
set search_path = ''
as $$
declare
  old_t public.nfc_tokens;
  new_t public.nfc_tokens;
  v_admin uuid;
begin
  select * into old_t from public.nfc_tokens where id = p_token_id for update;
  if old_t.id is null then
    raise exception 'token not found';
  end if;
  v_admin := public.require_vault_admin(old_t.vault_id);
  if old_t.status = 'replaced' then
    raise exception 'token already replaced';
  end if;
  insert into public.nfc_tokens (vault_id, public_id, person_id, invitation_id, label, status, activated_at, created_by, notes)
  values (old_t.vault_id, public.random_token(15), old_t.person_id, old_t.invitation_id, old_t.label, 'active', now(), v_admin,
          'Substitui o token ' || old_t.public_id)
  returning * into new_t;
  update public.nfc_tokens set status = 'replaced', revoked_at = now(), replaced_by_token_id = new_t.id
  where id = old_t.id;
  return new_t;
end;
$$;

create or replace function public.resolve_nfc_token(p_public_id text)
returns table (state text, is_my_token boolean, greeting_name text, vault_id uuid)
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.nfc_tokens;
  v_person uuid;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{16,64}$' then
    return query select 'unavailable'::text, false, null::text, null::uuid;
    return;
  end if;
  select * into t from public.nfc_tokens where public_id = p_public_id;
  if t.id is null or t.status <> 'active'
     or not exists (select 1 from public.vaults v where v.id = t.vault_id and v.status <> 'archived') then
    return query select 'unavailable'::text, false, null::text, null::uuid;
    return;
  end if;
  update public.nfc_tokens set last_scanned_at = now() where id = t.id;
  v_person := public.vault_person_id(t.vault_id);
  return query
    select 'active'::text,
           (v_person is not null and v_person = t.person_id),
           case when v_person is not null and v_person = t.person_id
                then (select split_part(p.display_name, ' ', 1) from public.people p where p.id = t.person_id) end,
           case when v_person is not null and v_person = t.person_id then t.vault_id end;
end;
$$;

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
  select * into p from public.people where id = t.person_id and status in ('invited', 'active');
  if p.id is null then
    return;
  end if;
  return query
    select p.id, p.display_name,
      (select lower(u.email) from public.profiles pr join auth.users u on u.id = pr.auth_user_id where pr.id = p.profile_id),
      (select i.email from public.invitations i
        where i.person_id = p.id and i.email is not null and i.revoked_at is null
        order by i.created_at desc limit 1),
      exists (select 1 from public.person_roles r
              where r.vault_id = p.vault_id and r.profile_id = p.profile_id and r.role = 'admin' and r.revoked_at is null),
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
  end if;
  insert into public.person_roles (vault_id, profile_id, role, created_by) values (p.vault_id, v_profile, 'contributor', t.created_by)
  on conflict do nothing;
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

create or replace function public.has_active_consent(p_vault uuid, p_type text, p_version text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select c.status = 'granted' and c.policy_version = p_version
    from public.consents c
    where c.person_id = public.vault_person_id(p_vault) and c.consent_type = p_type
    order by c.created_at desc limit 1
  ), false)
$$;

create or replace function public.submit_memory(p_memory_id uuid)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.memories;
  v_profile uuid := public.current_profile_id();
begin
  select * into m from public.memories where id = p_memory_id for update;
  if m.id is null or m.created_by_profile_id is distinct from v_profile or m.deleted_at is not null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if not public.can_contribute_in(m.vault_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if m.moderation_status not in ('draft', 'uploading', 'processing', 'changes_requested') then
    return m.moderation_status;
  end if;
  if exists (select 1 from public.media_assets a where a.memory_id = m.id
             and a.processing_status in ('pending_upload', 'uploaded', 'processing')) then
    raise exception 'uploads still in progress' using errcode = '55000';
  end if;
  if m.memory_type in ('photo', 'album', 'video', 'audio', 'drawing') and not exists (
    select 1 from public.media_assets a where a.memory_id = m.id and a.processing_status = 'ready') then
    raise exception 'this memory needs at least one file' using errcode = '22023';
  end if;
  if m.memory_type in ('text', 'letter') and coalesce(length(trim(m.description)), 0) = 0
     and not exists (select 1 from public.media_assets a where a.memory_id = m.id and a.processing_status = 'ready') then
    raise exception 'message is empty' using errcode = '22023';
  end if;
  update public.memories set moderation_status = 'pending_review', submitted_at = now() where id = m.id;
  perform public.notify_vault_admins(m.vault_id, 'memory.submitted',
    jsonb_build_object('memory_id', m.id, 'memory_type', m.memory_type),
    'memory.submitted:' || m.id::text || ':' || extract(epoch from now())::bigint::text);
  return 'pending_review';
end;
$$;

create or replace function public.request_memory_removal(p_memory_id uuid, p_reason text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.memories;
  v_profile uuid := public.current_profile_id();
begin
  select * into m from public.memories where id = p_memory_id for update;
  if m.id is null or v_profile is null
     or (m.created_by_profile_id <> v_profile and m.author_person_id is distinct from public.vault_person_id(m.vault_id)) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if m.moderation_status in ('approved', 'hidden') then
    insert into public.data_deletion_requests (vault_id, requested_by, memory_id, reason)
    values (m.vault_id, v_profile, m.id, left(p_reason, 2000));
    perform public.notify_vault_admins(m.vault_id, 'deletion.requested', jsonb_build_object('memory_id', m.id),
      'deletion.requested:' || m.id::text || ':' || v_profile::text);
    return 'requested';
  end if;
  update public.memories set moderation_status = 'removed', deleted_at = now() where id = m.id;
  update public.visits set status = 'removed' where memory_id = m.id;
  delete from public.capsule_items where memory_id = m.id;
  perform public.write_audit(m.vault_id, 'memory.withdrawn_by_author', 'memories', m.id::text, '{}'::jsonb);
  return 'removed';
end;
$$;

create or replace function public.moderate_memory(p_memory_id uuid, p_action text, p_note text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.memories;
  v_admin uuid;
  v_status text;
begin
  select * into m from public.memories where id = p_memory_id for update;
  if m.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_admin := public.require_vault_admin(m.vault_id);
  v_status := case p_action
    when 'approve' then 'approved' when 'reject' then 'rejected' when 'request_changes' then 'changes_requested'
    when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'approved' else null end;
  if v_status is null then
    raise exception 'invalid action';
  end if;
  if v_status = 'approved' and exists (
    select 1 from public.media_assets a where a.memory_id = m.id and a.processing_status not in ('ready', 'deleted')) then
    raise exception 'media is not ready to publish' using errcode = '55000';
  end if;
  update public.memories set
    moderation_status = v_status,
    moderation_note = coalesce(left(p_note, 2000), moderation_note),
    reviewed_by = v_admin,
    reviewed_at = now(),
    published_at = case when v_status = 'approved' then coalesce(published_at, now()) else null end,
    deleted_at = case when v_status = 'removed' then now() else null end
  where id = m.id;
  if m.memory_type = 'visit' then
    update public.visits set
      status = case v_status when 'approved' then 'approved' when 'hidden' then 'hidden'
                             when 'removed' then 'removed' when 'rejected' then 'rejected' else 'pending_review' end,
      approved_by = case when v_status = 'approved' then v_admin end,
      approved_at = case when v_status = 'approved' then now() end
    where memory_id = m.id;
  end if;
  if v_status = 'removed' then
    delete from public.capsule_items where memory_id = m.id;
  end if;
  if v_status = 'approved' and m.requested_capsule_id is not null then
    insert into public.capsule_items (vault_id, capsule_id, memory_id, added_by)
    values (m.vault_id, m.requested_capsule_id, m.id, v_admin) on conflict do nothing;
  end if;
  perform public.write_audit(m.vault_id, 'memory.' || p_action, 'memories', m.id::text,
    jsonb_build_object('from', m.moderation_status, 'to', v_status));
  if v_status in ('approved', 'rejected', 'changes_requested')
     and m.created_by_profile_id <> v_admin
     and coalesce((select on_contribution_reviewed from public.notification_preferences
                   where profile_id = m.created_by_profile_id), true) then
    perform public.enqueue_notification('memory.' || v_status, m.created_by_profile_id,
      jsonb_build_object('memory_id', m.id, 'note', p_note, 'vault_id', m.vault_id),
      'memory.' || v_status || ':' || m.id::text || ':' || extract(epoch from now())::bigint::text);
  end if;
  return v_status;
end;
$$;

create or replace function public.moderate_comment(p_comment_id uuid, p_action text)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.memory_comments;
  v_admin uuid;
  v_status text := case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
                                 when 'hide' then 'hidden' when 'remove' then 'removed' end;
begin
  select * into c from public.memory_comments where id = p_comment_id;
  if c.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_admin := public.require_vault_admin(c.vault_id);
  if v_status is null then
    raise exception 'invalid action';
  end if;
  update public.memory_comments set status = v_status, moderated_by = v_admin, moderated_at = now(),
    deleted_at = case when v_status = 'removed' then now() end
  where id = p_comment_id;
  return v_status;
end;
$$;

create or replace function public.resolve_deletion_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r public.data_deletion_requests;
  v_admin uuid;
begin
  select * into r from public.data_deletion_requests where id = p_request_id and status = 'pending' for update;
  if r.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_admin := public.require_vault_admin(r.vault_id);
  if p_accept and r.memory_id is not null then
    perform public.moderate_memory(r.memory_id, 'remove', 'Removida a pedido do autor');
  end if;
  update public.data_deletion_requests
  set status = case when p_accept then 'completed' else 'declined' end, resolved_by = v_admin, resolved_at = now()
  where id = r.id;
end;
$$;

create or replace function public.admin_open_capsule(p_capsule_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.capsules;
  v_admin uuid;
begin
  select * into c from public.capsules where id = p_capsule_id for update;
  if c.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_admin := public.require_vault_admin(c.vault_id);
  if c.opening_rule = 'date_and_manual' and (c.opens_at is null or c.opens_at > now()) then
    raise exception 'this capsule cannot be opened before its date' using errcode = '42501';
  end if;
  if c.opening_rule = 'date' and (c.opens_at is null or c.opens_at > now()) then
    raise exception 'this capsule opens automatically on its date' using errcode = '42501';
  end if;
  update public.capsules set status = 'opened', opened_at = now(), opened_by = v_admin where id = c.id;
  perform public.write_audit(c.vault_id, 'capsule.opened', 'capsules', c.id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_capsule_status(p_capsule_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.capsules;
begin
  select * into c from public.capsules where id = p_capsule_id;
  if c.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  perform public.require_vault_admin(c.vault_id);
  if p_status not in ('draft', 'scheduled', 'sealed', 'archived') then
    raise exception 'invalid status';
  end if;
  update public.capsules set status = p_status,
    opened_at = case when p_status in ('sealed', 'draft') then null else opened_at end
  where id = p_capsule_id;
end;
$$;

create or replace function public.admin_generate_growth_capsules(p_vault_id uuid)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_vault_admin(p_vault_id);
  v public.vaults;
  v_birth date;
  v_count int := 0;
  r record;
begin
  select * into v from public.vaults where id = p_vault_id;
  v_birth := coalesce(v.birth_date, v.expected_birth_date);
  if v_birth is null then
    raise exception 'set the birth date (or expected date) in settings first';
  end if;
  for r in
    select * from (values (interval '3 months', '3 meses'), (interval '6 months', '6 meses')) as x(i, label)
    union all
    select make_interval(years => y), case when y = 1 then '1 ano' else y || ' anos' end
    from generate_series(1, 15) y
  loop
    if not exists (select 1 from public.capsules where vault_id = p_vault_id and capsule_type in ('growth', 'fifteen')
                   and title = v.subject_name || ' — ' || r.label) then
      insert into public.capsules (vault_id, title, description, capsule_type, opens_at, opening_rule, status, created_by)
      values (
        p_vault_id, v.subject_name || ' — ' || r.label,
        'Cápsula de crescimento. O que estávamos vivendo, quem estava por perto, o que desejamos para você.',
        case when r.label = '15 anos' then 'fifteen' else 'growth' end,
        (v_birth + r.i)::timestamptz, 'date', 'draft', v_admin
      );
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create or replace function public.admin_dashboard_stats(p_vault_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_vault_admin(p_vault_id);
  return jsonb_build_object(
    'people', (select count(*) from public.people where vault_id = p_vault_id and status <> 'archived'),
    'active_people', (select count(*) from public.people where vault_id = p_vault_id and status = 'active'),
    'pending_invitations', (select count(*) from public.invitations where vault_id = p_vault_id and accepted_at is null
                            and revoked_at is null and expires_at > now()),
    'confirmed_visits', (select count(*) from public.visits where vault_id = p_vault_id and status = 'approved'),
    'pending_review', (select count(*) from public.memories where vault_id = p_vault_id and moderation_status = 'pending_review'
                       and deleted_at is null),
    'pending_comments', (select count(*) from public.memory_comments where vault_id = p_vault_id and status = 'pending_review'
                         and deleted_at is null),
    'pending_deletions', (select count(*) from public.data_deletion_requests where vault_id = p_vault_id and status = 'pending'),
    'photos_videos', (select count(*) from public.media_assets where vault_id = p_vault_id and media_type in ('image', 'video')
                      and processing_status = 'ready'),
    'future_letters', (select count(*) from public.memories where vault_id = p_vault_id and memory_type = 'letter'
                       and unlock_at > now() and deleted_at is null),
    'open_capsules', (select count(*) from public.capsules c where c.vault_id = p_vault_id and public.capsule_is_open(c.id)),
    'next_capsules', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, title, opens_at from public.capsules
        where vault_id = p_vault_id and status in ('scheduled', 'sealed') and opens_at > now() order by opens_at limit 5) x),
    'failed_uploads', (select count(*) from public.media_assets where vault_id = p_vault_id and processing_status = 'failed'),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.media_assets
                      where vault_id = p_vault_id and processing_status <> 'deleted'),
    'recent_admin_activity', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select a.action, a.resource_type, a.created_at, p.display_name as actor
        from public.audit_events a left join public.profiles p on p.id = a.actor_profile_id
        where a.vault_id = p_vault_id
        order by a.created_at desc limit 8) x)
  );
end;
$$;

create or replace function public.admin_people_overview(p_vault_id uuid)
returns table (
  person_id uuid, display_name text, relationship_type text, status text, has_account boolean,
  roles text[], in_family boolean, last_portal_access timestamptz, last_contribution timestamptz,
  last_confirmed_visit date, last_interaction timestamptz, pending_invitation boolean, created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_vault_admin(p_vault_id);
  return query
  select p.id, p.display_name, p.relationship_type, p.status, p.profile_id is not null,
    coalesce((select array_agg(r.role order by r.role) from public.person_roles r
              where r.vault_id = p_vault_id and r.profile_id = p.profile_id and r.revoked_at is null), '{}'),
    exists (select 1 from public.access_group_members gm join public.access_groups g on g.id = gm.group_id
            where g.vault_id = p_vault_id and g.is_default_family and gm.person_id = p.id),
    pr.last_seen_at,
    (select max(m.submitted_at) from public.memories m where m.author_person_id = p.id),
    (select max(v.occurred_at) from public.visits v where v.person_id = p.id and v.status = 'approved'),
    greatest(pr.last_seen_at,
             (select max(m.created_at) from public.memories m where m.author_person_id = p.id),
             (select max(v.registered_at) from public.visits v where v.person_id = p.id),
             (select max(c.created_at) from public.memory_comments c where c.author_person_id = p.id)),
    exists (select 1 from public.invitations i where i.person_id = p.id and i.accepted_at is null
            and i.revoked_at is null and i.expires_at > now()),
    p.created_at
  from public.people p
  left join public.profiles pr on pr.id = p.profile_id
  where p.vault_id = p_vault_id
  order by p.display_name;
end;
$$;

create or replace function public.enqueue_upcoming_capsule_notices(p_days int default 7)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  c record;
  r record;
  v_count int := 0;
begin
  for c in
    select id, vault_id, title, opens_at from public.capsules
    where status = 'scheduled' and opens_at between now() and now() + make_interval(days => p_days)
  loop
    for r in
      select distinct p.profile_id from public.people p
      join public.access_group_members gm on gm.person_id = p.id
      join public.access_groups g on g.id = gm.group_id and g.is_default_family and g.vault_id = c.vault_id
      left join public.notification_preferences np on np.profile_id = p.profile_id
      where p.profile_id is not null and p.status = 'active' and coalesce(np.on_capsule_opening, true)
    loop
      perform public.enqueue_notification('capsule.upcoming', r.profile_id,
        jsonb_build_object('capsule_id', c.id, 'title', c.title, 'opens_at', c.opens_at, 'vault_id', c.vault_id),
        'capsule.upcoming:' || c.id::text || ':' || r.profile_id::text);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

create or replace function public.my_memory_stats(p_vault_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_person uuid := public.vault_person_id(p_vault_id);
  v public.vaults;
begin
  if v_profile is null or v_person is null or not public.is_vault_member(p_vault_id) then
    return null;
  end if;
  select * into v from public.vaults where id = p_vault_id;
  return jsonb_build_object(
    'enabled', v.nudges_enabled,
    'subject_name', v.subject_name,
    'birth_date', v.birth_date,
    'expected_birth_date', v.expected_birth_date,
    'my_total', (select count(*) from public.memories m
                 where m.vault_id = p_vault_id and (m.created_by_profile_id = v_profile or m.author_person_id = v_person)
                   and m.deleted_at is null and m.moderation_status not in ('draft', 'uploading', 'removed')),
    'my_approved', (select count(*) from public.memories m
                    where m.vault_id = p_vault_id and (m.created_by_profile_id = v_profile or m.author_person_id = v_person)
                      and m.deleted_at is null and m.moderation_status = 'approved'),
    'my_last_at', (select max(m.submitted_at) from public.memories m
                   where m.vault_id = p_vault_id and m.created_by_profile_id = v_profile and m.deleted_at is null),
    'my_last_photo_at', (select max(m.submitted_at) from public.memories m
                         where m.vault_id = p_vault_id and m.created_by_profile_id = v_profile and m.deleted_at is null
                           and m.memory_type in ('photo', 'album', 'video', 'mixed')),
    'my_last_audio_at', (select max(m.submitted_at) from public.memories m
                         where m.vault_id = p_vault_id and m.created_by_profile_id = v_profile and m.deleted_at is null
                           and m.memory_type = 'audio'),
    'my_letters', (select count(*) from public.memories m
                   where m.vault_id = p_vault_id and m.created_by_profile_id = v_profile and m.deleted_at is null
                     and m.memory_type = 'letter'),
    'my_visits', (select count(*) from public.visits vi where vi.person_id = v_person and vi.status = 'approved'),
    'family_total', (select count(*) from public.memories m
                     where m.vault_id = p_vault_id and m.moderation_status = 'approved' and m.deleted_at is null),
    'next_capsule', (select jsonb_build_object('id', c.id, 'title', c.title, 'opens_at', c.opens_at)
                     from public.capsules c
                     where c.vault_id = p_vault_id and c.status = 'scheduled' and c.opens_at > now()
                       and public.capsule_listable(c.id)
                     order by c.opens_at limit 1)
  );
end;
$$;

-- Baús do usuário atual (para o seletor de baú)
create or replace function public.my_vaults()
returns table (vault_id uuid, slug text, title text, subject_name text, kind text, theme text, status text,
               person_id uuid, roles text[])
language sql stable security definer
set search_path = ''
as $$
  select v.id, v.slug, v.title, v.subject_name, v.kind, v.theme, v.status, p.id,
    coalesce((select array_agg(r.role order by r.role) from public.person_roles r
              where r.vault_id = v.id and r.profile_id = p.profile_id and r.revoked_at is null), '{}')
  from public.people p
  join public.vaults v on v.id = p.vault_id
  where p.profile_id = public.current_profile_id() and p.status = 'active' and v.status <> 'archived'
  order by v.created_at
$$;

-- ---------------------------------------------------------------------
-- 11. Permissões de execução (refeitas do zero)
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.check_invitation(text) to anon, authenticated;
grant execute on function public.invitation_email_allowed(text, text) to anon, authenticated;
grant execute on function public.resolve_nfc_token(text) to anon, authenticated;

grant execute on function
  public.current_profile_id(), public.is_platform_admin(), public.vault_person_id(uuid), public.has_vault_role(uuid, text),
  public.is_vault_admin(uuid), public.is_vault_member(uuid), public.can_contribute_in(uuid), public.in_vault_family(uuid),
  public.has_grant(text, uuid), public.capsule_is_open(uuid), public.capsule_listable(uuid), public.capsule_viewable(uuid),
  public.capsule_condition_met(public.capsules), public.memory_viewable(uuid),
  public.log_admin_event(uuid, text, text, text, jsonb),
  public.accept_invitation(text), public.accept_invitations_for_my_email(),
  public.touch_last_seen(), public.has_active_consent(uuid, text, text),
  public.submit_memory(uuid), public.request_memory_removal(uuid, text),
  public.moderate_memory(uuid, text, text), public.moderate_comment(uuid, text),
  public.resolve_deletion_request(uuid, boolean),
  public.admin_set_role(uuid, text, boolean), public.admin_set_person_status(uuid, text),
  public.admin_create_invitation(uuid, text, int, boolean),
  public.admin_create_nfc_token(uuid, uuid, text, uuid, boolean), public.admin_set_nfc_status(uuid, text),
  public.admin_replace_nfc_token(uuid),
  public.admin_open_capsule(uuid), public.admin_set_capsule_status(uuid, text),
  public.admin_generate_growth_capsules(uuid), public.admin_dashboard_stats(uuid), public.admin_people_overview(uuid),
  public.my_memory_stats(uuid), public.my_vaults(),
  public.create_vault(text, text, text, text, text, text, date, date, date, text, text, uuid),
  public.set_updated_at(), public.is_end_user_request(), public.audit_row_change(), public.forbid_change(),
  public.guard_profiles(), public.guard_memories(), public.guard_media_assets(), public.guard_comments(),
  public.guard_visits(), public.guard_consents(), public.guard_vaults(), public.freeze_vault_id(),
  public.inherit_vault(), public.check_same_vault(), public.consents_vault_check()
to authenticated;

grant execute on function
  public.bootstrap_first_admin(text, text, text), public.email_has_pending_invitation(text),
  public.claim_notification_jobs(int), public.complete_notification_job(uuid, boolean, text),
  public.enqueue_upcoming_capsule_notices(int),
  public.nfc_login_target(text), public.nfc_link_person(text, uuid)
to service_role;
