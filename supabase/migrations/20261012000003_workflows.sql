-- =====================================================================
-- Maya Memories — fluxos de negócio (RPCs)
-- Cada RPC verifica a autorização internamente; o frontend nunca decide.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Utilitários internos
-- ---------------------------------------------------------------------
create or replace function public.random_token(p_bytes int default 24)
returns text
language sql volatile
set search_path = ''
as $$
  select rtrim(translate(encode(extensions.gen_random_bytes(p_bytes), 'base64'), '+/', '-_'), '=')
$$;

create or replace function public.hash_secret(p_secret text)
returns bytea
language sql immutable
set search_path = ''
as $$ select extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256') $$;

create or replace function public.require_admin()
returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return public.current_profile_id();
end;
$$;

create or replace function public.auth_email()
returns text
language sql stable security definer
set search_path = ''
as $$
  select lower(u.email) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null
$$;

create or replace function public.enqueue_notification(
  p_event text, p_recipient uuid, p_payload jsonb, p_dedupe text, p_available_at timestamptz default now()
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  if p_recipient is not null then
    select lower(u.email) into v_email
    from public.profiles p join auth.users u on u.id = p.auth_user_id
    where p.id = p_recipient and p.status = 'active';
    if v_email is null then
      return;
    end if;
  end if;
  insert into public.notification_jobs (event_type, recipient_profile_id, payload, dedupe_key, available_at)
  values (p_event, p_recipient, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('to_email', v_email), p_dedupe, p_available_at)
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function public.notify_admins(p_event text, p_payload jsonb, p_dedupe text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  r record;
begin
  for r in select distinct profile_id from public.person_roles where role = 'admin' and revoked_at is null loop
    perform public.enqueue_notification(p_event, r.profile_id, p_payload, p_dedupe || ':' || r.profile_id::text);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Inicialização segura do primeiro administrador (somente service role)
-- ---------------------------------------------------------------------
create or replace function public.bootstrap_first_admin(
  p_email text, p_display_name text, p_relationship text default 'pai'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_profile uuid;
  v_person uuid;
begin
  if exists (select 1 from public.person_roles where role = 'admin' and revoked_at is null) then
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
  select id into v_person from public.people where profile_id = v_profile;
  if v_person is null then
    insert into public.people (display_name, relationship_type, profile_id, status)
    values (p_display_name, p_relationship, v_profile, 'active') returning id into v_person;
  end if;
  insert into public.person_roles (profile_id, role) values (v_profile, 'admin'), (v_profile, 'contributor')
  on conflict do nothing;
  insert into public.access_group_members (group_id, person_id)
  select id, v_person from public.access_groups where is_default_family
  on conflict do nothing;
  insert into public.audit_events (actor_profile_id, action, resource_type, resource_id, metadata)
  values (null, 'admin.bootstrap', 'profile', v_profile::text, '{}'::jsonb);
  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------
-- Papéis (somente admin; ninguém se promove sozinho)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_person_id uuid, p_role text, p_enabled boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_profile uuid;
begin
  if p_role not in ('admin', 'contributor', 'future_subject') then
    raise exception 'invalid role';
  end if;
  select profile_id into v_profile from public.people where id = p_person_id;
  if v_profile is null then
    raise exception 'person has no active account yet';
  end if;
  if p_enabled then
    insert into public.person_roles (profile_id, role, created_by) values (v_profile, p_role, v_admin)
    on conflict do nothing;
  else
    if p_role = 'admin' and v_profile = v_admin then
      raise exception 'you cannot remove your own admin role';
    end if;
    if p_role = 'admin' and (select count(*) from public.person_roles where role = 'admin' and revoked_at is null) <= 1 then
      raise exception 'at least one administrator must remain';
    end if;
    update public.person_roles set revoked_at = now(), revoked_by = v_admin
    where profile_id = v_profile and role = p_role and revoked_at is null;
  end if;
end;
$$;

create or replace function public.admin_set_person_status(p_person_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_profile uuid;
begin
  if p_status not in ('active', 'suspended', 'archived') then
    raise exception 'invalid status';
  end if;
  update public.people set status = p_status where id = p_person_id returning profile_id into v_profile;
  if v_profile = v_admin and p_status <> 'active' then
    raise exception 'you cannot suspend yourself';
  end if;
  if v_profile is not null then
    update public.profiles set status = case when p_status = 'active' then 'active' else 'suspended' end
    where id = v_profile;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------
create or replace function public.admin_create_invitation(
  p_person_id uuid, p_email text default null, p_expires_in_days int default 30, p_add_to_family boolean default true
) returns table (invitation_id uuid, secret text)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_secret text := public.random_token(24);
  v_id uuid;
begin
  if p_expires_in_days < 1 or p_expires_in_days > 365 then
    raise exception 'expiration must be between 1 and 365 days';
  end if;
  insert into public.invitations (person_id, email, token_hash, access_group_id, expires_at, created_by)
  values (
    p_person_id, nullif(lower(trim(p_email)), ''), public.hash_secret(v_secret),
    case when p_add_to_family then (select id from public.access_groups where is_default_family) end,
    now() + make_interval(days => p_expires_in_days), v_admin
  ) returning id into v_id;
  -- O segredo em texto puro é devolvido UMA vez e não é armazenado.
  return query select v_id, v_secret;
end;
$$;

create or replace function public.find_valid_invitation(p_secret text)
returns public.invitations
language sql stable security definer
set search_path = ''
as $$
  select i.* from public.invitations i
  where i.token_hash = public.hash_secret(p_secret)
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
$$;
revoke all on function public.find_valid_invitation(text) from public;

-- Consulta pública mínima: o convite é válido? (nunca revela e-mail)
create or replace function public.check_invitation(p_secret text)
returns table (valid boolean, first_name text, requires_email_match boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  i public.invitations;
begin
  if p_secret is null or length(p_secret) < 20 then
    return query select false, null::text, false;
    return;
  end if;
  i := public.find_valid_invitation(p_secret);
  if i.id is null then
    return query select false, null::text, false;
    return;
  end if;
  return query
    select true, split_part(p.display_name, ' ', 1), i.email is not null
    from public.people p where p.id = i.person_id;
end;
$$;

create or replace function public.invitation_email_allowed(p_secret text, p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select i.email is null or i.email = lower(trim(p_email))
    from public.find_valid_invitation(p_secret) i where i.id is not null
  ), false)
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
  select id into v_current_person from public.people where profile_id = v_profile;
  if v_current_person is not null and v_current_person <> i.person_id then
    raise exception 'account already linked to another person' using errcode = '42501';
  end if;
  update public.people set profile_id = v_profile, status = 'active' where id = i.person_id and status in ('invited', 'active');
  if not found then
    raise exception 'person is not available' using errcode = '42501';
  end if;
  update public.profiles set display_name = (select display_name from public.people where id = i.person_id)
  where id = v_profile and display_name = split_part(public.auth_email(), '@', 1);
  insert into public.person_roles (profile_id, role, created_by) values (v_profile, 'contributor', i.created_by)
  on conflict do nothing;
  if i.access_group_id is not null then
    insert into public.access_group_members (group_id, person_id, added_by)
    values (i.access_group_id, i.person_id, i.created_by) on conflict do nothing;
  end if;
  update public.invitations set accepted_at = now(), accepted_by_profile_id = v_profile where id = i.id;
  insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;
  perform public.notify_admins('invitation.accepted', jsonb_build_object('person_id', i.person_id), 'invitation.accepted:' || i.id::text);
  return i.person_id;
end;
$$;
revoke all on function public.link_invitation(public.invitations) from public;

create or replace function public.accept_invitation(p_secret text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  i public.invitations;
  v_email text := public.auth_email();
begin
  if auth.uid() is null or v_email is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  i := public.find_valid_invitation(p_secret);
  if i.id is null then
    raise exception 'invitation invalid or expired' using errcode = 'P0002';
  end if;
  if i.email is not null and i.email <> v_email then
    raise exception 'invitation belongs to another e-mail' using errcode = '42501';
  end if;
  return public.link_invitation(i);
end;
$$;

-- Aceita convites pendentes cujo e-mail é o do usuário autenticado
-- (a posse do e-mail foi comprovada pelo link mágico).
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
  for i in
    select * from public.invitations
    where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at desc limit 1
  loop
    perform public.link_invitation(i);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

-- Usado pelo backend (service role) para decidir se pode criar conta
create or replace function public.email_has_pending_invitation(p_email text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.invitations
    where email = lower(trim(p_email)) and accepted_at is null and revoked_at is null and expires_at > now()
  )
$$;

-- ---------------------------------------------------------------------
-- NFC
-- ---------------------------------------------------------------------
create or replace function public.admin_create_nfc_token(
  p_person_id uuid default null, p_label text default null, p_invitation_id uuid default null, p_activate boolean default true
) returns public.nfc_tokens
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  t public.nfc_tokens;
begin
  insert into public.nfc_tokens (public_id, person_id, invitation_id, label, status, activated_at, created_by)
  values (
    public.random_token(15), p_person_id, p_invitation_id, p_label,
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
  v_admin uuid := public.require_admin();
  v_current text;
begin
  select status into v_current from public.nfc_tokens where id = p_token_id for update;
  if v_current is null then
    raise exception 'token not found';
  end if;
  if v_current in ('revoked', 'replaced') then
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

-- Chaveiro perdido: revoga o antigo e cria um novo para a mesma pessoa.
-- As memórias pertencem à pessoa, não ao token: nada se perde.
create or replace function public.admin_replace_nfc_token(p_token_id uuid)
returns public.nfc_tokens
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  old_t public.nfc_tokens;
  new_t public.nfc_tokens;
begin
  select * into old_t from public.nfc_tokens where id = p_token_id for update;
  if old_t.id is null then
    raise exception 'token not found';
  end if;
  if old_t.status = 'replaced' then
    raise exception 'token already replaced';
  end if;
  insert into public.nfc_tokens (public_id, person_id, invitation_id, label, status, activated_at, created_by, notes)
  values (public.random_token(15), old_t.person_id, old_t.invitation_id, old_t.label, 'active', now(), v_admin,
          'Substitui o token ' || old_t.public_id)
  returning * into new_t;
  update public.nfc_tokens set status = 'replaced', revoked_at = now(), replaced_by_token_id = new_t.id
  where id = old_t.id;
  return new_t;
end;
$$;

-- Resolução pública do NFC: nunca concede acesso, nunca cria visita.
create or replace function public.resolve_nfc_token(p_public_id text)
returns table (state text, is_my_token boolean, greeting_name text)
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.nfc_tokens;
  v_person uuid := public.current_person_id();
begin
  if p_public_id is null or p_public_id !~ '^[A-Za-z0-9_-]{16,64}$' then
    return query select 'unavailable'::text, false, null::text;
    return;
  end if;
  select * into t from public.nfc_tokens where public_id = p_public_id;
  if t.id is null or t.status <> 'active' then
    return query select 'unavailable'::text, false, null::text;
    return;
  end if;
  update public.nfc_tokens set last_scanned_at = now() where id = t.id;
  return query
    select 'active'::text,
           (v_person is not null and v_person = t.person_id),
           case when v_person is not null and v_person = t.person_id
                then (select split_part(p.display_name, ' ', 1) from public.people p where p.id = t.person_id) end;
end;
$$;

-- ---------------------------------------------------------------------
-- Presença e consentimento
-- ---------------------------------------------------------------------
create or replace function public.touch_last_seen()
returns void
language sql security definer
set search_path = ''
as $$
  update public.profiles set last_seen_at = now()
  where auth_user_id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;

create or replace function public.has_active_consent(p_type text, p_version text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select c.status = 'granted' and c.policy_version = p_version
    from public.consents c
    where c.person_id = public.current_person_id() and c.consent_type = p_type
    order by c.created_at desc limit 1
  ), false)
$$;

-- ---------------------------------------------------------------------
-- Memórias: envio, retirada e moderação
-- ---------------------------------------------------------------------
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
  if not public.can_contribute() then
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
  perform public.notify_admins('memory.submitted',
    jsonb_build_object('memory_id', m.id, 'memory_type', m.memory_type),
    'memory.submitted:' || m.id::text || ':' || extract(epoch from now())::bigint::text);
  return 'pending_review';
end;
$$;

-- Contribuinte retira algo ainda não publicado, ou pede exclusão do publicado
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
     or (m.created_by_profile_id <> v_profile and m.author_person_id is distinct from public.current_person_id()) then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if m.moderation_status in ('approved', 'hidden') then
    insert into public.data_deletion_requests (requested_by, memory_id, reason)
    values (v_profile, m.id, left(p_reason, 2000));
    perform public.notify_admins('deletion.requested', jsonb_build_object('memory_id', m.id),
      'deletion.requested:' || m.id::text || ':' || v_profile::text);
    return 'requested';
  end if;
  update public.memories set moderation_status = 'removed', deleted_at = now() where id = m.id;
  update public.visits set status = 'removed' where memory_id = m.id;
  delete from public.capsule_items where memory_id = m.id;
  perform public.write_audit('memory.withdrawn_by_author', 'memories', m.id::text, '{}'::jsonb);
  return 'removed';
end;
$$;

create or replace function public.moderate_memory(p_memory_id uuid, p_action text, p_note text default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  m public.memories;
  v_status text;
begin
  select * into m from public.memories where id = p_memory_id for update;
  if m.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  v_status := case p_action
    when 'approve' then 'approved'
    when 'reject' then 'rejected'
    when 'request_changes' then 'changes_requested'
    when 'hide' then 'hidden'
    when 'remove' then 'removed'
    when 'restore' then 'approved'
    else null end;
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
  -- Aprovar a memória pedida em uma cápsula a inclui na cápsula
  if v_status = 'approved' and m.requested_capsule_id is not null then
    insert into public.capsule_items (capsule_id, memory_id, added_by)
    values (m.requested_capsule_id, m.id, v_admin) on conflict do nothing;
  end if;
  perform public.write_audit('memory.' || p_action, 'memories', m.id::text,
    jsonb_build_object('from', m.moderation_status, 'to', v_status));
  if v_status in ('approved', 'rejected', 'changes_requested')
     and m.created_by_profile_id <> v_admin
     and coalesce((select on_contribution_reviewed from public.notification_preferences
                   where profile_id = m.created_by_profile_id), true) then
    perform public.enqueue_notification('memory.' || v_status, m.created_by_profile_id,
      jsonb_build_object('memory_id', m.id, 'note', p_note),
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
  v_admin uuid := public.require_admin();
  v_status text := case p_action when 'approve' then 'approved' when 'reject' then 'rejected'
                                 when 'hide' then 'hidden' when 'remove' then 'removed' end;
begin
  if v_status is null then
    raise exception 'invalid action';
  end if;
  update public.memory_comments set status = v_status, moderated_by = v_admin, moderated_at = now(),
    deleted_at = case when v_status = 'removed' then now() end
  where id = p_comment_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return v_status;
end;
$$;

create or replace function public.resolve_deletion_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  r public.data_deletion_requests;
begin
  select * into r from public.data_deletion_requests where id = p_request_id and status = 'pending' for update;
  if r.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if p_accept and r.memory_id is not null then
    perform public.moderate_memory(r.memory_id, 'remove', 'Removida a pedido do autor');
  end if;
  update public.data_deletion_requests
  set status = case when p_accept then 'completed' else 'declined' end, resolved_by = v_admin, resolved_at = now()
  where id = r.id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cápsulas
-- ---------------------------------------------------------------------
create or replace function public.admin_open_capsule(p_capsule_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  c public.capsules;
begin
  select * into c from public.capsules where id = p_capsule_id for update;
  if c.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if c.opening_rule = 'date_and_manual' and (c.opens_at is null or c.opens_at > now()) then
    raise exception 'this capsule cannot be opened before its date' using errcode = '42501';
  end if;
  if c.opening_rule = 'date' and (c.opens_at is null or c.opens_at > now()) then
    raise exception 'this capsule opens automatically on its date' using errcode = '42501';
  end if;
  update public.capsules set status = 'opened', opened_at = now(), opened_by = v_admin where id = c.id;
  perform public.write_audit('capsule.opened', 'capsules', c.id::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_capsule_status(p_capsule_id uuid, p_status text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
begin
  if p_status not in ('draft', 'scheduled', 'sealed', 'archived') then
    raise exception 'invalid status';
  end if;
  update public.capsules set status = p_status,
    opened_at = case when p_status in ('sealed', 'draft') then null else opened_at end
  where id = p_capsule_id;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
end;
$$;

-- Marcos de crescimento sugeridos a partir da data de nascimento
create or replace function public.admin_generate_growth_capsules()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_admin uuid := public.require_admin();
  v_birth date := (select coalesce(birth_date, expected_birth_date) from public.app_settings);
  v_name text := (select subject_name from public.app_settings);
  v_count int := 0;
  r record;
begin
  if v_birth is null then
    raise exception 'set the birth date (or expected date) in settings first';
  end if;
  for r in
    select * from (values (interval '3 months', '3 meses'), (interval '6 months', '6 meses')) as v(i, label)
    union all
    select make_interval(years => y), case when y = 1 then '1 ano' else y || ' anos' end
    from generate_series(1, 15) y
  loop
    if not exists (select 1 from public.capsules where capsule_type in ('growth', 'fifteen') and title = v_name || ' — ' || r.label) then
      insert into public.capsules (title, description, capsule_type, opens_at, opening_rule, status, created_by)
      values (
        v_name || ' — ' || r.label,
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

-- ---------------------------------------------------------------------
-- Painel administrativo
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'people', (select count(*) from public.people where status <> 'archived'),
    'active_people', (select count(*) from public.people where status = 'active'),
    'pending_invitations', (select count(*) from public.invitations where accepted_at is null and revoked_at is null and expires_at > now()),
    'confirmed_visits', (select count(*) from public.visits where status = 'approved'),
    'pending_review', (select count(*) from public.memories where moderation_status = 'pending_review' and deleted_at is null),
    'pending_comments', (select count(*) from public.memory_comments where status = 'pending_review' and deleted_at is null),
    'pending_deletions', (select count(*) from public.data_deletion_requests where status = 'pending'),
    'photos_videos', (select count(*) from public.media_assets where media_type in ('image', 'video') and processing_status = 'ready'),
    'future_letters', (select count(*) from public.memories where memory_type = 'letter' and unlock_at > now() and deleted_at is null),
    'open_capsules', (select count(*) from public.capsules c where public.capsule_is_open(c.id)),
    'next_capsules', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, title, opens_at from public.capsules
        where status in ('scheduled', 'sealed') and opens_at > now() order by opens_at limit 5) x),
    'failed_uploads', (select count(*) from public.media_assets where processing_status = 'failed'),
    'storage_bytes', (select coalesce(sum(size_bytes), 0) from public.media_assets where processing_status <> 'deleted'),
    'recent_admin_activity', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select a.action, a.resource_type, a.created_at, p.display_name as actor
        from public.audit_events a left join public.profiles p on p.id = a.actor_profile_id
        order by a.created_at desc limit 8) x)
  );
end;
$$;

-- Indicadores separados: acesso ≠ contribuição ≠ visita
create or replace function public.admin_people_overview()
returns table (
  person_id uuid, display_name text, relationship_type text, status text, has_account boolean,
  roles text[], in_family boolean, last_portal_access timestamptz, last_contribution timestamptz,
  last_confirmed_visit date, last_interaction timestamptz, pending_invitation boolean, created_at timestamptz
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select p.id, p.display_name, p.relationship_type, p.status, p.profile_id is not null,
    coalesce((select array_agg(r.role order by r.role) from public.person_roles r
              where r.profile_id = p.profile_id and r.revoked_at is null), '{}'),
    exists (select 1 from public.access_group_members gm join public.access_groups g on g.id = gm.group_id
            where g.is_default_family and gm.person_id = p.id),
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
  order by p.display_name;
end;
$$;

-- ---------------------------------------------------------------------
-- Automação (n8n via backend com service role)
-- ---------------------------------------------------------------------
create or replace function public.claim_notification_jobs(p_limit int default 20)
returns setof public.notification_jobs
language sql security definer
set search_path = ''
as $$
  update public.notification_jobs j
  set status = 'processing', locked_at = now(), attempts = attempts + 1
  where j.id in (
    select id from public.notification_jobs
    where (status = 'pending' and available_at <= now())
       or (status = 'processing' and locked_at < now() - interval '15 minutes')
    order by available_at
    limit least(greatest(p_limit, 1), 100)
    for update skip locked
  )
  returning j.*;
$$;

create or replace function public.complete_notification_job(p_job_id uuid, p_success boolean, p_error text default null)
returns void
language sql security definer
set search_path = ''
as $$
  update public.notification_jobs set
    status = case when p_success then 'sent' when attempts >= 5 then 'failed' else 'pending' end,
    last_error = left(p_error, 1000),
    processed_at = case when p_success or attempts >= 5 then now() end,
    available_at = case when p_success then available_at else now() + make_interval(mins => power(2, attempts)::int) end,
    locked_at = null
  where id = p_job_id and status = 'processing';
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
    select id, title, opens_at from public.capsules
    where status = 'scheduled' and opens_at between now() and now() + make_interval(days => p_days)
  loop
    for r in
      select distinct p.profile_id from public.people p
      join public.access_group_members gm on gm.person_id = p.id
      join public.access_groups g on g.id = gm.group_id and g.is_default_family
      left join public.notification_preferences np on np.profile_id = p.profile_id
      where p.profile_id is not null and p.status = 'active' and coalesce(np.on_capsule_opening, true)
    loop
      perform public.enqueue_notification('capsule.upcoming', r.profile_id,
        jsonb_build_object('capsule_id', c.id, 'title', c.title, 'opens_at', c.opens_at),
        'capsule.upcoming:' || c.id::text || ':' || r.profile_id::text);
      v_count := v_count + 1;
    end loop;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissões de execução
-- Supabase concede EXECUTE a anon/authenticated por padrão: revogamos tudo
-- e liberamos apenas o necessário.
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Funções públicas (sem login): apenas consultas mínimas e seguras
grant execute on function public.check_invitation(text) to anon, authenticated;
grant execute on function public.invitation_email_allowed(text, text) to anon, authenticated;
grant execute on function public.resolve_nfc_token(text) to anon, authenticated;

-- Funções para usuários autenticados (cada uma valida o papel internamente)
grant execute on function
  public.current_profile_id(), public.current_person_id(), public.has_role(text), public.is_admin(),
  public.is_member(), public.can_contribute(), public.is_in_family(), public.has_grant(text, uuid),
  public.capsule_is_open(uuid), public.capsule_listable(uuid), public.capsule_viewable(uuid),
  public.capsule_condition_met(public.capsules), public.memory_viewable(uuid),
  public.log_admin_event(text, text, text, jsonb),
  public.accept_invitation(text), public.accept_invitations_for_my_email(),
  public.touch_last_seen(), public.has_active_consent(text, text),
  public.submit_memory(uuid), public.request_memory_removal(uuid, text),
  public.moderate_memory(uuid, text, text), public.moderate_comment(uuid, text),
  public.resolve_deletion_request(uuid, boolean),
  public.admin_set_role(uuid, text, boolean), public.admin_set_person_status(uuid, text),
  public.admin_create_invitation(uuid, text, int, boolean),
  public.admin_create_nfc_token(uuid, text, uuid, boolean), public.admin_set_nfc_status(uuid, text),
  public.admin_replace_nfc_token(uuid),
  public.admin_open_capsule(uuid), public.admin_set_capsule_status(uuid, text),
  public.admin_generate_growth_capsules(), public.admin_dashboard_stats(), public.admin_people_overview(),
  -- usadas por triggers/políticas no contexto do usuário
  public.set_updated_at(), public.is_end_user_request(), public.audit_row_change(), public.forbid_change(),
  public.guard_profiles(), public.guard_memories(), public.guard_media_assets(), public.guard_comments(),
  public.guard_visits(), public.guard_consents()
to authenticated;

-- Somente backend (service role)
grant execute on function
  public.bootstrap_first_admin(text, text, text), public.email_has_pending_invitation(text),
  public.claim_notification_jobs(int), public.complete_notification_job(uuid, boolean, text),
  public.enqueue_upcoming_capsule_notices(int)
to service_role;
