-- =====================================================================
-- Testes de autorização (especificação §14.3 e §19)
-- Executa dentro de uma transação revertida ao final.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Usuários de Auth (como o Supabase faria) — perfis criados por trigger
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'cesar@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'ana@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'vovo@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'tia@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'amigo@example.com'),
  ('00000000-0000-0000-0000-00000000000f', 'estranho@example.com');

select tests.expect_count('select 1 from public.profiles', 6, 'profiles auto-created for auth users');
select tests.expect_count('select 1 from public.person_roles', 0, 'new users start with no roles');

-- Primeiro admin: processo de inicialização (service role)
select public.bootstrap_first_admin('cesar@example.com', 'Cesar', 'pai');
select tests.expect_error($$ select public.bootstrap_first_admin('ana@example.com', 'Ana', 'mae') $$,
  'bootstrap cannot create a second admin');

-- ---------------------------------------------------------------------
-- Admin cria pessoas e convites
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_true(public.is_admin(), 'cesar is admin');

insert into public.people (id, display_name, relationship_type) values
  ('10000000-0000-0000-0000-00000000000b', 'Ana', 'mae'),
  ('10000000-0000-0000-0000-00000000000c', 'Vovó Lúcia', 'avo'),
  ('10000000-0000-0000-0000-00000000000d', 'Tia Bia', 'tio'),
  ('10000000-0000-0000-0000-00000000000e', 'Amigo Leo', 'amigo');

insert into tests.kv select 'inv_ana', secret from public.admin_create_invitation('10000000-0000-0000-0000-00000000000b', 'ana@example.com', 30, true);
insert into tests.kv select 'inv_vovo', secret from public.admin_create_invitation('10000000-0000-0000-0000-00000000000c', 'VOVO@example.com', 30, true);
insert into tests.kv select 'inv_tia', secret from public.admin_create_invitation('10000000-0000-0000-0000-00000000000d', null, 30, true);
insert into tests.kv select 'inv_amigo', secret from public.admin_create_invitation('10000000-0000-0000-0000-00000000000e', null, 30, false);
reset role;

select tests.expect_count($$ select 1 from public.invitations where token_hash is null $$, 0, 'invitations store only hashes');
select tests.expect_count($$ select 1 from public.invitations i join tests.kv k on convert_to(k.v, 'UTF8') = i.token_hash $$, 0,
  'plaintext secrets are never stored');

-- ---------------------------------------------------------------------
-- Convites: aceite por e-mail comprovado e por segredo
-- ---------------------------------------------------------------------
select tests.login_anon();
select tests.expect_true((select valid from public.check_invitation((select v from tests.kv where k = 'inv_tia'))), 'anon can check a valid invitation');
select tests.expect_true(not (select valid from public.check_invitation('x' || (select v from tests.kv where k = 'inv_tia'))), 'wrong secret is invalid');
select tests.expect_error($$ select * from public.invitations $$, 'anon cannot read invitations');
select tests.expect_error($$ select * from public.memories $$, 'anon cannot read memories');
select tests.expect_error($$ select public.accept_invitation((select v from tests.kv where k = 'inv_tia')) $$, 'anon cannot accept invitations');
reset role;

-- Estranho tenta usar o convite da Vovó (e-mail diferente)
select tests.login('00000000-0000-0000-0000-00000000000f');
select tests.expect_error($$ select public.accept_invitation((select v from tests.kv where k = 'inv_vovo')) $$,
  'invitation bound to another e-mail cannot be accepted');
select tests.expect_true(public.accept_invitations_for_my_email() = 0, 'stranger has no invitations');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.expect_true(public.accept_invitations_for_my_email() = 1, 'ana accepts by verified e-mail');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_true(public.accept_invitations_for_my_email() = 1, 'vovo accepts by verified e-mail (case-insensitive)');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_ok($$ select public.accept_invitation((select v from tests.kv where k = 'inv_tia')) $$, 'tia accepts secret link');
select tests.expect_error($$ select public.accept_invitation((select v from tests.kv where k = 'inv_tia')) $$, 'invitation is single-use');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_ok($$ select public.accept_invitation((select v from tests.kv where k = 'inv_amigo')) $$, 'amigo accepts secret link');
select tests.expect_true(public.can_contribute() and not public.is_in_family(), 'amigo contributes but is outside the family group');
reset role;

-- Ana vira admin somente por ação de um admin
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.expect_true(not public.is_admin(), 'ana is not admin before being granted');
select tests.expect_error($$ select public.admin_set_role('10000000-0000-0000-0000-00000000000b', 'admin', true) $$, 'ana cannot promote herself');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.admin_set_role('10000000-0000-0000-0000-00000000000b', 'admin', true);
select tests.expect_error($$ select public.admin_set_role((select id from public.people where display_name = 'Cesar'), 'admin', false) $$,
  'admin cannot remove own admin role');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000b');
