# Modelo de dados

Migrações em `supabase/migrations` (aplicadas em ordem):

1. `..._core_schema.sql` — tabelas
2. `..._authorization.sql` — helpers, RLS, guardas, auditoria
3. `..._workflows.sql` — RPCs de negócio e permissões de execução
4. `..._storage.sql` — bucket privado e políticas
5. `..._initial_content.sql` — cápsulas iniciais

## Tabelas

| Tabela | Papel |
| --- | --- |
| `app_settings` | linha única: nome, datas (prevista/nascimento), limites de upload |
| `profiles` | perfil mínimo ligado a `auth.users` (criado por trigger, sem papéis) |
| `people` | pessoas do universo da Maya (existem antes da conta) |
| `relationship_types` | tipos de relação configuráveis |
| `person_roles` | papéis com escopo; escrita só por RPC |
| `access_groups`, `access_group_members` | “Família autorizada” e outros grupos |
| `invitations` | convites (hash SHA-256 do segredo, expiração, uso único) |
| `nfc_tokens` | `public_id` aleatório (120 bits), estados prepared/active/suspended/revoked/replaced |
| `memories` | registro lógico: tipo, autor, `occurred_at` ≠ `created_at`, visibilidade, moderação, `unlock_at` |
| `media_assets` | arquivos no bucket privado; `processing_status` independente da moderação |
| `memory_comments` | comentários moderados |
| `visits` | visitas explícitas (`occurred_at` ≠ `registered_at`) ligadas a uma memória |
| `capsules`, `capsule_items` | cápsulas e seus itens (único por par) |
| `consents` | finalidade + versão de política; histórico preservado |
| `access_grants` | concessões por pessoa ou grupo, com expiração/revogação |
| `data_deletion_requests` | pedidos de exclusão de conteúdo publicado |
| `audit_events` | append-only |
| `notification_preferences`, `notification_jobs` | preferências e outbox para o n8n |

## Tabelas previstas (criar quando o módulo existir)

`media_processing_jobs`, `exports`, `backup_runs`, `milestones`, `timeline_sections`,
`capsule_opening_events` (hoje coberto por `audit_events`).
