-- Roteiro do filme: admin escreve, família lê e não escreve
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'adm12@example.com'),
  ('00000000-0000-0000-0000-0000000000c2', 'fam12@example.com');
select public.bootstrap_first_admin('adm12@example.com', 'Admin', 'pai');
select tests.login('00000000-0000-0000-0000-0000000000c1');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '10000000-0000-0000-0000-0000000000c2', 'Tia');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000c2', 'fam12@example.com');
select tests.expect_ok($$ insert into public.story_films (vault_id, period, script) values (tests.vault(), '2026', '{"acts":[]}') $$, 'admin writes film script');
select tests.expect_error($$ insert into public.story_films (vault_id, period, script) values (tests.vault(), 'x', '{}') $$, 'period validated');
select tests.expect_error($$ insert into public.story_films (vault_id, period, script, source) values (tests.vault(), 'tudo', '{}', 'hack') $$, 'source validated');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c2');
select public.accept_invitations_for_my_email();
select tests.expect_count($$ select 1 from public.story_films $$, 1, 'family reads film script');
update public.story_films set source = 'ai' where period = '2026';
select tests.expect_count($$ select 1 from public.story_films where source = 'ai' $$, 0, 'family cannot update');
select tests.expect_error($$ insert into public.story_films (vault_id, period, script) values (tests.vault(), 'tudo', '{}') $$, 'family cannot insert');
reset role;
rollback;