select tests.expect_true(public.is_admin(), 'ana is admin after grant');
reset role;

-- ---------------------------------------------------------------------
-- Escalada de privilégio é impossível pelo navegador
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_error($$ insert into public.person_roles (profile_id, role) values (public.current_profile_id(), 'admin') $$,
  'contributor cannot insert admin role');
update public.person_roles set role = 'admin' where profile_id = public.current_profile_id(); -- sem política: 0 linhas
select tests.expect_count($$ select 1 from public.person_roles where role = 'admin' and profile_id = public.current_profile_id() $$, 0,
  'role unchanged');
select tests.expect_error($$ update public.profiles set status = 'active', auth_user_id = gen_random_uuid() where auth_user_id = auth.uid() $$,
  'contributor cannot alter protected profile fields');
select tests.expect_ok($$ update public.profiles set display_name = 'Vó Lúcia' where auth_user_id = auth.uid() $$,
  'contributor can rename own display name');
update public.people set relationship_type = 'mae' where id = public.current_person_id(); -- sem política: 0 linhas
reset role;
select tests.expect_count($$ select 1 from public.people where display_name = 'Vovó Lúcia' and relationship_type = 'avo' $$, 1,
  'people row untouched by contributor');

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_count('select 1 from public.invitations', 0, 'contributor cannot list invitations');
select tests.expect_count('select 1 from public.nfc_tokens', 0, 'contributor cannot list nfc tokens');
select tests.expect_count('select 1 from public.audit_events', 0, 'contributor cannot read audit log');
reset role;

-- ---------------------------------------------------------------------
-- Memórias: envio, aprovação e visibilidade
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_error($$ insert into public.memories (memory_type, author_person_id, created_by_profile_id, moderation_status, description)
  values ('text', public.current_person_id(), public.current_profile_id(), 'approved', 'oi') $$,
  'contributor cannot create an already-approved memory');
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, title, description, visibility)
values ('20000000-0000-0000-0000-000000000001', 'text', public.current_person_id(), public.current_profile_id(),
        'Quando soubemos', 'Chorei de alegria.', 'family');
select tests.expect_error($$ update public.memories set moderation_status = 'approved' where id = '20000000-0000-0000-0000-000000000001' $$,
  'contributor cannot approve own memory by altering request');
select tests.expect_error($$ update public.memories set is_highlight = true where id = '20000000-0000-0000-0000-000000000001' $$,
  'contributor cannot set highlight');
select tests.expect_error($$ update public.memories set visibility = 'public' where id = '20000000-0000-0000-0000-000000000001' $$,
  'public visibility disabled');
select tests.expect_true(public.submit_memory('20000000-0000-0000-0000-000000000001') = 'pending_review', 'submit => pending_review');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 1, 'author sees own pending memory');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 0,
  'family member cannot see pending content of others');
reset role;

-- Contribuinte não pode moderar
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_error($$ select public.moderate_memory('20000000-0000-0000-0000-000000000001', 'approve') $$, 'contributor cannot moderate');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_true(public.moderate_memory('20000000-0000-0000-0000-000000000001', 'approve') = 'approved', 'admin approves');
reset role;
select tests.expect_count($$ select 1 from public.audit_events where action = 'memory.approve' $$, 1, 'approval is audited');
select tests.expect_count($$ select 1 from public.notification_jobs where event_type = 'memory.submitted' $$, 2,
  'both admins notified of submission');

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 1,
  'family member sees approved family memory');
select tests.expect_count($$ select 1 from public.people where id = '10000000-0000-0000-0000-00000000000c' $$, 1,
  'family member sees author of visible memory');
select tests.expect_count($$ select 1 from public.people where id = '10000000-0000-0000-0000-00000000000e' $$, 0,
  'family member cannot list unrelated people');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 0,
  'contributor outside family cannot see family memory');
reset role;

-- Seleção explícita via access_grants
select tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.access_grants (grantee_profile_id, resource_type, resource_id)
select profile_id, 'memory', '20000000-0000-0000-0000-000000000001' from public.people where id = '10000000-0000-0000-0000-00000000000e';
reset role;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 1,
  'explicit grant gives access');
reset role;

-- Editar algo aprovado volta para revisão
select tests.login('00000000-0000-0000-0000-00000000000c');
update public.memories set description = 'Chorei muito de alegria.' where id = '20000000-0000-0000-0000-000000000001';
reset role;
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' and moderation_status = 'pending_review' $$, 1,
  'editing approved content requires a new review');
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000001' $$, 0,
  'content under re-review is hidden again');
