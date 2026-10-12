-- =====================================================================
-- Maya Memories — acesso direto pelo ursinho NFC
-- Decisão de produto: o token NFC é a identidade de UMA pessoa
-- (intransferível). Aproximar o celular entra direto como ela, sem e-mail.
-- Travas:
--   * só token ATIVO e vinculado a uma pessoa ativa/convidada;
--   * revogar/suspender/substituir o token corta novos acessos na hora;
--   * nunca concede papel de administrador (admins entram por e-mail);
--   * executado apenas pelo backend (service role).
-- =====================================================================

-- Quem é a pessoa deste token? (para o backend montar a sessão)
create or replace function public.nfc_login_target(p_public_id text)
returns table (person_id uuid, display_name text, auth_email text, invitation_email text, is_admin boolean)
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
              where r.profile_id = p.profile_id and r.role = 'admin' and r.revoked_at is null);
end;
$$;

-- Vincula a conta (criada pelo backend) à pessoa do token e garante o papel
-- de contribuinte. Idempotente.
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
  if exists (select 1 from public.person_roles where profile_id = v_profile and role = 'admin' and revoked_at is null) then
    raise exception 'admins must sign in by e-mail' using errcode = '42501';
  end if;
  if p.profile_id is null then
    update public.people set profile_id = v_profile, status = 'active' where id = p.id;
    update public.profiles set display_name = p.display_name, status = 'active' where id = v_profile;
    -- Grupo: o do convite ligado ao token, senão a família
    select coalesce(
      (select i.access_group_id from public.invitations i where i.id = t.invitation_id),
      (select g.id from public.access_groups g where g.is_default_family)
    ) into v_group;
    if v_group is not null then
      insert into public.access_group_members (group_id, person_id, added_by)
      values (v_group, p.id, t.created_by) on conflict do nothing;
    end if;
    update public.invitations set accepted_at = now(), accepted_by_profile_id = v_profile
    where person_id = p.id and accepted_at is null and revoked_at is null;
    insert into public.notification_preferences (profile_id) values (v_profile) on conflict do nothing;
  end if;
  insert into public.person_roles (profile_id, role, created_by) values (v_profile, 'contributor', t.created_by)
  on conflict do nothing;
  if t.activated_at is null then
    update public.nfc_tokens set activated_at = now() where id = t.id;
  end if;
  insert into public.audit_events (actor_profile_id, action, resource_type, resource_id, metadata)
  values (v_profile, 'nfc.direct_access', 'nfc_tokens', t.id::text, jsonb_build_object('person_id', p.id));
  return p.id;
end;
$$;

revoke execute on function public.nfc_login_target(text) from public, anon, authenticated;
revoke execute on function public.nfc_link_person(text, uuid) from public, anon, authenticated;
grant execute on function public.nfc_login_target(text), public.nfc_link_person(text, uuid) to service_role;
