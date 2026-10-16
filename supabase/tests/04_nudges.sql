-- Incentivos: números só da própria pessoa
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a4', 'adm4@example.com'),
  ('00000000-0000-0000-0000-0000000000c4', 'c4@example.com'),
  ('00000000-0000-0000-0000-0000000000d4', 'd4@example.com');
select public.bootstrap_first_admin('adm4@example.com', 'Admin', 'pai');
select tests.login('00000000-0000-0000-0000-0000000000a4');
insert into public.people (id, display_name) values
  ('10000000-0000-0000-0000-0000000000c4', 'C4'), ('10000000-0000-0000-0000-0000000000d4', 'D4');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000c4', 'c4@example.com');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000d4', 'd4@example.com');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000c4');
select public.accept_invitations_for_my_email();
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, description)
values ('20000000-0000-0000-0000-0000000000c4', 'text', public.current_person_id(), public.current_profile_id(), 'Oi');
select public.submit_memory('20000000-0000-0000-0000-0000000000c4');
select tests.expect_true((public.my_memory_stats() ->> 'my_total')::int = 1, 'counts my own memories');
reset role;
select tests.login('00000000-0000-0000-0000-0000000000d4');
select public.accept_invitations_for_my_email();
select tests.expect_true((public.my_memory_stats() ->> 'my_total')::int = 0, 'other people do not see my numbers');
select tests.expect_true((public.my_memory_stats() ->> 'family_total')::int = 0, 'pending memories do not count for the family');
reset role;
select tests.login_anon();
select tests.expect_error($$ select public.my_memory_stats() $$, 'anon cannot read stats');
reset role;
rollback;
