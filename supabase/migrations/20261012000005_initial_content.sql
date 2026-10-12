-- =====================================================================
-- Maya Memories — conteúdo inicial do produto
-- Cápsulas sugeridas. Admins podem editar datas, pular ou criar outras.
-- =====================================================================

insert into public.capsules (title, description, theme, capsule_type, opening_rule, status, visibility_policy)
values
  ('Cápsula Zero — A espera pela Maya',
   'Da gestação ao nascimento: a expectativa da família antes de Maya chegar.',
   'O que estávamos vivendo', 'pregnancy', 'manual', 'scheduled', 'family'),
  ('Cápsula do nascimento',
   'Primeiras fotos, primeiros vídeos, a primeira visita e o relato dos pais.',
   'Quem estava por perto', 'birth', 'manual', 'scheduled', 'family'),
  ('Cartas para o futuro',
   'Cartas escritas para a Maya, cada uma com sua própria data de abertura.',
   'O que desejamos para você', 'letters', 'manual', 'draft', 'family');
