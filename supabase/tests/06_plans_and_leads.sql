-- Vitrine: planos públicos, interessados só para o dono da plataforma
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a6', 'adm6@example.com'),
  ('00000000-0000-0000-0000-0000000000c6', 'c6@example.com');
select public.bootstrap_first_admin('adm6@example.com', 'Admin', 'pai');
select tests.login('00000000-0000-0000-0000-0000000000a6');
insert into public.people (vault_id, id, display_name) values (tests.vault(), '10000000-0000-0000-0000-0000000000c6', 'C6');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000c6', 'c6@example.com');
update public.plans set active = false where key = 'legado';
reset role;

select tests.login_anon();
select tests.expect_count($$ select * from public.plans $$, 4, 'anon sees active plans only');
select tests.expect_true(public.public_brand() ->> 'brand_name' is not null, 'anon reads brand');
select tests.expect_ok($$ select public.submit_lead('Ana', 'ana@example.com', null, 'child', 'familia', 'oi', 'teste') $$, 'anon submits lead');
select tests.expect_ok($$ select public.submit_lead('Bia', null, '(11) 98888-7777', 'event', 'nao_existe', null, null) $$, 'unknown plan is tolerated');
select tests.expect_error($$ select public.submit_lead('Sem', '', '', null, null, null, null) $$, 'contact required');
select tests.expect_error($$ select * from public.leads $$, 'anon cannot read leads');
select tests.expect_error($$ insert into public.plans (key, name, billing) values ('xx', 'X', 'free') $$, 'anon cannot create plans');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c6');
select public.accept_invitations_for_my_email();
update public.app_settings set brand_name = 'Hack' where id;
select tests.expect_true(public.public_brand() ->> 'brand_name' <> 'Hack', 'family member cannot rename brand');
select tests.expect_count($$ select * from public.leads $$, 0, 'family member cannot read leads');
update public.plans set price_monthly_cents = 1 where key = 'ninho';
select tests.expect_count($$ select * from public.plans where price_monthly_cents = 1 $$, 0, 'family member cannot edit plans');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000a6');
select tests.expect_count($$ select * from public.plans $$, 5, 'platform admin sees inactive plans');
select tests.expect_count($$ select * from public.leads where phone = '11988887777' and plan_key is null $$, 1, 'phone normalized');
update public.plans set price_monthly_cents = 2990 where key = 'ninho';
select tests.expect_count($$ select * from public.plans where price_monthly_cents = 2990 $$, 1, 'platform admin edits plans');
update public.leads set status = 'contacted';
select tests.expect_count($$ select * from public.leads where status = 'contacted' $$, 2, 'platform admin updates leads');
update public.app_settings set brand_name = 'Nova Marca' where id;
select tests.expect_true(public.public_brand() ->> 'brand_name' = 'Nova Marca', 'platform admin renames brand');
reset role;
rollback;
