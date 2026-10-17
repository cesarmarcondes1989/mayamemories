-- Fase 0: um baú nunca enxerga outro
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000a05', 'cesar5@example.com'),   -- dono da plataforma, admin da Maya
  ('00000000-0000-0000-0000-000000000b05', 'joana5@example.com'),   -- cria o baú do João
  ('00000000-0000-0000-0000-000000000c05', 'vovo5@example.com');    -- avó nos dois baús
select public.bootstrap_first_admin('cesar5@example.com', 'Cesar', 'pai');

-- Criação self-service fechada por padrão
select tests.login('00000000-0000-0000-0000-000000000b05');
select tests.expect_error($$ select public.create_vault('child', 'João', 'João', 'joao', 'Joana', 'mae') $$, 'self-service vault creation is off by default');
reset role;
update public.app_settings set self_service_vaults = true;
-- Joana cria o próprio baú (self-service ligado)
select tests.login('00000000-0000-0000-0000-000000000b05');
select tests.expect_ok($$ select public.create_vault('child', 'João', 'João', 'joao', 'Joana', 'mae') $$, 'any user can create a vault');
select tests.expect_error($$ select public.create_vault('child', 'Outro', 'Outro', 'maya', 'Joana', 'mae') $$, 'slug must be unique');
select tests.expect_true(public.is_vault_admin(tests.vault('joao')), 'creator is admin of the new vault');
select tests.expect_true(not public.is_vault_admin(tests.vault('maya')), 'creator is not admin of other vaults');
insert into public.memories (vault_id, id, memory_type, author_person_id, created_by_profile_id, description, visibility)
values (tests.vault('joao'), '20000000-0000-0000-0000-000000000b05', 'text', public.vault_person_id(tests.vault('joao')),
        public.current_profile_id(), 'Segredo do João', 'family');
select public.moderate_memory('20000000-0000-0000-0000-000000000b05', 'approve');
insert into public.people (vault_id, id, display_name, relationship_type)
values (tests.vault('joao'), '10000000-0000-0000-0000-000000000c05', 'Vovó Rosa (João)', 'avo');
insert into tests.kv select 'inv_joao', secret from public.admin_create_invitation('10000000-0000-0000-0000-000000000c05', 'vovo5@example.com');
reset role;

-- Cesar (Maya) convida a mesma avó
select tests.login('00000000-0000-0000-0000-000000000a05');
insert into public.people (vault_id, id, display_name, relationship_type)
values (tests.vault('maya'), '10000000-0000-0000-0000-000000000c06', 'Vovó Rosa (Maya)', 'avo');
select public.admin_create_invitation('10000000-0000-0000-0000-000000000c06', 'vovo5@example.com');
insert into public.memories (vault_id, id, memory_type, author_person_id, created_by_profile_id, description, visibility)
values (tests.vault('maya'), '20000000-0000-0000-0000-000000000a05', 'text', public.vault_person_id(tests.vault('maya')),
        public.current_profile_id(), 'Segredo da Maya', 'family');
select public.moderate_memory('20000000-0000-0000-0000-000000000a05', 'approve');
select tests.expect_true(public.is_platform_admin(), 'bootstrap user is platform admin');

-- Privacidade: dono da plataforma NÃO vê conteúdo de outros baús
select tests.expect_count($$ select 1 from public.memories where vault_id = tests.vault('joao') $$, 0, 'platform admin cannot read other families memories');
select tests.expect_count($$ select 1 from public.people where vault_id = tests.vault('joao') $$, 0, 'platform admin cannot list other families people');
select tests.expect_error($$ select public.admin_dashboard_stats(tests.vault('joao')) $$, 'admin of maya cannot open joao dashboard');
select tests.expect_error($$ select public.moderate_memory('20000000-0000-0000-0000-000000000b05', 'hide') $$, 'cannot moderate another vault');
select tests.expect_error($$ select public.admin_create_nfc_token(tests.vault('joao')) $$, 'cannot create tokens in another vault');
select tests.expect_error($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description)
  values (tests.vault('joao'), 'text', public.vault_person_id(tests.vault('maya')), public.current_profile_id(), 'intruso') $$,
  'cannot write into another vault');
