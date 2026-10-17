-- Cadastro aberto: usa na hora, mas e-mail só vale para convites depois de confirmado
begin;
insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000a9', 'adm9@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000b9', 'vovo9@example.com', '{"email_verified": false}');
select public.bootstrap_first_admin('adm9@example.com', 'Admin', 'pai');

-- Admin da Maya convida a vovó pelo e-mail
select tests.login('00000000-0000-0000-0000-0000000000a9');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '10000000-0000-0000-0000-0000000000b9', 'Vovó');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000b9', 'vovo9@example.com');
reset role;

-- Alguém se cadastra com o e-mail da vovó (ainda não confirmado)
select tests.login('00000000-0000-0000-0000-0000000000b9');
select tests.expect_true(public.accept_invitations_for_my_email() = 0, 'unverified account cannot take invitations');
select tests.expect_ok($$ select public.create_vault('child', 'Bebê', 'Bebê', 'bebe-9', 'Eu', 'mae') $$, 'new account creates its free vault right away');
select tests.expect_true(public.is_vault_admin(tests.vault('bebe-9')), 'and owns it');
select tests.expect_error($$ select public.create_vault('child', 'Outro', 'Outro', 'outro-9', 'Eu', 'mae') $$, 'free limit: one vault');
select tests.expect_true(not public.is_vault_member(tests.vault('maya')), 'no access to the invited vault yet');
reset role;

-- Depois de confirmar o e-mail (clicou no link), o convite vale
update auth.users set raw_app_meta_data = '{"email_verified": true}' where id = '00000000-0000-0000-0000-0000000000b9';
select tests.login('00000000-0000-0000-0000-0000000000b9');
select tests.expect_true(public.accept_invitations_for_my_email() = 1, 'verified account accepts invitation');
reset role;

-- Limite configurável pela plataforma
update public.app_settings set self_service_vault_limit = 2;
select tests.login('00000000-0000-0000-0000-0000000000b9');
select tests.expect_ok($$ select public.create_vault('event', 'Chá', 'Chá', 'cha-9', 'Eu', 'mae') $$, 'raised limit allows a second vault');
reset role;
rollback;
