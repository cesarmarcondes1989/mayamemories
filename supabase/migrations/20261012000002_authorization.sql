-- =====================================================================
-- Maya Memories — autorização (helpers, RLS, guardas de coluna, auditoria)
-- Princípio: tudo negado por padrão; liberado explicitamente.
-- Funções SECURITY DEFINER usam search_path vazio e nomes qualificados.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de identidade
-- ---------------------------------------------------------------------
create or replace function public.current_profile_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.id from public.profiles p
  where p.auth_user_id = auth.uid() and p.status = 'active'
$$;

create or replace function public.current_person_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select pe.id from public.people pe
  where pe.profile_id = public.current_profile_id() and pe.status = 'active'
$$;

create or replace function public.has_role(p_role text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.person_roles r
    where r.profile_id = public.current_profile_id()
      and r.role = p_role and r.scope = 'global' and r.revoked_at is null
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select public.has_role('admin') $$;

-- Quem pode participar (contribuinte ativo ou admin)
create or replace function public.is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_person_id() is not null
     and (public.has_role('contributor') or public.has_role('admin') or public.has_role('future_subject'))
$$;

create or replace function public.can_contribute()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.current_person_id() is not null
     and (public.has_role('contributor') or public.has_role('admin'))
$$;

create or replace function public.is_in_family()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.access_group_members m
    join public.access_groups g on g.id = m.group_id
    where g.is_default_family and m.person_id = public.current_person_id()
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
          where m.person_id = public.current_person_id()
        )
      )
  )
$$;

-- ---------------------------------------------------------------------
-- Cápsulas: elegibilidade avaliada A CADA acesso (não depende de job)
-- ---------------------------------------------------------------------
create or replace function public.capsule_condition_met(c public.capsules)
returns boolean
language sql stable
set search_path = ''
as $$
  select case c.opening_rule
    when 'date' then c.opens_at is not null and c.opens_at <= now()
    when 'manual' then c.opened_at is not null
    when 'date_and_manual' then c.opens_at is not null and c.opens_at <= now() and c.opened_at is not null
    else false
  end
$$;

create or replace function public.capsule_is_open(p_capsule_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select c.status in ('scheduled', 'eligible_to_open', 'opened') and public.capsule_condition_met(c)
    from public.capsules c where c.id = p_capsule_id
  ), false)
$$;

