-- Depois da Fase 0: tudo o que existia continua funcionando, no baú "maya"
begin;
select tests.expect_count($$ select 1 from public.vaults where slug = 'maya' and expected_birth_date = '2027-03-15' $$, 1,
  'legacy data became vault #1 with its settings');
select tests.expect_count($$ select 1 from public.platform_admins $$, 1, 'first admin became platform admin');
select tests.expect_count($$ select 1 from public.memories where vault_id is null $$, 0, 'every memory has a vault');
select tests.expect_count($$ select 1 from public.capsules where vault_id = tests.vault() $$, 3, 'initial capsules moved into the vault');
select tests.expect_count($$ select 1 from public.access_groups where vault_id = tests.vault() and is_default_family $$, 1, 'family group moved');

select tests.login('00000000-0000-0000-0000-0000000000aa');
select tests.expect_true(public.is_vault_admin(tests.vault()), 'admin is still admin');
select tests.expect_true((public.admin_dashboard_stats(tests.vault()) ->> 'photos_videos')::int = 1, 'dashboard sees legacy media');
reset role;

insert into tests.kv select 'tok', public_id from public.nfc_tokens limit 1;
select tests.login('00000000-0000-0000-0000-0000000000bb');
select tests.expect_count($$ select 1 from public.memories $$, 1, 'grandma still sees her approved memory');
select tests.expect_count($$ select 1 from storage.objects $$, 1, 'legacy file path still readable');
select tests.expect_true((select state from public.resolve_nfc_token((select v from tests.kv where k = 'tok'))) = 'active',
  'existing bear keeps working');
reset role;
select 'upgrade checks passed' as result;
rollback;
