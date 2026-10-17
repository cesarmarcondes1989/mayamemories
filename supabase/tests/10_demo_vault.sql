-- Baú de demonstração: todos navegam, ninguém altera
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'owner10@example.com'),
  ('00000000-0000-0000-0000-0000000000da', 'demo-admin@example.com'),
  ('00000000-0000-0000-0000-0000000000dc', 'demo-visit@example.com');
select public.bootstrap_first_admin('owner10@example.com', 'Dono', 'pai');

-- O backend monta a demo (service role não tem auth.uid)
set local role service_role;
insert into public.accounts (id, name, owner_profile_id) values
  ('40000000-0000-0000-0000-0000000000ac', 'Demonstração', (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000aa'));
insert into public.vaults (id, account_id, slug, kind, title, subject_name, is_demo) values
  ('40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-0000000000ac', 'demo-alice', 'child', 'Baú da Alice', 'Alice', true);
insert into public.access_groups (id, vault_id, name, is_default_family) values
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', 'Família autorizada', true);
update public.profiles set is_demo = true where auth_user_id in ('00000000-0000-0000-0000-0000000000da', '00000000-0000-0000-0000-0000000000dc');
insert into public.people (id, vault_id, display_name, profile_id, status) values
  ('40000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-000000000001', 'Ana (demo)', (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000da'), 'active'),
  ('40000000-0000-0000-0000-0000000000c1', '40000000-0000-0000-0000-000000000001', 'Visitante', (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000dc'), 'active');
insert into public.person_roles (vault_id, profile_id, role) values
  ('40000000-0000-0000-0000-000000000001', (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000da'), 'admin'),
  ('40000000-0000-0000-0000-000000000001', (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000dc'), 'contributor');
insert into public.access_group_members (group_id, person_id) values
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-0000000000c1');
insert into public.memories (id, vault_id, memory_type, author_person_id, created_by_profile_id, description, moderation_status, visibility)
values ('40000000-0000-0000-0000-0000000000f1', '40000000-0000-0000-0000-000000000001', 'text', '40000000-0000-0000-0000-0000000000a1',
        (select id from public.profiles where auth_user_id = '00000000-0000-0000-0000-0000000000da'), 'Oi Alice', 'approved', 'family');
reset role;
select tests.expect_true(public.demo_vault_id() = '40000000-0000-0000-0000-000000000001', 'demo vault is found');

-- Visitante vê, mas não altera nada
select tests.login('00000000-0000-0000-0000-0000000000dc');
select tests.expect_count($$ select 1 from public.memories where vault_id = '40000000-0000-0000-0000-000000000001' $$, 1, 'visitor sees demo memories');
select tests.expect_error($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description)
  values ('40000000-0000-0000-0000-000000000001', 'text', '40000000-0000-0000-0000-0000000000c1', public.current_profile_id(), 'spam') $$, 'visitor cannot add memories');
select tests.expect_error($$ update public.profiles set display_name = 'Hacker' where auth_user_id = auth.uid() $$, 'shared demo profile cannot be renamed');
select tests.expect_ok($$ select public.touch_last_seen() $$, 'last seen still updates');
reset role;

-- Administradora da demo: vê o painel, mas nem as RPCs alteram
select tests.login('00000000-0000-0000-0000-0000000000da');
select tests.expect_true(public.is_vault_admin('40000000-0000-0000-0000-000000000001'), 'demo admin is admin');
select tests.expect_error($$ select public.moderate_memory('40000000-0000-0000-0000-0000000000f1', 'hide', null) $$, 'RPCs cannot change the demo');
select tests.expect_error($$ select public.admin_create_event('40000000-0000-0000-0000-000000000001', 'Festa', null, null) $$, 'demo admin cannot create events');
select tests.expect_error($$ update public.vaults set title = 'Hack' where id = '40000000-0000-0000-0000-000000000001' $$, 'demo vault settings are frozen');
reset role;

-- O dono da plataforma pode ajustar a demo
select tests.login_mfa('00000000-0000-0000-0000-0000000000aa');
select tests.expect_ok($$ update public.vaults set welcome_message = 'Bem-vindo à demo' where id = '40000000-0000-0000-0000-000000000001' $$, 'platform admin edits demo');
reset role;
rollback;
