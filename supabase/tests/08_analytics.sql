-- Analytics da vitrine: escrita só pelo backend, leitura só com 2 fatores
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a8', 'adm8@example.com'),
  ('00000000-0000-0000-0000-0000000000c8', 'c8@example.com');
select public.bootstrap_first_admin('adm8@example.com', 'Admin', 'pai');

set local role service_role;
insert into public.analytics_events (event, path, session_id, utm_source, utm_campaign, device, browser, os, country, region, city, plan_key) values
  ('page_view', '/', '30000000-0000-0000-0000-000000000001', 'instagram', 'maes-sp', 'mobile', 'Safari', 'iOS', 'BR', 'SP', 'São Paulo', null),
  ('plans_view', '/', '30000000-0000-0000-0000-000000000001', 'instagram', 'maes-sp', 'mobile', 'Safari', 'iOS', 'BR', 'SP', 'São Paulo', null),
  ('plan_click', '/', '30000000-0000-0000-0000-000000000001', 'instagram', 'maes-sp', 'mobile', 'Safari', 'iOS', 'BR', 'SP', 'São Paulo', 'familia'),
  ('lead_submit', '/', '30000000-0000-0000-0000-000000000001', 'instagram', 'maes-sp', 'mobile', 'Safari', 'iOS', 'BR', 'SP', 'São Paulo', null),
  ('page_view', '/', '30000000-0000-0000-0000-000000000002', null, null, 'desktop', 'Chrome', 'Windows', 'BR', 'RJ', 'Rio de Janeiro', null);
reset role;

select tests.login_anon();
select tests.expect_error($$ insert into public.analytics_events (event) values ('page_view') $$, 'anon cannot write events directly');
select tests.expect_error($$ select * from public.analytics_events $$, 'anon cannot read events');
select tests.expect_ok($$ select public.submit_lead('Ana', 'ana8@example.com', null, 'child', 'familia', null, 'site', '25-34', 'gestante', '{"utm_source":"instagram","evil":"x"}', null) $$, 'lead with profile');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c8');
select tests.expect_count($$ select * from public.analytics_events $$, 0, 'regular user reads nothing');
select tests.expect_error($$ select public.platform_analytics(30) $$, 'regular user cannot call analytics');
reset role;

select tests.login_mfa('00000000-0000-0000-0000-0000000000a8');
select tests.expect_count($$ select * from public.analytics_events $$, 5, 'platform admin with MFA reads events');
select tests.expect_true((public.platform_analytics(30) -> 'totals' ->> 'sessions')::int = 2, 'two sessions');
select tests.expect_true((public.platform_analytics(30) -> 'funnel' -> 4 ->> 'sessions')::int = 1, 'one session converted');
select tests.expect_true((public.platform_analytics(30) -> 'campaigns' -> 0 ->> 'leads')::int = 1, 'campaign gets the lead');
select tests.expect_true((select persona = 'gestante' and age_range = '25-34' and not (utm ? 'evil') from public.leads where email = 'ana8@example.com'), 'lead profile stored, unknown utm dropped');
reset role;
rollback;