reset role;

-- ---------------------------------------------------------------------
-- Arquivos e Storage
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, title, visibility)
values ('20000000-0000-0000-0000-000000000002', 'photo', public.current_person_id(), public.current_profile_id(), 'Ultrassom', 'family');
select tests.expect_error($$ insert into public.media_assets (memory_id, media_type, storage_path, mime_type, processing_status, created_by_profile_id)
  values ('20000000-0000-0000-0000-000000000002', 'image', '20000000-0000-0000-0000-000000000002/a.jpg', 'image/jpeg', 'ready', public.current_profile_id()) $$,
  'contributor cannot mark own file as ready');
select tests.expect_error($$ insert into public.media_assets (memory_id, media_type, storage_path, mime_type, created_by_profile_id)
  values ('20000000-0000-0000-0000-000000000002', 'image', 'other-folder/a.jpg', 'image/jpeg', public.current_profile_id()) $$,
  'asset path must live under memory folder');
insert into public.media_assets (id, memory_id, media_type, storage_path, mime_type, created_by_profile_id)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'image',
        '20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000001.jpg', 'image/jpeg', public.current_profile_id());
select tests.expect_error($$ select public.submit_memory('20000000-0000-0000-0000-000000000002') $$, 'cannot submit while upload pending');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_error($$ insert into public.media_assets (memory_id, media_type, storage_path, mime_type, created_by_profile_id)
  values ('20000000-0000-0000-0000-000000000002', 'image', '20000000-0000-0000-0000-000000000002/x.jpg', 'image/jpeg', public.current_profile_id()) $$,
  'cannot attach files to memory of another person');
select tests.expect_error($$ insert into storage.objects (bucket_id, name) values ('memories', '20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000001.jpg') $$,
  'cannot upload into a path registered by someone else');
select tests.expect_error($$ insert into storage.objects (bucket_id, name) values ('memories', 'random/path.jpg') $$,
  'cannot upload to unregistered path');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_ok($$ insert into storage.objects (bucket_id, name) values ('memories', '20000000-0000-0000-0000-000000000002/30000000-0000-0000-0000-000000000001.jpg') $$,
  'author uploads to registered path');
reset role;

-- Backend (service role) verifica o arquivo
set local role service_role;
update public.media_assets set processing_status = 'ready', size_bytes = 1234 where id = '30000000-0000-0000-0000-000000000001';
reset role;

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_true(public.submit_memory('20000000-0000-0000-0000-000000000002') = 'pending_review', 'photo memory submitted');
select tests.expect_count($$ select 1 from storage.objects where bucket_id = 'memories' $$, 1, 'author can read own pending file');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from storage.objects where bucket_id = 'memories' $$, 0, 'pending file not readable by family');
select tests.expect_count($$ select 1 from public.media_assets $$, 0, 'pending asset rows not readable by family');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
select public.moderate_memory('20000000-0000-0000-0000-000000000002', 'reject', 'Foto duplicada');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from storage.objects where bucket_id = 'memories' $$, 0, 'rejected file not readable by direct path');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
select public.moderate_memory('20000000-0000-0000-0000-000000000002', 'approve');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from storage.objects where bucket_id = 'memories' $$, 1, 'approved file readable by family');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_count($$ select 1 from storage.objects where bucket_id = 'memories' $$, 0, 'non-family cannot read family file');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000f');
select tests.expect_count($$ select 1 from storage.objects $$, 0, 'stranger reads no files');
select tests.expect_count($$ select 1 from public.memories $$, 0, 'stranger reads no memories');
select tests.expect_error($$ insert into public.memories (memory_type, author_person_id, created_by_profile_id, description)
  values ('text', '10000000-0000-0000-0000-00000000000c', public.current_profile_id(), 'spam') $$, 'stranger cannot contribute');
reset role;

-- ---------------------------------------------------------------------
-- Cartas para o futuro: bloqueio real por data
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, title, description, visibility, unlock_at, recipient)
values ('20000000-0000-0000-0000-000000000003', 'letter', public.current_person_id(), public.current_profile_id(),
        'Para os seus 15 anos', 'Querida Maya...', 'family', '2042-06-01', 'Maya');
select public.submit_memory('20000000-0000-0000-0000-000000000003');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.moderate_memory('20000000-0000-0000-0000-000000000003', 'approve');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000003' $$, 0,
  'approved letter is locked before its date (direct query)');
