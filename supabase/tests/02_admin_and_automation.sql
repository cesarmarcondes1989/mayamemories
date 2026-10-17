-- Painel administrativo, automações e regras de cápsulas de crescimento
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@example.com'),
  ('00000000-0000-0000-0000-0000000000c1', 'contrib@example.com');
select public.bootstrap_first_admin('admin@example.com', 'Admin', 'mae');

select tests.login('00000000-0000-0000-0000-0000000000a1');
insert into public.people (vault_id, id, display_name, relationship_type) values (tests.vault(), '10000000-0000-0000-0000-0000000000c1', 'Contrib', 'amigo');
insert into tests.kv select 'inv', secret from public.admin_create_invitation('10000000-0000-0000-0000-0000000000c1', 'contrib@example.com', 7, true);
select tests.expect_true((public.admin_dashboard_stats(tests.vault()) ->> 'pending_invitations')::int = 1, 'dashboard counts pending invitations');
select tests.expect_count($$ select 1 from public.admin_people_overview(tests.vault()) $$, 2, 'people overview lists everyone');
select tests.expect_error($$ select public.admin_generate_growth_capsules(tests.vault()) $$, 'growth capsules need a birth date');
update public.vaults set expected_birth_date = '2027-03-15' where id = tests.vault();
select tests.expect_true(public.admin_generate_growth_capsules(tests.vault()) = 17, 'creates 3m, 6m and 1..15 years');
select tests.expect_true(public.admin_generate_growth_capsules(tests.vault()) = 0, 'growth capsule generation is idempotent');
select tests.expect_count($$ select 1 from public.capsules where capsule_type = 'fifteen' and opens_at::date = '2042-03-15' $$, 1, '15-year capsule on the right date');
select tests.expect_error($$ select public.admin_set_role((select id from public.people where display_name = 'Admin'), 'admin', false) $$,
  'last admin cannot be removed');
reset role;

select tests.login('00000000-0000-0000-0000-0000000000c1');
select public.accept_invitations_for_my_email();
select tests.expect_error($$ select public.admin_dashboard_stats(tests.vault()) $$, 'contributor cannot read dashboard');
select tests.expect_error($$ select * from public.admin_people_overview(tests.vault()) $$, 'contributor cannot read people overview');
select tests.expect_error($$ select public.admin_create_invitation('10000000-0000-0000-0000-0000000000c1') $$, 'contributor cannot invite');
select tests.expect_error($$ select public.admin_create_nfc_token(tests.vault()) $$, 'contributor cannot create NFC tokens');
select tests.expect_error($$ select public.admin_generate_growth_capsules(tests.vault()) $$, 'contributor cannot create capsules');
select tests.expect_count($$ select 1 from public.capsules $$, 2, 'contributor sees only scheduled capsules (not drafts)');
select tests.expect_count($$ select 1 from public.notification_jobs $$, 0, 'contributor cannot read the notification queue');
-- Retirar consentimento: registro novo, histórico preservado
insert into public.consents (vault_id, person_id, consent_type, purpose, status, policy_version)
values (tests.vault(), public.vault_person_id(tests.vault()), 'contribution_terms', 'x', 'granted', 'v1');
insert into public.consents (vault_id, person_id, consent_type, purpose, status, policy_version)
values (tests.vault(), '10000000-0000-0000-0000-0000000000c1', 'contribution_terms', 'x', 'withdrawn', 'v1');
select tests.expect_true(not public.has_active_consent(tests.vault(), 'contribution_terms', 'v1'), 'withdrawn consent is not active');
select tests.expect_count($$ select 1 from public.consents $$, 2, 'consent history preserved');
reset role;

-- Fila de notificações (service role): reserva, conclusão e idempotência
select tests.expect_true((select count(*) from public.notification_jobs where event_type = 'invitation.accepted') = 1, 'admins notified when invitation is accepted');
set local role service_role;
select tests.expect_true((select count(*) from public.claim_notification_jobs(10)) = 1, 'service role claims pending jobs');
select tests.expect_true((select count(*) from public.claim_notification_jobs(10)) = 0, 'claimed jobs are not handed out twice');
select public.complete_notification_job((select id from public.notification_jobs limit 1), false, 'smtp down');
select tests.expect_true((select status from public.notification_jobs limit 1) = 'pending', 'failed job is retried later');
select tests.expect_true((select available_at > now() from public.notification_jobs limit 1), 'retry uses backoff');
reset role;

-- Cápsula programada próxima gera aviso único por pessoa
update public.capsules set status = 'scheduled', opens_at = now() + interval '3 days' where title like '%3 meses';
set local role service_role;
select tests.expect_true(public.enqueue_upcoming_capsule_notices(7) = 2, 'notice for each family member');
select public.enqueue_upcoming_capsule_notices(7);
reset role;
select tests.expect_count($$ select 1 from public.notification_jobs where event_type = 'capsule.upcoming' $$, 2, 'notices are idempotent');

select 'admin and automation tests passed' as result;
rollback;
