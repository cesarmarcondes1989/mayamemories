# Permissões e visibilidade

Toda autorização é avaliada **no banco** (RLS + funções). A interface só esconde o que o banco já nega.

## Papéis (`person_roles`, escopo `global`)

| Papel | Quem | Como recebe |
| --- | --- | --- |
| `admin` | Cesar, Ana | 1º via `bootstrap_first_admin` (service role, só se não houver admin); demais via `admin_set_role` |
| `contributor` | família e amigos | ao aceitar convite |
| `future_subject` | Maya (futuro) | concedido por admin |

Um usuário autenticado **sem** pessoa ativa vinculada não vê nada.

## Visibilidade de memórias (`memory_viewable`)

| Situação | Quem vê |
| --- | --- |
| Qualquer status (exceto removida) | autor e admins |
| `approved` + `family` | membros do grupo “Família autorizada” + concessões |
| `approved` + `selected` / `private` | admins + concessões explícitas (`access_grants`) |
| `approved` + `capsule` | quem pode ver uma cápsula **aberta** que a contém |
| `unlock_at` no futuro | só autor e admins |
| pendente / rejeitada / oculta | só autor e admins |
| `public` | ninguém (desativado) |

Arquivos (`media_assets` e `storage.objects`) seguem exatamente a mesma regra.

## Matriz resumida

| Ação | Anônimo | Contribuinte | Admin |
| --- | --- | --- | --- |
| Resolver token NFC | ✓ (só status) | ✓ | ✓ |
| Ver convite válido (nome) | ✓ com segredo | ✓ | ✓ |
| Enviar memória / visita / comentário | ✗ | ✓ (fica pendente) | ✓ |
| Aprovar / ocultar / remover | ✗ | ✗ | ✓ (RPC auditada) |
| Ver pendências de terceiros | ✗ | ✗ | ✓ |
| Ver visitas | ✗ | só as próprias | ✓ |
| Gerenciar pessoas, convites, tokens, cápsulas | ✗ | ✗ | ✓ |
| Alterar papéis | ✗ | ✗ | ✓ (não remove o próprio admin nem o último) |
| Ler auditoria | ✗ | ✗ | ✓ (ninguém altera) |
| Consumir fila de notificações | ✗ | ✗ | ✗ (só service role) |

## Guardas de coluna

Mesmo com permissão de UPDATE na própria linha, um contribuinte **não** consegue alterar:
`moderation_status`, `published_at`, `is_highlight`, `reviewed_*`, autor, `deleted_at` (memórias);
`status`, `auth_user_id` (perfil); status de visitas e comentários; `processing_status` de arquivos.
Editar uma memória aprovada a devolve para revisão.

## Testes

`supabase/tests/01_authorization.sql` e `02_admin_and_automation.sql` cobrem todos os casos obrigatórios da
especificação (§14.3), entre eles: contribuinte não vê privado de terceiros, não aprova o próprio conteúdo,
não acessa arquivos não autorizados, cápsula não abre antes da hora, token revogado não funciona, ninguém vira
admin alterando campos.