select tests.expect_true(not public.memory_viewable('20000000-0000-0000-0000-000000000003'), 'memory_viewable false before unlock');
reset role;
update public.memories set unlock_at = now() - interval '1 minute' where id = '20000000-0000-0000-0000-000000000003';
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000003' $$, 1,
  'letter readable after unlock date');
reset role;

-- ---------------------------------------------------------------------
-- Cápsulas: não abrem antes da condição, nem por chamada direta
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.capsules (id, title, opens_at, opening_rule, status)
values ('40000000-0000-0000-0000-000000000001', '1 ano', now() + interval '1 year', 'date', 'scheduled'),
       ('40000000-0000-0000-0000-000000000002', 'Surpresa', now() - interval '1 day', 'date_and_manual', 'scheduled'),
       ('40000000-0000-0000-0000-000000000003', 'Rascunho', now() - interval '1 day', 'date', 'draft');
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, title, description, visibility)
values ('20000000-0000-0000-0000-000000000004', 'text', public.current_person_id(), public.current_profile_id(),
        'Segredo do primeiro ano', 'Guardado.', 'capsule'),
       ('20000000-0000-0000-0000-000000000005', 'text', public.current_person_id(), public.current_profile_id(),
        'Segredo surpresa', 'Guardado.', 'capsule');
select public.moderate_memory('20000000-0000-0000-0000-000000000004', 'approve');
select public.moderate_memory('20000000-0000-0000-0000-000000000005', 'approve');
insert into public.capsule_items (capsule_id, memory_id) values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005');
select tests.expect_error($$ select public.admin_open_capsule('40000000-0000-0000-0000-000000000001') $$,
  'date capsule cannot be opened manually before its date');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.capsules where id in ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002') $$, 2,
  'family can see scheduled capsule metadata');
select tests.expect_count($$ select 1 from public.capsules where id = '40000000-0000-0000-0000-000000000003' $$, 0, 'draft capsules hidden');
select tests.expect_count($$ select 1 from public.capsule_items $$, 0, 'sealed capsule items hidden');
select tests.expect_count($$ select 1 from public.memories where visibility = 'capsule' $$, 0, 'capsule memories hidden before opening');
select tests.expect_error($$ select public.admin_open_capsule('40000000-0000-0000-0000-000000000002') $$, 'contributor cannot open capsules');
select tests.expect_error($$ update public.capsules set opens_at = now() - interval '1 day' where id = '40000000-0000-0000-0000-000000000001' returning 1/0 $$,
  'contributor cannot change capsule date');
reset role;
select tests.expect_count($$ select 1 from public.capsules where id = '40000000-0000-0000-0000-000000000001' and opens_at > now() $$, 1, 'capsule date untouched');

-- Data passou => abre sem depender de job
update public.capsules set opens_at = now() - interval '1 minute' where id = '40000000-0000-0000-0000-000000000001';
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000004' $$, 1, 'capsule opens when date passes');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000005' $$, 0,
  'date_and_manual capsule stays closed until authorized');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.admin_open_capsule('40000000-0000-0000-0000-000000000002');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000005' $$, 1, 'opened after authorization');
reset role;
select tests.expect_count($$ select 1 from public.audit_events where action = 'capsule.opened' $$, 1, 'capsule opening audited');

-- Fechar temporariamente sobrepõe a data
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.admin_set_capsule_status('40000000-0000-0000-0000-000000000001', 'sealed');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_count($$ select 1 from public.memories where id = '20000000-0000-0000-0000-000000000004' $$, 0, 'sealed capsule closes again');
reset role;

-- ---------------------------------------------------------------------
-- NFC: porta de entrada, nunca chave mestra
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
insert into tests.kv select 'nfc1', (public.admin_create_nfc_token('10000000-0000-0000-0000-00000000000c', 'Ursinho da Vovó')).public_id;
reset role;

select tests.login_anon();
select tests.expect_true((select state from public.resolve_nfc_token((select v from tests.kv where k = 'nfc1'))) = 'active', 'anon resolves active token');
select tests.expect_true((select greeting_name from public.resolve_nfc_token((select v from tests.kv where k = 'nfc1'))) is null,
  'anon does not learn whose token it is');
reset role;
select tests.expect_count($$ select 1 from public.visits $$, 0, 'scanning NFC does not create a visit');

select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_true((select is_my_token from public.resolve_nfc_token((select v from tests.kv where k = 'nfc1'))), 'owner recognised');
reset role;

