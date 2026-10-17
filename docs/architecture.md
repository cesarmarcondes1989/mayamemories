# Arquitetura

## Camadas

```
Navegador (React)          ─ só UI e estado de formulário; nenhuma decisão de acesso
   │  Server Actions / Route Handlers (Vercel, Node)
   ▼
Next.js servidor           ─ valida entrada (zod), traduz erros, orquestra uploads
   │  cliente Supabase COM A SESSÃO DO USUÁRIO (padrão)
   ▼
Postgres (Supabase)        ─ RLS + guardas de coluna + RPCs SECURITY DEFINER
                             = fonte única da autorização
Storage privado            ─ políticas espelham memory_viewable()
```

O **service role** é usado só em pontos estreitos do servidor (`lib/supabase/admin.ts`):
verificar arquivos enviados, enviar convites pelo Admin API, limpar arquivos de memórias removidas,
fila de automação e scripts de backup.

## Multi-cliente (Fase 0)

O **baú** (`vaults`) é a unidade de tudo. Toda tabela de conteúdo tem `vault_id`, e as regras de acesso
avaliam o baú **da própria linha** (`is_vault_admin(vault_id)`, `memory_viewable(id)` usa o baú da memória).
Não há cabeçalho nem cookie na autorização: o cookie `mm_vault` só escolhe qual dos seus baús o app mostra.

```
accounts (quem paga) ─┬─ vaults (baú: criança ou evento, tema, datas, status)
                      │     └─ people, person_roles, memories, media, capsules, tokens NFC, …
platform_admins ──────┘  (dono da plataforma: vê baús e contas, NÃO vê conteúdo)
```

- Uma pessoa (um login) participa de vários baús, com uma `people` por baú (`my_vaults()`).
- `vault_id` é imutável; filhos herdam o baú do pai por trigger; referências cruzadas entre baús são recusadas.
- Baú `read_only`: todos leem e exportam, ninguém envia (inadimplência ou evento encerrado).
- Criar baú: só o dono da plataforma, até `app_settings.self_service_vaults` ser ligado (Fase 1, com checkout).
- Arquivos novos: `<vault>/<memória>/<arquivo>`; caminhos antigos continuam válidos.

## Fluxos principais

### Entrada por NFC (`/m/[token]`)
1. `resolve_nfc_token(public_id)` → `active` ou `unavailable`. Atualiza `last_scanned_at`. Não autentica, não cria visita.
2. Sem sessão: pede e-mail. O servidor verifica se há convite pendente para o e-mail
   (`email_has_pending_invitation`, só service role) e envia convite (Admin API) ou link mágico.
   A resposta é sempre genérica.
3. Com sessão de participante: mostra as ações (visita, foto/vídeo, áudio, carta, mensagem).

### Convite
- Por e-mail: posse do e-mail comprovada pelo link mágico → `/convite/concluir` → `accept_invitations_for_my_email()`.
- Por link (WhatsApp): `/convite/<segredo>` (uso único, expira, só o hash SHA-256 fica no banco). O segredo vai para
  cookie httpOnly durante o login e é consumido por `accept_invitation(secret)`.

### Envio de memória
```
createMemoryDraft ─► memories (draft/uploading) + media_assets (pending_upload) + URLs de upload assinadas
navegador ─PUT direto─► Storage (política: só o caminho pré-registrado do próprio autor)
finalizeAsset ─► confere tamanho real + magic bytes ─► service role marca `ready` (ou `failed` e apaga)
submit_memory ─► pending_review + notificação para admins
moderate_memory ─► approved/rejected/... + auditoria + notificação ao autor
```
Processamento técnico (`processing_status`) e aprovação editorial (`moderation_status`) são independentes.
Vídeos ficam `ready` após verificação; miniaturas/transcodificação ficam para uma fila futura
(`media_processing_jobs`), sem mudar o contrato.

### Cápsulas e cartas
- `capsule_is_open` = status ∈ {scheduled, opened} **e** regra satisfeita (`date`, `manual`, `date_and_manual`), avaliada com `now()` a cada consulta.
- `sealed` sobrepõe a data (fechamento temporário). `draft` é invisível para a família.
- Memória com `visibility = capsule` só aparece por uma cápsula aberta. Uma memória pode estar na linha do tempo e em várias cápsulas (tabela `capsule_items`), sem duplicar arquivos.
- Cartas têm `unlock_at`: invisíveis antes da data para todos exceto autor e admins (que moderam).

## Decisões (ADR resumido)

1. **Autorização no banco, não no app.** O app pode ter bugs de UI; o RLS continua negando. Testado em `supabase/tests`.
2. **Status como texto + CHECK**, não enums: novos tipos de memória exigem só uma migração de constraint.
3. **Admins enxergam cartas lacradas** para poder moderar. Se no futuro houver “cartas seladas até para os pais”, criar flag explícita.
4. **Visibilidade `public` existe no modelo, mas está desativada** (trigger recusa). Habilitar exige migração + revisão de privacidade.
5. **Sem cadastro público.** Contas nascem via Admin API depois de validar convite.
6. **Comentários sempre moderados no MVP.**
7. **Localização de visitas não é coletada** no MVP (minimização de dados). O campo pode ser adicionado com consentimento específico.
8. **Futuro acesso da Maya**: papel `future_subject` já existe; ela vê o que um membro da família vê (via grupo) e as concessões explícitas. A experiência dedicada vem depois, sem reestruturar o banco.
11. **Baú como unidade, autorização pela linha (Fase 0).** Evita depender de contexto de requisição (cabeçalho/cookie) para segurança; o mesmo login atravessa vários baús sem vazar nada entre eles. Testado em `05_vault_isolation.sql` e no teste de upgrade.
10. **Ursinho = identidade (decisão do produto).** O token NFC ativo abre sessão direta como a pessoa vinculada (`/m/[token]/entrar`, Admin API + `nfc_link_person`). Nunca para administradores. O termo de contribuição é exibido junto ao botão de envio e registrado no primeiro envio.
9. **Notificações por outbox** (`notification_jobs` com `dedupe_key`): idempotentes e auditáveis; o n8n apenas consome.

## Limitações conhecidas do MVP

- Upload com retomada (TUS) ainda não: arquivos grandes reiniciam em caso de queda (há 3 tentativas automáticas).
- Duração de vídeo/áudio é medida no aparelho; o servidor valida tamanho e tipo real, não a duração.
- Miniaturas e transcodificação de vídeo: não implementadas (vídeos são exibidos no formato original).
- URLs assinadas válidas por 1h continuam funcionando até expirar mesmo após revogação de acesso (limite técnico do mecanismo).
