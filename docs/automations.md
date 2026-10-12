# Automações com n8n

O backend grava eventos em `notification_jobs` (outbox). O n8n **consome** essa fila; ele nunca decide acesso.

## Autenticação

Todas as rotas exigem `Authorization: Bearer <AUTOMATION_WEBHOOK_SECRET>` (mín. 32 caracteres, comparação em
tempo constante). Guarde o segredo nas credenciais do n8n, não no workflow.

## Endpoints

| Método | Rota | Uso |
| --- | --- | --- |
| POST | `/api/automations/jobs` `{ "limit": 20 }` | reserva jobs pendentes (cada job é entregue uma vez) |
| POST | `/api/automations/jobs/:id` `{ "success": true }` ou `{ "success": false, "error": "..." }` | conclui; falhas voltam com backoff exponencial (até 5 tentativas) |
| POST | `/api/automations/capsules/upcoming` `{ "days": 7 }` | enfileira avisos de cápsulas próximas (idempotente) |

## Eventos

| `event_type` | Para | Payload |
| --- | --- | --- |
| `memory.submitted` | admins | `memory_id`, `memory_type`, `to_email` |
| `memory.approved` / `memory.rejected` / `memory.changes_requested` | autor (se quiser) | `memory_id`, `note`, `to_email` |
| `invitation.accepted` | admins | `person_id`, `to_email` |
| `deletion.requested` | admins | `memory_id`, `to_email` |
| `capsule.upcoming` | família (se quiser) | `capsule_id`, `title`, `opens_at`, `to_email` |

## Workflow sugerido

1. **Cron** a cada 5 min → HTTP Request `POST /api/automations/jobs`.
2. **Split** nos jobs → **Switch** por `event_type` → **Send Email** (texto acolhedor, sem conteúdo privado,
   apenas um convite para abrir o site).
3. HTTP Request `POST /api/automations/jobs/{{id}}` com o resultado.
4. **Cron diário** → `POST /api/automations/capsules/upcoming`.
5. Workflow de erro do n8n → alerta para os admins.

Regras: nada de lembretes insistentes; respeite as preferências (o backend já filtra no enfileiramento).
