-- Banco no formato ANTERIOR à Fase 0 (como está em produção hoje)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000aa', 'cesar@example.com'),
  ('00000000-0000-0000-0000-0000000000bb', 'vovo@example.com');
select public.bootstrap_first_admin('cesar@example.com', 'Cesar', 'pai');
update public.app_settings set expected_birth_date = '2027-03-15', nudges_enabled = true;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', false);
set role authenticated;
insert into public.people (id, display_name, relationship_type) values ('10000000-0000-0000-0000-0000000000bb', 'Vovó', 'avo');
select public.admin_create_invitation('10000000-0000-0000-0000-0000000000bb', 'vovo@example.com');
select public.admin_create_nfc_token('10000000-0000-0000-0000-0000000000bb', 'Ursinho da Vovó');
reset role;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}', false);
set role authenticated;
select public.accept_invitations_for_my_email();
insert into public.memories (id, memory_type, author_person_id, created_by_profile_id, title, visibility)
values ('20000000-0000-0000-0000-0000000000bb', 'photo', public.current_person_id(), public.current_profile_id(), 'Ultrassom', 'family');
insert into public.media_assets (id, memory_id, media_type, storage_path, mime_type, created_by_profile_id)
values ('30000000-0000-0000-0000-0000000000bb', '20000000-0000-0000-0000-0000000000bb', 'image',
        '20000000-0000-0000-0000-0000000000bb/30000000-0000-0000-0000-0000000000bb.jpg', 'image/jpeg', public.current_profile_id());
insert into storage.objects (bucket_id, name) values ('memories', '20000000-0000-0000-0000-0000000000bb/30000000-0000-0000-0000-0000000000bb.jpg');
reset role;
update public.media_assets set processing_status = 'ready' where id = '30000000-0000-0000-0000-0000000000bb';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000bb","role":"authenticated"}', false);
set role authenticated;
select public.submit_memory('20000000-0000-0000-0000-0000000000bb');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', false);
set role authenticated;
select public.moderate_memory('20000000-0000-0000-0000-0000000000bb', 'approve');
reset role;
select set_config('request.jwt.claims', '', false);
