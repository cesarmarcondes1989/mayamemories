-- Textos do livro/filme: admin escreve, família lê, convidado não vê
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'adm11@example.com'),
  ('00000000-0000-0000-0000-0000000000b2', 'fam11@example.com');
select public.bootstrap_first_admin('adm11@example.com', 'Admin', 'pai');
select tests.login('00000000-0000-0000-0000-0000000000b1');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '10000000-0000-0000-0000-0000000000b2', 'Tia');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000b2', 'fam11@example.com');
select tests.expect_ok($$ insert into public.story_texts (vault_id, period, section, body, source) values (tests.vault(), '2026', 'intro', 'Um ano lindo.', 'ai') $$, 'admin writes story text');
select tests.expect_error($$ insert into public.story_texts (vault_id, period, section, body) values (tests.vault(), 'x', 'intro', 'a') $$, 'period validated');
select tests.expect_ok($$ update public.vaults set ai_enabled = true where id = tests.vault() $$, 'admin turns AI on');
select tests.expect_ok($$ insert into public.story_settings (vault_id, guidance) values (tests.vault(), 'Não coloque nada do tio.') $$, 'admin writes guidance');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000b2');
select public.accept_invitations_for_my_email();
select tests.expect_count($$ select 1 from public.story_texts $$, 1, 'family reads story texts');
select tests.expect_error($$ insert into public.story_texts (vault_id, period, section, body) values (tests.vault(), '2026', 'x1', 'hack') $$, 'family cannot write');
select tests.expect_count($$ select 1 from public.story_settings $$, 0, 'family never sees the guidance');
reset role;
rollback;
