-- Eventos dentro do baú e tokens de mesa (impessoais)
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a7', 'adm7@example.com'),
  ('00000000-0000-0000-0000-0000000000c7', 'c7@example.com'),
  ('00000000-0000-0000-0000-0000000000e7', 'guest-1@example.com'),
  ('00000000-0000-0000-0000-0000000000e8', 'guest-2@example.com');
select public.bootstrap_first_admin('adm7@example.com', 'Admin', 'pai');

select tests.login('00000000-0000-0000-0000-0000000000a7');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '10000000-0000-0000-0000-0000000000c7', 'Tia C7');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000c7', 'c7@example.com');
insert into tests.kv select 'ev', (public.admin_create_event(tests.vault(), 'Chá bar', '2026-11-20', null)).id;
insert into tests.kv select 'ev2', (public.admin_create_event(tests.vault(), '1 ano', null, null)).id;
insert into tests.kv select 'table', (public.admin_create_nfc_token(tests.vault(), null, 'Mesa 1', null, true, (select v::uuid from tests.kv where k = 'ev'))).public_id;
insert into tests.kv select 'table2', (public.admin_create_nfc_token(tests.vault(), null, 'Mesa 1 ano', null, true, (select v::uuid from tests.kv where k = 'ev2'))).public_id;
insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description, moderation_status, visibility)
values (tests.vault(), 'text', public.vault_person_id(tests.vault()), public.current_profile_id(), 'Do dia a dia', 'approved', 'family'),
       (tests.vault(), 'text', public.vault_person_id(tests.vault()), public.current_profile_id(), 'Do chá', 'approved', 'family'),
       (tests.vault(), 'text', public.vault_person_id(tests.vault()), public.current_profile_id(), 'Carta do chá', 'approved', 'private');
update public.memories set event_id = (select v::uuid from tests.kv where k = 'ev') where description in ('Do chá', 'Carta do chá');
insert into tests.kv select 'ptok', (public.admin_create_nfc_token(tests.vault(), '10000000-0000-0000-0000-0000000000c7', 'Ursinho da tia', null, true, (select v::uuid from tests.kv where k = 'ev2'))).public_id;
reset role;
select tests.expect_count($$ select 1 from public.access_group_members m join public.vault_events e on e.access_group_id = m.group_id
  where e.name = '1 ano' and m.person_id = '10000000-0000-0000-0000-0000000000c7' $$, 1, 'person token with event joins the event');

-- Ninguém além do backend usa a entrada de convidado
select tests.login_anon();
select tests.expect_error($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), '00000000-0000-0000-0000-0000000000e7', 'X') $$, 'anon cannot join');
select tests.expect_true((select token_kind = 'guest' and event_name = 'Chá bar' and not is_my_token from public.resolve_nfc_token((select v from tests.kv where k = 'table'))), 'table token resolves as guest');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000e7');
select tests.expect_error($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), auth.uid(), 'X') $$, 'authenticated cannot join by itself');
reset role;

set local role service_role;
select tests.expect_ok($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), '00000000-0000-0000-0000-0000000000e7', 'Bia') $$, 'guest joins');
select tests.expect_ok($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), '00000000-0000-0000-0000-0000000000e7', 'Bia') $$, 'join is idempotent');
select tests.expect_error($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), '00000000-0000-0000-0000-0000000000e8', '  ') $$, 'name required');
reset role;
select tests.expect_count($$ select 1 from public.people where display_name = 'Bia' $$, 1, 'one person per guest');

select tests.login('00000000-0000-0000-0000-0000000000e7');
select tests.expect_true((select is_my_token from public.resolve_nfc_token((select v from tests.kv where k = 'table'))), 'guest recognized on next tap');
select tests.expect_count($$ select 1 from public.memories $$, 1, 'guest sees only the event album (not daily life, not private)');
select tests.expect_count($$ select 1 from public.vault_events $$, 1, 'guest sees only own event');
select tests.expect_true(not public.in_vault_family(tests.vault()), 'guest is not family');
select tests.expect_error($$ select public.admin_create_event(tests.vault(), 'Hack', null, null) $$, 'guest cannot create events');
select tests.expect_ok($$ insert into public.memories (vault_id, memory_type, author_person_id, created_by_profile_id, description, event_id)
  values (tests.vault(), 'text', public.vault_person_id(tests.vault()), public.current_profile_id(), 'Parabéns!', (select v::uuid from tests.kv where k = 'ev')) $$, 'guest posts to the event');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c7');
select public.accept_invitations_for_my_email();
select tests.expect_count($$ select 1 from public.vault_events $$, 2, 'family sees every event');
select tests.expect_count($$ select 1 from public.memories $$, 2, 'family sees approved family memories, event ones included');
reset role;

-- Evento fechado não aceita novos convidados
select tests.login('00000000-0000-0000-0000-0000000000a7');
update public.vault_events set status = 'closed' where id = (select v::uuid from tests.kv where k = 'ev');
reset role;
select tests.login_anon();
select tests.expect_true((select state = 'closed' from public.resolve_nfc_token((select v from tests.kv where k = 'table'))), 'closed event shows as closed');
reset role;
set local role service_role;
select tests.expect_error($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'table'), '00000000-0000-0000-0000-0000000000e8', 'Caio') $$, 'closed event refuses guests');
select tests.expect_error($$ select * from public.nfc_guest_join((select v from tests.kv where k = 'tok-none'), '00000000-0000-0000-0000-0000000000e8', 'Caio') $$, 'unknown token refused');
reset role;
rollback;
