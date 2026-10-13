-- Acesso direto pelo ursinho NFC (token = identidade da pessoa)
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'nfc-vovo@example.com'),
  ('00000000-0000-0000-0000-0000000000b3', 'outra@example.com');
select public.bootstrap_first_admin('admin2@example.com', 'Admin', 'pai');

select tests.login('00000000-0000-0000-0000-0000000000a2');
insert into public.people (id, display_name, relationship_type) values ('10000000-0000-0000-0000-0000000000b2', 'Vovó Nina', 'avo');
insert into tests.kv select 'tok', (public.admin_create_nfc_token('10000000-0000-0000-0000-0000000000b2', 'Ursinho da Vovó')).public_id;
insert into tests.kv select 'admintok', (public.admin_create_nfc_token((select id from public.people where display_name = 'Admin'), 'Ursinho do admin')).public_id;
insert into tests.kv select 'campaign', (public.admin_create_nfc_token(null, 'Campanha')).public_id;
reset role;

-- Clientes (anon/autenticado) não podem usar as funções do backend
select tests.login_anon();
select tests.expect_error($$ select * from public.nfc_login_target((select v from tests.kv where k = 'tok')) $$, 'anon cannot resolve login target');
select tests.expect_error($$ select public.nfc_link_person((select v from tests.kv where k = 'tok'), '00000000-0000-0000-0000-0000000000b3') $$, 'anon cannot link a token');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b3');
select tests.expect_error($$ select public.nfc_link_person((select v from tests.kv where k = 'tok'), auth.uid()) $$, 'authenticated user cannot hijack a token');
reset role;

set local role service_role;
select tests.expect_true((select person_id from public.nfc_login_target((select v from tests.kv where k = 'tok'))) = '10000000-0000-0000-0000-0000000000b2', 'token resolves to its person');
select tests.expect_count($$ select 1 from public.nfc_login_target((select v from tests.kv where k = 'campaign')) $$, 0, 'campaign token has no identity');
select tests.expect_true((select is_admin from public.nfc_login_target((select v from tests.kv where k = 'admintok'))), 'admin token is flagged');
select tests.expect_ok($$ select public.nfc_link_person((select v from tests.kv where k = 'admintok'), '00000000-0000-0000-0000-0000000000a2') $$,
  'admin bear opens directly as its admin (product decision)');
select tests.expect_error($$ select public.nfc_link_person((select v from tests.kv where k = 'admintok'), '00000000-0000-0000-0000-0000000000b3') $$,
  'admin bear cannot be bound to another account');
select tests.expect_true(public.nfc_link_person((select v from tests.kv where k = 'tok'), '00000000-0000-0000-0000-0000000000b2') = '10000000-0000-0000-0000-0000000000b2', 'first access links the person');
select tests.expect_ok($$ select public.nfc_link_person((select v from tests.kv where k = 'tok'), '00000000-0000-0000-0000-0000000000b2') $$, 'subsequent accesses are idempotent');
select tests.expect_error($$ select public.nfc_link_person((select v from tests.kv where k = 'tok'), '00000000-0000-0000-0000-0000000000b3') $$,
  'token is non-transferable to another account');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000b2');
select tests.expect_true(public.can_contribute() and not public.is_admin(), 'token person is a contributor, never admin');
select tests.expect_true(public.is_in_family(), 'token person joins the family group');
select tests.expect_true((select is_my_token from public.resolve_nfc_token((select v from tests.kv where k = 'tok'))), 'page recognises its owner');
reset role;

-- Revogar corta o acesso
select tests.login('00000000-0000-0000-0000-0000000000a2');
select public.admin_set_nfc_status((select id from public.nfc_tokens where public_id = (select v from tests.kv where k = 'tok')), 'revoked');
reset role;
set local role service_role;
select tests.expect_count($$ select 1 from public.nfc_login_target((select v from tests.kv where k = 'tok')) $$, 0, 'revoked token cannot log in');
select tests.expect_error($$ select public.nfc_link_person((select v from tests.kv where k = 'tok'), '00000000-0000-0000-0000-0000000000b2') $$, 'revoked token cannot link');
reset role;
select tests.expect_count($$ select 1 from public.audit_events where action = 'nfc.direct_access' $$, 3, 'direct accesses are audited');
select tests.expect_count($$ select 1 from public.audit_events where action = 'nfc.direct_access' and (metadata ->> 'admin')::boolean $$, 1, 'admin bear access flagged in audit');

select 'nfc direct access tests passed' as result;
rollback;
