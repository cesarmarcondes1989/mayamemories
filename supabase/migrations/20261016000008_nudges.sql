-- =====================================================================
-- Incentivos carinhosos na página inicial
-- Números SÓ da própria pessoa + total coletivo (sem ranking, sem expor
-- ninguém). Os admins podem desligar em Configurações.
-- =====================================================================
alter table public.app_settings add column if not exists nudges_enabled boolean not null default true;

create or replace function public.my_memory_stats()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_person uuid := public.current_person_id();
  s public.app_settings;
begin
  if v_profile is null or v_person is null or not public.is_member() then
    return null;
  end if;
  select * into s from public.app_settings where id;
  return jsonb_build_object(
    'enabled', s.nudges_enabled,
    'subject_name', s.subject_name,
    'birth_date', s.birth_date,
    'expected_birth_date', s.expected_birth_date,
    'my_total', (select count(*) from public.memories m
                 where (m.created_by_profile_id = v_profile or m.author_person_id = v_person)
                   and m.deleted_at is null and m.moderation_status not in ('draft', 'uploading', 'removed')),
    'my_approved', (select count(*) from public.memories m
                    where (m.created_by_profile_id = v_profile or m.author_person_id = v_person)
                      and m.deleted_at is null and m.moderation_status = 'approved'),
    'my_last_at', (select max(m.submitted_at) from public.memories m
                   where m.created_by_profile_id = v_profile and m.deleted_at is null),
    'my_last_photo_at', (select max(m.submitted_at) from public.memories m
                         where m.created_by_profile_id = v_profile and m.deleted_at is null
                           and m.memory_type in ('photo', 'album', 'video', 'mixed')),
    'my_last_audio_at', (select max(m.submitted_at) from public.memories m
                         where m.created_by_profile_id = v_profile and m.deleted_at is null and m.memory_type = 'audio'),
    'my_letters', (select count(*) from public.memories m
                   where m.created_by_profile_id = v_profile and m.deleted_at is null and m.memory_type = 'letter'),
    'my_visits', (select count(*) from public.visits v where v.person_id = v_person and v.status = 'approved'),
    -- Total coletivo: só um número, nunca quem enviou
    'family_total', (select count(*) from public.memories m where m.moderation_status = 'approved' and m.deleted_at is null),
    'next_capsule', (select jsonb_build_object('id', c.id, 'title', c.title, 'opens_at', c.opens_at)
                     from public.capsules c
                     where c.status = 'scheduled' and c.opens_at > now() and public.capsule_listable(c.id)
                     order by c.opens_at limit 1)
  );
end;
$$;

revoke execute on function public.my_memory_stats() from public, anon;
grant execute on function public.my_memory_stats() to authenticated;
