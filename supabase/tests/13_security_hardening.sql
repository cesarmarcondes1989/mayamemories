-- Varredura de segurança: brechas fechadas continuam fechadas
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000013a1', 'adm13@example.com'),
  ('00000000-0000-0000-0000-0000000013b1', 'vitima13@example.com'),
  ('00000000-0000-0000-0000-0000000013c1', 'parente13@example.com');
select public.bootstrap_first_admin('adm13@example.com', 'Admin', 'pai');
-- a vítima tem conta (perfil) em outro lugar
insert into tests.kv select 'vitima', id::text from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000013b1';

select tests.login('00000000-0000-0000-0000-0000000013a1');
-- 1. admin não aponta uma pessoa para a conta de outra pessoa
select tests.expect_error($$ insert into public.people (vault_id, display_name, profile_id) values (tests.vault(), 'Isca', (select v::uuid from tests.kv where k = 'vitima')) $$,
  'admin cannot create a person bound to someone else''s account');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '13000000-0000-0000-0000-0000000000d1', 'Tio');
select tests.expect_error($$ update public.people set profile_id = (select v::uuid from tests.kv where k = 'vitima') where id = '13000000-0000-0000-0000-0000000000d1' $$,
  'admin cannot re-point a person to another account');
-- 2. e-mail do convite nunca é usado para entrar pelo ursinho
select public.admin_create_invitation('13000000-0000-0000-0000-0000000000d1', 'vitima13@example.com');
insert into tests.kv select 'tok13', (public.admin_create_nfc_token(tests.vault(), '13000000-0000-0000-0000-0000000000d1', 'Ursinho do tio')).public_id;
insert into tests.kv select 'adm13', (public.admin_create_nfc_token(tests.vault(), (select id from public.people where display_name = 'Admin' and vault_id = tests.vault()), 'Ursinho admin')).public_id;
-- 4. admin do baú não marca o baú como demonstração
select tests.expect_error($$ update public.vaults set is_demo = true where id = tests.vault() $$, 'vault admin cannot flag the vault as demo');
-- 5. usuário não altera registros de arquivo
insert into public.memories (id, vault_id, memory_type, author_person_id, created_by_profile_id, description)
values ('13000000-0000-0000-0000-0000000000e1', tests.vault(), 'photo', (select id from public.people where display_name = 'Admin' and vault_id = tests.vault()), public.current_profile_id(), 'foto');
insert into public.media_assets (id, vault_id, memory_id, media_type, mime_type, storage_path, size_bytes, processing_status)
values ('13000000-0000-0000-0000-0000000000f1', tests.vault(), '13000000-0000-0000-0000-0000000000e1', 'image', 'image/jpeg',
        tests.vault()::text || '/13000000-0000-0000-0000-0000000000e1/a.jpg', 10, 'pending_upload');
select tests.expect_error($$ update public.media_assets set processing_status = 'ready' where id = '13000000-0000-0000-0000-0000000000f1' $$,
  'admin cannot mark an unverified file as ready');
reset role;

set local role service_role;
select tests.expect_true((select invitation_email is null from public.nfc_login_target((select v from tests.kv where k = 'tok13'))), 'login target never exposes the invitation e-mail');
select tests.expect_true((select auth_email is null from public.nfc_login_target((select v from tests.kv where k = 'tok13'))), 'unlinked person has no account to open');
select tests.expect_true((select is_admin from public.nfc_login_target((select v from tests.kv where k = 'adm13'))), 'admin bear still flagged (route requires e-mail)');
-- 3. papel revogado não volta quando o ursinho é usado de novo
select public.nfc_link_person((select v from tests.kv where k = 'tok13'), '00000000-0000-0000-0000-0000000013c1');
update public.person_roles set revoked_at = now()
  where profile_id = (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000013c1');
select public.nfc_link_person((select v from tests.kv where k = 'tok13'), '00000000-0000-0000-0000-0000000013c1');
select tests.expect_count($$ select 1 from public.person_roles where revoked_at is null
  and profile_id = (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000013c1') $$, 0, 'revoked role is not re-granted by the bear');
-- 7. limite de tentativas
select tests.expect_true(public.rate_limit_hit('t13', 60, 2), 'first attempt allowed');
select tests.expect_true(public.rate_limit_hit('t13', 60, 2), 'second attempt allowed');
select tests.expect_true(not public.rate_limit_hit('t13', 60, 2), 'third attempt blocked');
reset role;
select tests.login('00000000-0000-0000-0000-0000000013a1');
select tests.expect_error($$ select public.rate_limit_hit('x', 60, 1) $$, 'clients cannot call the rate limiter');
select tests.expect_error($$ select 1 from public.rate_events $$, 'clients cannot read rate events');
reset role;

-- 6. dono da plataforma sem 2 fatores não altera contas
select tests.login('00000000-0000-0000-0000-0000000013a1');
select tests.expect_true(public.is_platform_admin(), 'bootstrap admin is platform admin');
update public.accounts set name = 'hack';
select tests.expect_count($$ select 1 from public.accounts where name = 'hack' $$, 0, 'platform admin without aal2 cannot edit accounts');
reset role;

select 'security hardening tests passed' as result;
rollback;