select tests.login('00000000-0000-0000-0000-00000000000a');
insert into tests.kv select 'nfc2', (public.admin_replace_nfc_token((select id from public.nfc_tokens where public_id = (select v from tests.kv where k = 'nfc1')))).public_id;
select tests.expect_error($$ select public.admin_set_nfc_status((select id from public.nfc_tokens where public_id = (select v from tests.kv where k = 'nfc1')), 'active') $$,
  'replaced token cannot be reactivated');
reset role;
select tests.login_anon();
select tests.expect_true((select state from public.resolve_nfc_token((select v from tests.kv where k = 'nfc1'))) = 'unavailable', 'replaced token unavailable');
select tests.expect_true((select state from public.resolve_nfc_token((select v from tests.kv where k = 'nfc2'))) = 'active', 'replacement token active');
select tests.expect_true((select state from public.resolve_nfc_token('../../etc/passwd')) = 'unavailable', 'malformed id rejected');
reset role;
select tests.expect_count($$ select 1 from public.nfc_tokens where person_id = '10000000-0000-0000-0000-00000000000c' $$, 2,
  'replacement keeps the person (memories preserved)');

-- ---------------------------------------------------------------------
-- Visitas
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000d');
insert into public.visits (person_id, occurred_at, visit_type, status, created_by)
values ('10000000-0000-0000-0000-00000000000c', current_date, 'home', 'approved', public.current_profile_id());
select tests.expect_count($$ select 1 from public.visits where status = 'pending_review' and person_id = public.current_person_id() $$, 1,
  'visit forced to pending and to the caller person');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_count($$ select 1 from public.visits $$, 0, 'visits of others are private');
reset role;

-- ---------------------------------------------------------------------
-- Comentários moderados
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000e');
select tests.expect_error($$ insert into public.memory_comments (memory_id, author_person_id, created_by_profile_id, body)
  values ('20000000-0000-0000-0000-000000000002', public.current_person_id(), public.current_profile_id(), 'oi') $$,
  'cannot comment on memory without access');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
insert into public.memory_comments (id, memory_id, author_person_id, created_by_profile_id, body, status)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', public.current_person_id(), public.current_profile_id(), 'Que lindo!', 'approved');
select tests.expect_count($$ select 1 from public.memory_comments where status = 'pending_review' $$, 1, 'comment forced to pending');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_count($$ select 1 from public.memory_comments $$, 0, 'pending comment invisible to others');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000a');
select public.moderate_comment('50000000-0000-0000-0000-000000000001', 'approve');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000c');
select tests.expect_count($$ select 1 from public.memory_comments $$, 1, 'approved comment visible');
reset role;

-- ---------------------------------------------------------------------
-- Auditoria imutável
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_true((select count(*) from public.audit_events) > 0, 'admin reads audit log');
insert into tests.kv select 'audit_count', count(*)::text from public.audit_events;
delete from public.audit_events;               -- sem política: 0 linhas
update public.audit_events set action = 'x';   -- sem política: 0 linhas
reset role;
select tests.expect_count($$ select 1 from public.audit_events where action = 'x' $$, 0, 'admin cannot rewrite audit events');
select tests.expect_true((select count(*) from public.audit_events) >= (select v::bigint from tests.kv where k = 'audit_count'),
  'admin cannot delete audit events');
select tests.expect_error($$ delete from public.audit_events $$, 'even the owner cannot delete audit events');

-- ---------------------------------------------------------------------
-- Retirada pelo autor
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000c');
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, description)
values ('20000000-0000-0000-0000-000000000006', 'text', public.current_person_id(), public.current_profile_id(), 'Ops');
select public.submit_memory('20000000-0000-0000-0000-000000000006');
select tests.expect_true(public.request_memory_removal('20000000-0000-0000-0000-000000000006') = 'removed', 'author withdraws pending content');
select tests.expect_true(public.request_memory_removal('20000000-0000-0000-0000-000000000002') = 'requested', 'published content needs admin decision');
reset role;
select tests.login('00000000-0000-0000-0000-00000000000d');
select tests.expect_error($$ select public.request_memory_removal('20000000-0000-0000-0000-000000000002') $$, 'cannot request removal of others content');
reset role;

-- ---------------------------------------------------------------------
-- Funções exclusivas do backend
-- ---------------------------------------------------------------------
select tests.login('00000000-0000-0000-0000-00000000000a');
select tests.expect_error($$ select public.claim_notification_jobs(10) $$, 'even admins cannot claim jobs from the browser');
select tests.expect_error($$ select public.email_has_pending_invitation('x@example.com') $$, 'invitation oracle not exposed to clients');
select tests.expect_error($$ select public.write_audit('fake', 'x', null, '{}') $$, 'cannot forge audit events directly');
reset role;

select 'all authorization tests passed' as result;
rollback;