select tests.expect_error($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description)
  values (tests.vault('maya'), 'text', '10000000-0000-0000-0000-000000000c05', public.current_profile_id(), 'autor de outro baú') $$,
  'author must belong to the same vault');
select tests.expect_true((select count(*) from public.vaults) = 2, 'platform admin lists vaults (metadata only)');
reset role;

-- Joana não vê nada da Maya
select tests.login('00000000-0000-0000-0000-000000000b05');
select tests.expect_count($$ select 1 from public.memories $$, 1, 'joana sees only joao memories');
select tests.expect_count($$ select 1 from public.vaults $$, 1, 'joana sees only her vault');
select tests.expect_count($$ select 1 from public.capsules where vault_id = tests.vault('maya') $$, 0, 'no capsules of maya');
select tests.expect_count($$ select 1 from public.invitations where vault_id = tests.vault('maya') $$, 0, 'no invitations of maya');
select tests.expect_count($$ select 1 from public.audit_events where vault_id = tests.vault('maya') $$, 0, 'no audit of maya');
select tests.expect_error($$ update public.vaults set slug = 'novo' where id = tests.vault('joao') $$, 'vault admin cannot change the address');
select tests.expect_ok($$ update public.vaults set theme = 'azul', subject_name = 'Joãozinho' where id = tests.vault('joao') $$, 'vault admin edits theme and name');
reset role;

-- A avó aceita os dois convites com o mesmo login
select tests.login('00000000-0000-0000-0000-000000000c05');
select tests.expect_true(public.accept_invitations_for_my_email() = 2, 'one login, two vaults');
select tests.expect_count($$ select 1 from public.my_vaults() $$, 2, 'my_vaults lists both');
select tests.expect_true(public.vault_person_id(tests.vault('maya')) <> public.vault_person_id(tests.vault('joao')), 'a different person in each vault');
select tests.expect_count($$ select 1 from public.memories $$, 2, 'sees family memories of both vaults');
select tests.expect_true(not public.is_vault_admin(tests.vault('maya')) and not public.is_vault_admin(tests.vault('joao')), 'contributor only');
reset role;

-- Baú só leitura: lê, mas não envia
update public.vaults set status = 'read_only' where id = tests.vault('joao');
select tests.login('00000000-0000-0000-0000-000000000c05');
select tests.expect_count($$ select 1 from public.memories where vault_id = tests.vault('joao') $$, 1, 'read-only vault still readable');
select tests.expect_error($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description)
  values (tests.vault('joao'), 'text', public.vault_person_id(tests.vault('joao')), public.current_profile_id(), 'oi') $$,
  'read-only vault blocks new contributions');
select tests.expect_ok($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description)
  values (tests.vault('maya'), 'text', public.vault_person_id(tests.vault('maya')), public.current_profile_id(), 'oi') $$,
  'other vault unaffected');
reset role;

-- NFC: o token pertence ao baú da pessoa
select tests.login('00000000-0000-0000-0000-000000000a05');
insert into tests.kv select 'tok5', (public.admin_create_nfc_token(tests.vault('maya'), '10000000-0000-0000-0000-000000000c06', 'Ursinho')).public_id;
select tests.expect_error($$ select public.admin_create_nfc_token(tests.vault('maya'), '10000000-0000-0000-0000-000000000c05') $$,
  'token person must belong to the vault');
reset role;
select tests.login('00000000-0000-0000-0000-000000000c05');
select tests.expect_true((select vault_id from public.resolve_nfc_token((select v from tests.kv where k = 'tok5'))) = tests.vault('maya'),
  'owner learns which vault the bear opens');
reset role;

select 'vault isolation tests passed' as result;
rollback;
