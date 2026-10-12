-- =====================================================================
-- Maya Memories — armazenamento privado
-- Um objeto só pode ser enviado para um caminho previamente registrado
-- em media_assets (pending_upload) pelo próprio autor, e só pode ser lido
-- por quem pode ver a memória. URLs assinadas herdam essa verificação.
-- =====================================================================

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'memories', 'memories', false,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/aac', 'audio/x-m4a',
    'application/pdf'
  ]
)
on conflict (id) do update set public = false, allowed_mime_types = excluded.allowed_mime_types;

create policy "memories bucket: read authorized media"
on storage.objects for select to authenticated
using (
  bucket_id = 'memories'
  and exists (
    select 1 from public.media_assets a
    where a.storage_path = storage.objects.name
      and a.processing_status <> 'deleted'
      and public.memory_viewable(a.memory_id)
  )
);

create policy "memories bucket: upload to registered path"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'memories'
  and exists (
    select 1 from public.media_assets a
    where a.storage_path = storage.objects.name
      and a.processing_status = 'pending_upload'
      and a.created_by_profile_id = public.current_profile_id()
  )
);
-- Sem políticas de UPDATE/DELETE: sobrescrita e remoção apenas pelo backend.
