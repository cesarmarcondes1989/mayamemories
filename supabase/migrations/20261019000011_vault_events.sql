-- =====================================================================
-- Eventos dentro do baú ("1 ano", "Chá bar", "Batizado"…)
-- * Cada evento tem o próprio grupo de acesso: quem entrou por ele vê o
--   álbum do evento (memórias aprovadas, visibilidade "família"), e mais nada.
-- * Tokens podem ser de uma PESSOA (opcionalmente ligada a um evento) ou
--   IMPESSOAIS (de mesa): quem encosta o celular entra como convidado do
--   evento, dizendo só o nome. Fechar o evento para de aceitar convidados.
-- * Convidado nunca vira administrador e não entra no grupo da família.
-- =====================================================================

insert into public.relationship_types (key, label, sort_order)
values ('convidado', 'Convidados de evento', 90)
on conflict (key) do nothing;

create table public.vault_events (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  event_date date,
  description text check (char_length(description) <= 1000),
  status text not null default 'open' check (status in ('open', 'closed', 'archived')),
  access_group_id uuid not null unique references public.access_groups (id),
  max_guests int not null default 500 check (max_guests between 1 and 5000),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vault_events_vault_idx on public.vault_events (vault_id, event_date);
create trigger vault_events_updated_at before update on public.vault_events
  for each row execute function public.set_updated_at();
create trigger vault_events_freeze_vault before update on public.vault_events
  for each row execute function public.freeze_vault_id();

alter table public.memories add column event_id uuid references public.vault_events (id) on delete set null;
alter table public.nfc_tokens add column event_id uuid references public.vault_events (id) on delete set null;
alter table public.people add column joined_event_id uuid references public.vault_events (id) on delete set null;
create index memories_event_idx on public.memories (event_id) where event_id is not null;

-- O grupo do evento não pode trocar; o baú também não.
create or replace function public.guard_vault_events()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.access_group_id is distinct from old.access_group_id then
    raise exception 'access_group_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger vault_events_guard before update on public.vault_events
  for each row execute function public.guard_vault_events();

-- Mesmas regras de "tudo no mesmo baú", agora com eventos
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
    if new.event_id is not null
       and (select vault_id from public.vault_events where id = new.event_id) is distinct from new.vault_id then
      raise exception 'event must belong to the vault' using errcode = '42501';
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
    if new.event_id is not null
       and (select vault_id from public.vault_events where id = new.event_id) is distinct from new.vault_id then
      raise exception 'event must belong to the vault' using errcode = '42501';
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
  elsif tg_table_name = 'people' then
    if new.joined_event_id is not null
       and (select vault_id from public.vault_events where id = new.joined_event_id) is distinct from new.vault_id then
      raise exception 'event must belong to the vault' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger people_same_vault after insert or update of joined_event_id on public.people
  for each row execute function public.check_same_vault();

-- A pessoa atual participa deste evento?
create or replace function public.in_vault_event(p_event uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_events e
    join public.access_group_members m on m.group_id = e.access_group_id
    where e.id = p_event and m.person_id = public.vault_person_id(e.vault_id)
  )
$$;

-- Visibilidade: "família" também vale para os participantes do evento da memória
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
                       or (m.event_id is not null and public.in_vault_event(m.event_id))
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

alter table public.vault_events enable row level security;
create policy events_admin on public.vault_events for all to authenticated
  using (public.is_vault_admin(vault_id)) with check (public.is_vault_admin(vault_id));
-- Família vê todos os eventos do baú; convidado vê só o(s) seu(s)
create policy events_member_read on public.vault_events for select to authenticated
  using (public.in_vault_family(vault_id) or public.in_vault_event(id));

-- ---------------------------------------------------------------- RPCs
create or replace function public.admin_create_event(
  p_vault_id uuid, p_name text, p_event_date date default null, p_description text default null
) returns public.vault_events
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_vault_admin(p_vault_id);
  v_id uuid := gen_random_uuid();
  v_group uuid;
  e public.vault_events;
begin
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'event name required' using errcode = '22023';
  end if;
  insert into public.access_groups (vault_id, name, description, created_by)
  values (p_vault_id, 'evento:' || v_id, 'Convidados de ' || left(trim(p_name), 80), v_admin)
  returning id into v_group;
  insert into public.vault_events (id, vault_id, name, event_date, description, access_group_id, created_by)
  values (v_id, p_vault_id, left(trim(p_name), 80), p_event_date, nullif(trim(p_description), ''), v_group, v_admin)
  returning * into e;
  perform public.log_admin_event(p_vault_id, 'event.create', 'vault_events', v_id::text, jsonb_build_object('name', e.name));
  return e;
end;
$$;

-- Tokens: agora com evento opcional. Impessoal = sem pessoa + com evento.
drop function public.admin_create_nfc_token(uuid, uuid, text, uuid, boolean);
create or replace function public.admin_create_nfc_token(
  p_vault_id uuid, p_person_id uuid default null, p_label text default null,
  p_invitation_id uuid default null, p_activate boolean default true, p_event_id uuid default null
) returns public.nfc_tokens
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_vault_admin(p_vault_id);
  t public.nfc_tokens;
begin
  insert into public.nfc_tokens (vault_id, public_id, person_id, invitation_id, label, status, activated_at, created_by, event_id)
  values (
    p_vault_id, public.random_token(15), p_person_id, p_invitation_id, p_label,
    case when p_activate then 'active' else 'prepared' end,
    case when p_activate then now() end, v_admin, p_event_id
  ) returning * into t;
  -- Dono do ursinho ligado a um evento já participa dele
  if p_person_id is not null and p_event_id is not null then
    insert into public.access_group_members (group_id, person_id, added_by)
    select e.access_group_id, p_person_id, v_admin from public.vault_events e where e.id = p_event_id
    on conflict do nothing;
  end if;
  return t;
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
  insert into public.nfc_tokens (vault_id, public_id, person_id, invitation_id, label, status, activated_at, created_by, notes, event_id)
  values (old_t.vault_id, public.random_token(15), old_t.person_id, old_t.invitation_id, old_t.label, 'active', now(), v_admin,
          'Substitui o token ' || old_t.public_id, old_t.event_id)
  returning * into new_t;
  update public.nfc_tokens set status = 'replaced', revoked_at = now(), replaced_by_token_id = new_t.id
  where id = old_t.id;
  return new_t;
end;
$$;

-- O que a página do token precisa saber (sem expor nada além disso)
drop function public.resolve_nfc_token(text);
create or replace function public.resolve_nfc_token(p_public_id text)
returns table (state text, is_my_token boolean, greeting_name text, vault_id uuid,
               token_kind text, event_id uuid, event_name text, vault_title text)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  t public.nfc_tokens;
  e public.vault_events;
  v_person uuid;
  v_kind text;
  v_mine boolean;
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{16,64}$' then
    return query select 'unavailable'::text, false, null::text, null::uuid, null::text, null::uuid, null::text, null::text;
    return;
  end if;
  select * into t from public.nfc_tokens where public_id = p_public_id;
  if t.id is null or t.status <> 'active'
     or not exists (select 1 from public.vaults v where v.id = t.vault_id and v.status <> 'archived') then
    return query select 'unavailable'::text, false, null::text, null::uuid, null::text, null::uuid, null::text, null::text;
    return;
  end if;
  if t.event_id is not null then
    select * into e from public.vault_events where id = t.event_id;
  end if;
  v_kind := case when t.person_id is not null then 'person' when t.event_id is not null then 'guest' else 'campaign' end;
  update public.nfc_tokens set last_scanned_at = now() where id = t.id;
  v_person := public.vault_person_id(t.vault_id);
  -- Token de mesa: "é meu" quando a pessoa já participa do evento
  v_mine := v_person is not null and (
    (v_kind = 'person' and v_person = t.person_id)
    or (v_kind = 'guest' and public.in_vault_event(t.event_id))
  );
  if v_kind = 'guest' and not v_mine and (e.id is null or e.status <> 'open') then
    return query select 'closed'::text, false, null::text, null::uuid, v_kind, null::uuid, e.name, null::text;
    return;
  end if;
  return query
    select 'active'::text,
           v_mine,
           case when v_mine then (select split_part(p.display_name, ' ', 1) from public.people p where p.id = v_person) end,
           case when v_mine then t.vault_id end,
           v_kind,
           case when v_kind = 'guest' then e.id end,
           e.name,
           case when v_kind = 'guest' then (select v.title from public.vaults v where v.id = t.vault_id) end;
end;
$$;

-- Ao vincular a pessoa do ursinho, ela entra também no evento do token
create or replace function public.nfc_link_event(p_public_id text, p_person_id uuid)
returns void
language sql security definer
set search_path = ''
as $$
  insert into public.access_group_members (group_id, person_id, added_by)
  select e.access_group_id, p_person_id, t.created_by
  from public.nfc_tokens t join public.vault_events e on e.id = t.event_id
  where t.public_id = p_public_id and t.person_id = p_person_id
  on conflict do nothing
$$;

-- Convidado entra pelo token de mesa. Executado só pelo backend.
create or replace function public.nfc_guest_join(p_public_id text, p_auth_user_id uuid, p_display_name text)
returns table (person_id uuid, vault_id uuid, event_id uuid)
language plpgsql security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  t public.nfc_tokens;
  e public.vault_events;
  v_profile uuid;
  v_person uuid;
  v_name text := left(trim(coalesce(p_display_name, '')), 60);
begin
  if char_length(v_name) = 0 then
    raise exception 'name required' using errcode = '22023';
  end if;
  select * into t from public.nfc_tokens where public_id = p_public_id and status = 'active';
  if t.id is null or t.person_id is not null or t.event_id is null then
    raise exception 'token unavailable' using errcode = '42501';
  end if;
  select * into e from public.vault_events where id = t.event_id for update;
  if e.status <> 'open'
     or not exists (select 1 from public.vaults v where v.id = t.vault_id and v.status = 'active') then
    raise exception 'event closed' using errcode = '42501';
  end if;

  select id into v_profile from public.profiles where auth_user_id = p_auth_user_id;
  if v_profile is null then
    insert into public.profiles (auth_user_id, display_name, status) values (p_auth_user_id, v_name, 'active')
    returning id into v_profile;
  end if;

  select id into v_person from public.people where vault_id = t.vault_id and profile_id = v_profile;
  if v_person is not null then
    if (select status from public.people where id = v_person) <> 'active' then
      raise exception 'person unavailable' using errcode = '42501';
    end if;
  else
    -- Freio contra abuso do link da mesa
    if (select count(*) from public.people where joined_event_id = e.id) >= e.max_guests then
      raise exception 'event is full' using errcode = '53400';
    end if;
    if (select count(*) from public.people where joined_event_id = e.id and created_at > now() - interval '1 minute') >= 30 then
      raise exception 'too many requests' using errcode = '53400';
    end if;
    insert into public.people (vault_id, display_name, relationship_type, profile_id, status, joined_event_id, created_by)
    values (t.vault_id, v_name, 'convidado', v_profile, 'active', e.id, t.created_by)
    returning id into v_person;
    insert into public.person_roles (vault_id, profile_id, role, created_by)
    values (t.vault_id, v_profile, 'contributor', t.created_by) on conflict do nothing;
    insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;
  end if;

  insert into public.access_group_members (group_id, person_id, added_by)
  values (e.access_group_id, v_person, t.created_by) on conflict do nothing;
  update public.nfc_tokens set activated_at = coalesce(activated_at, now()) where id = t.id;
  insert into public.audit_events (vault_id, actor_profile_id, action, resource_type, resource_id, metadata)
  values (t.vault_id, v_profile, 'nfc.guest_join', 'vault_events', e.id::text, jsonb_build_object('person_id', v_person));
  return query select v_person, t.vault_id, e.id;
end;
$$;

-- Planos: eventos dentro do baú
update public.plans set features = features || '["1 evento (ex.: chá de bebê)"]'::jsonb,
  limits = limits || '{"events": 1}'::jsonb where key = 'gratis';
update public.plans set features = features || '["Até 3 eventos por ano (1 ano, chá bar, batizado…)"]'::jsonb,
  limits = limits || '{"events": 3}'::jsonb where key = 'ninho';
update public.plans set features = features || '["Eventos ilimitados com tokens de mesa"]'::jsonb,
  limits = limits || '{"events": null}'::jsonb where key in ('familia', 'legado');

-- ------------------------------------------------------------ permissões
revoke execute on function
  public.guard_vault_events(), public.in_vault_event(uuid),
  public.admin_create_event(uuid, text, date, text),
  public.admin_create_nfc_token(uuid, uuid, text, uuid, boolean, uuid),
  public.resolve_nfc_token(text), public.nfc_link_event(text, uuid), public.nfc_guest_join(text, uuid, text)
from public, anon, authenticated;

grant execute on function public.resolve_nfc_token(text) to anon, authenticated;
grant execute on function
  public.guard_vault_events(), public.in_vault_event(uuid),
  public.admin_create_event(uuid, text, date, text),
  public.admin_create_nfc_token(uuid, uuid, text, uuid, boolean, uuid)
to authenticated;
grant execute on function public.nfc_link_event(text, uuid), public.nfc_guest_join(text, uuid, text) to service_role;