-- Pode ver os METADADOS da cápsula (título, data de abertura)
create or replace function public.capsule_listable(p_capsule_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when public.is_admin() then true
    when not public.is_member() then false
    else coalesce((
      select c.status in ('scheduled', 'sealed', 'eligible_to_open', 'opened')
        and case c.visibility_policy
              when 'family' then public.is_in_family() or public.has_grant('capsule', c.id)
              when 'selected' then public.has_grant('capsule', c.id)
              else false
            end
      from public.capsules c where c.id = p_capsule_id
    ), false)
  end
$$;

-- Pode ver o CONTEÚDO da cápsula (somente depois da condição de abertura)
create or replace function public.capsule_viewable(p_capsule_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_admin()
      or (public.capsule_listable(p_capsule_id) and public.capsule_is_open(p_capsule_id))
$$;

-- ---------------------------------------------------------------------
-- Memórias: regra central de visibilidade
-- ---------------------------------------------------------------------
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
  if public.is_admin() then
    return true;
  end if;
  -- O autor sempre vê o que enviou (inclusive status), salvo se removido.
  if (m.created_by_profile_id = v_profile or m.author_person_id = public.current_person_id())
     and m.moderation_status <> 'removed' and m.deleted_at is null then
    return true;
  end if;
  if m.deleted_at is not null or m.moderation_status <> 'approved' then
    return false;
  end if;
  if m.unlock_at is not null and m.unlock_at > now() then
    return false;
  end if;
  if not public.is_member() then
    return false;
  end if;
  return case m.visibility
    when 'family' then public.is_in_family() or public.has_grant('memory', m.id)
    when 'selected' then public.has_grant('memory', m.id)
    when 'private' then public.has_grant('memory', m.id)
    when 'capsule' then exists (
      select 1 from public.capsule_items ci
      where ci.memory_id = m.id and public.capsule_viewable(ci.capsule_id)
    )
    else false -- 'public' fica desativado no MVP
  end;
end;
$$;

-- ---------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text, p_resource_type text, p_resource_id text, p_metadata jsonb default '{}'::jsonb
) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.audit_events (actor_profile_id, action, resource_type, resource_id, metadata)
  values (public.current_profile_id(), p_action, p_resource_type, p_resource_id, coalesce(p_metadata, '{}'::jsonb));
$$;
revoke all on function public.write_audit(text, text, text, jsonb) from public;

-- Log explícito chamado pelo app (ex.: exportação). Somente admins.
create or replace function public.log_admin_event(
  p_action text, p_resource_type text, p_resource_id text default null, p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  perform public.write_audit(p_action, p_resource_type, p_resource_id, p_metadata);
end;
$$;

-- Trigger genérico: registra QUAIS colunas mudaram (sem conteúdo sensível)
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
  -- Transições de status e visibilidade são seguras de registrar
  foreach v_key in array array['status', 'moderation_status', 'visibility', 'processing_status', 'role'] loop
    if (v_new ? v_key or v_old ? v_key) and (v_new -> v_key) is distinct from (v_old -> v_key) then
      v_meta := v_meta || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
    end if;
  end loop;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'group_id');
  insert into public.audit_events (actor_profile_id, action, resource_type, resource_id, metadata)
  values (public.current_profile_id(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_id, v_meta);
  return coalesce(new, old);
end;
$$;

create trigger audit_person_roles after insert or update or delete on public.person_roles
  for each row execute function public.audit_row_change();
create trigger audit_people after insert or update or delete on public.people
  for each row execute function public.audit_row_change();
create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function public.audit_row_change();
create trigger audit_nfc_tokens after insert or update or delete on public.nfc_tokens
  for each row execute function public.audit_row_change();
create trigger audit_memories after update or delete on public.memories
  for each row execute function public.audit_row_change();
create trigger audit_comments after update or delete on public.memory_comments
  for each row execute function public.audit_row_change();
create trigger audit_visits after update or delete on public.visits
  for each row execute function public.audit_row_change();
create trigger audit_capsules after insert or update or delete on public.capsules
  for each row execute function public.audit_row_change();
create trigger audit_capsule_items after insert or delete on public.capsule_items
  for each row execute function public.audit_row_change();
create trigger audit_access_grants after insert or update or delete on public.access_grants
  for each row execute function public.audit_row_change();
create trigger audit_group_members after insert or delete on public.access_group_members
  for each row execute function public.audit_row_change();
create trigger audit_consents after insert or update on public.consents
  for each row execute function public.audit_row_change();
create trigger audit_settings after update on public.app_settings
  for each row execute function public.audit_row_change();
create trigger audit_profiles after update on public.profiles
  for each row execute function public.audit_row_change();

-- Auditoria é append-only, inclusive para admins
create or replace function public.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_events is append-only' using errcode = '42501';
end;
$$;
create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function public.forbid_change();

-- ---------------------------------------------------------------------
-- Guardas de coluna: o navegador não pode promover nem aprovar nada.
-- Rodam apenas para requisições diretas de usuários (roles anon/authenticated);
-- RPCs SECURITY DEFINER executam como dono e aplicam suas próprias regras.
-- ---------------------------------------------------------------------
create or replace function public.is_end_user_request()
returns boolean
language sql stable
set search_path = ''
as $$ select current_user in ('authenticated', 'anon') $$;

create or replace function public.guard_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if new.auth_user_id is distinct from old.auth_user_id
     or new.status is distinct from old.status
     or new.id is distinct from old.id
     or (new.last_seen_at is distinct from old.last_seen_at) then
    raise exception 'profile field not editable' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profiles();

create or replace function public.guard_memories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() then
    return new;
  end if;
  if public.is_admin() then
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
    new.author_person_id := public.current_person_id();
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

  -- UPDATE por contribuinte
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
  -- Editar algo já aprovado/rejeitado volta para revisão
  if old.moderation_status in ('approved', 'rejected', 'changes_requested') then
    new.moderation_status := 'pending_review';
    new.published_at := null;
    new.submitted_at := now();
  end if;
  return new;
end;
$$;
create trigger memories_guard before insert or update on public.memories
  for each row execute function public.guard_memories();

create or replace function public.guard_media_assets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    -- Somente o backend (service role) marca um arquivo como verificado
    if new.processing_status <> 'pending_upload' then
      raise exception 'assets start as pending_upload' using errcode = '42501';
    end if;
    new.created_by_profile_id := public.current_profile_id();
    if new.storage_path not like new.memory_id::text || '/%' then
      raise exception 'storage path must live under the memory folder' using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'assets are updated by the backend only' using errcode = '42501';
end;
$$;
create trigger media_assets_guard before insert or update on public.media_assets
  for each row execute function public.guard_media_assets();

create or replace function public.guard_comments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.created_by_profile_id := public.current_profile_id();
    new.author_person_id := public.current_person_id();
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
create trigger comments_guard before insert or update on public.memory_comments
  for each row execute function public.guard_comments();

create or replace function public.guard_visits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending_review';
    new.created_by := public.current_profile_id();
    new.person_id := public.current_person_id();
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
create trigger visits_guard before insert or update on public.visits
  for each row execute function public.guard_visits();

create or replace function public.guard_consents()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_end_user_request() or public.is_admin() then
    return new;
  end if;
  new.person_id := public.current_person_id();
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
create trigger consents_guard before insert on public.consents
  for each row execute function public.guard_consents();

-- ---------------------------------------------------------------------
-- Novo usuário do Auth => perfil sem nenhum papel (nenhum acesso)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (auth_user_id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Convidado'), 120)
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.relationship_types enable row level security;
alter table public.people enable row level security;
alter table public.person_roles enable row level security;
alter table public.access_groups enable row level security;
alter table public.access_group_members enable row level security;
alter table public.invitations enable row level security;
alter table public.nfc_tokens enable row level security;
alter table public.memories enable row level security;
alter table public.media_assets enable row level security;
alter table public.memory_comments enable row level security;
alter table public.visits enable row level security;
alter table public.capsules enable row level security;
alter table public.capsule_items enable row level security;
alter table public.consents enable row level security;
alter table public.access_grants enable row level security;
alter table public.data_deletion_requests enable row level security;
alter table public.audit_events enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_jobs enable row level security;

-- Configurações: membros leem; admins alteram
create policy settings_read on public.app_settings for select to authenticated
  using (public.is_member() or public.is_admin());
create policy settings_admin_update on public.app_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Perfis: o próprio, ou admin
create policy profiles_self_read on public.profiles for select to authenticated
  using (auth_user_id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update to authenticated
  using (auth_user_id = auth.uid() or public.is_admin())
  with check (auth_user_id = auth.uid() or public.is_admin());

-- Tipos de relacionamento: leitura para autenticados; admin gerencia
create policy rel_types_read on public.relationship_types for select to authenticated using (true);
create policy rel_types_admin on public.relationship_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Pessoas: admin vê tudo; membro vê a si mesmo e autores de conteúdos visíveis
create policy people_admin on public.people for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy people_member_read on public.people for select to authenticated
  using (
    public.is_member() and (
      id = public.current_person_id()
      or exists (select 1 from public.memories m where m.author_person_id = people.id and public.memory_viewable(m.id))
      or exists (select 1 from public.memory_comments c where c.author_person_id = people.id and c.status = 'approved'
                 and c.deleted_at is null and public.memory_viewable(c.memory_id))
    )
  );

-- Papéis: leitura do próprio; escrita SOMENTE via RPC administrativa
create policy roles_read on public.person_roles for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin());

-- Grupos
create policy groups_admin on public.access_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy group_members_admin on public.access_group_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy group_members_self on public.access_group_members for select to authenticated
  using (person_id = public.current_person_id());

-- Convites e tokens: somente admin (fluxos públicos usam RPCs dedicadas)
create policy invitations_admin on public.invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy nfc_admin on public.nfc_tokens for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Memórias
create policy memories_read on public.memories for select to authenticated
  using (public.memory_viewable(id));
create policy memories_insert on public.memories for insert to authenticated
  with check (
    public.is_admin()
    or (public.can_contribute() and created_by_profile_id = public.current_profile_id())
  );
create policy memories_update on public.memories for update to authenticated
  using (
    public.is_admin()
    or (created_by_profile_id = public.current_profile_id()
        and deleted_at is null
        and moderation_status in ('draft', 'uploading', 'processing', 'pending_review', 'changes_requested', 'approved', 'rejected'))
  )
  with check (public.is_admin() or created_by_profile_id = public.current_profile_id());

-- Arquivos: seguem a visibilidade da memória
create policy media_read on public.media_assets for select to authenticated
  using (public.memory_viewable(memory_id) and processing_status <> 'deleted');
create policy media_insert on public.media_assets for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.can_contribute()
      and exists (
        select 1 from public.memories m
        where m.id = memory_id
          and m.created_by_profile_id = public.current_profile_id()
          and m.moderation_status in ('draft', 'uploading', 'changes_requested')
          and m.deleted_at is null
      )
    )
  );
create policy media_admin_update on public.media_assets for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Comentários
create policy comments_read on public.memory_comments for select to authenticated
  using (
    public.is_admin()
    or (created_by_profile_id = public.current_profile_id() and deleted_at is null)
    or (status = 'approved' and deleted_at is null and public.memory_viewable(memory_id))
  );
create policy comments_insert on public.memory_comments for insert to authenticated
  with check (
    public.can_contribute()
    and exists (
      select 1 from public.memories m
      where m.id = memory_id and m.moderation_status = 'approved' and m.deleted_at is null
    )
    and public.memory_viewable(memory_id)
  );
create policy comments_update on public.memory_comments for update to authenticated
  using (public.is_admin() or (created_by_profile_id = public.current_profile_id() and status = 'pending_review'))
  with check (public.is_admin() or created_by_profile_id = public.current_profile_id());

-- Visitas: privadas (sem rankings); a pessoa vê as próprias
create policy visits_read on public.visits for select to authenticated
  using (public.is_admin() or person_id = public.current_person_id());
create policy visits_insert on public.visits for insert to authenticated
  with check (public.is_admin() or public.can_contribute());
create policy visits_update on public.visits for update to authenticated
  using (public.is_admin() or (person_id = public.current_person_id() and status = 'pending_review'))
  with check (public.is_admin() or person_id = public.current_person_id());

-- Cápsulas: metadados listáveis; conteúdo só após abertura
create policy capsules_read on public.capsules for select to authenticated
  using (public.capsule_listable(id));
create policy capsules_admin on public.capsules for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy capsule_items_read on public.capsule_items for select to authenticated
  using (public.capsule_viewable(capsule_id));
create policy capsule_items_admin on public.capsule_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Consentimentos
create policy consents_read on public.consents for select to authenticated
  using (public.is_admin() or person_id = public.current_person_id());
create policy consents_insert on public.consents for insert to authenticated
  with check (public.is_admin() or public.current_person_id() is not null);

-- Permissões específicas: admin gerencia; usuário vê as próprias
create policy grants_admin on public.access_grants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy grants_self on public.access_grants for select to authenticated
  using (grantee_profile_id = public.current_profile_id());

-- Pedidos de exclusão
create policy deletion_read on public.data_deletion_requests for select to authenticated
  using (public.is_admin() or requested_by = public.current_profile_id());
create policy deletion_admin on public.data_deletion_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Auditoria: somente leitura administrativa (inserção via funções)
create policy audit_admin_read on public.audit_events for select to authenticated
  using (public.is_admin());

-- Preferências de notificação: a própria pessoa
create policy notif_prefs_self on public.notification_preferences for all to authenticated
  using (profile_id = public.current_profile_id() or public.is_admin())
  with check (profile_id = public.current_profile_id());

-- Fila de notificações: somente admin lê (n8n usa service role no backend)
create policy notif_jobs_admin on public.notification_jobs for select to authenticated
  using (public.is_admin());

-- Nada para o papel anon nas tabelas: sem políticas => negado.
revoke all on all tables in schema public from anon;
